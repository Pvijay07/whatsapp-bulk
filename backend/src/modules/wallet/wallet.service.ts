import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the wallet balance for an organization. Creates one if missing.
   */
  async getOrCreateWallet(organizationId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { organizationId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          organizationId,
          currency: 'INR',
          balancePaise: 0n,
          reservedPaise: 0n,
        },
      });
    }

    return {
      id: wallet.id,
      organizationId: wallet.organizationId,
      currency: wallet.currency,
      balancePaise: wallet.balancePaise.toString(),
      reservedPaise: wallet.reservedPaise.toString(),
      availablePaise: (wallet.balancePaise - wallet.reservedPaise).toString(),
      balanceINR: (Number(wallet.balancePaise) / 100).toFixed(2),
      availableINR: (Number(wallet.balancePaise - wallet.reservedPaise) / 100).toFixed(2),
    };
  }

  /**
   * Credit funds to an organization's wallet (e.g. from Cashfree/Razorpay payment confirmation)
   * Idempotency key guarantees payments cannot be applied twice.
   */
  async creditWallet(
    organizationId: string,
    amountPaise: bigint,
    idempotencyKey: string,
    referenceId?: string,
    metadata: any = {},
  ) {
    if (amountPaise <= 0n) {
      throw new BadRequestException('Credit amount must be greater than zero paise');
    }

    return this.prisma.$transaction(async (tx) => {
      // Check for duplicate transaction
      const existingTx = await tx.walletTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existingTx) {
        this.logger.warn(`Duplicate wallet credit ignored for key: ${idempotencyKey}`);
        return existingTx;
      }

      // Fetch or initialize wallet
      let wallet = await tx.wallet.findUnique({
        where: { organizationId },
      });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { organizationId, balancePaise: 0n, reservedPaise: 0n },
        });
      }

      const newBalance = wallet.balancePaise + amountPaise;

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balancePaise: newBalance },
      });

      // Record immutable ledger entry
      const transaction = await tx.walletTransaction.create({
        data: {
          organizationId,
          walletId: updatedWallet.id,
          transactionType: TransactionType.CREDIT,
          amountPaise,
          balanceAfter: newBalance,
          referenceId,
          idempotencyKey,
          metadata,
        },
      });

      this.logger.log(
        `Wallet credited: Org ${organizationId} +₹${Number(amountPaise) / 100} (New balance: ₹${
          Number(newBalance) / 100
        })`,
      );

      return transaction;
    });
  }

  /**
   * Reserves funds in escrow before dispatching a campaign.
   */
  async reserveCampaignEscrow(
    organizationId: string,
    estimatedCostPaise: bigint,
    campaignId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { organizationId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const availablePaise = wallet.balancePaise - wallet.reservedPaise;
      if (availablePaise < estimatedCostPaise) {
        throw new BadRequestException(
          `Insufficient wallet balance. Required: ₹${(
            Number(estimatedCostPaise) / 100
          ).toFixed(2)}, Available: ₹${(Number(availablePaise) / 100).toFixed(2)}`,
        );
      }

      const newReserved = wallet.reservedPaise + estimatedCostPaise;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { reservedPaise: newReserved },
      });

      await tx.walletTransaction.create({
        data: {
          organizationId,
          walletId: wallet.id,
          transactionType: TransactionType.ESCROW_HOLD,
          amountPaise: estimatedCostPaise,
          balanceAfter: wallet.balancePaise,
          referenceId: campaignId,
          idempotencyKey: `escrow_hold_${campaignId}_${Date.now()}`,
          metadata: { campaignId, reason: 'Campaign reservation' },
        },
      });

      return true;
    });
  }

  /**
   * Settles campaign balance: debits actual cost, releases unused escrow hold.
   */
  async settleCampaign(
    organizationId: string,
    campaignId: string,
    actualCostPaise: bigint,
    originallyReservedPaise: bigint,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { organizationId },
      });
      if (!wallet) return;

      const newReserved = wallet.reservedPaise > originallyReservedPaise 
        ? wallet.reservedPaise - originallyReservedPaise 
        : 0n;

      const newBalance = wallet.balancePaise >= actualCostPaise 
        ? wallet.balancePaise - actualCostPaise 
        : 0n;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balancePaise: newBalance,
          reservedPaise: newReserved,
        },
      });

      // Debit actual spend
      await tx.walletTransaction.create({
        data: {
          organizationId,
          walletId: wallet.id,
          transactionType: TransactionType.DEBIT,
          amountPaise: actualCostPaise,
          balanceAfter: newBalance,
          referenceId: campaignId,
          idempotencyKey: `settle_debit_${campaignId}_${Date.now()}`,
          metadata: { campaignId, reason: 'Campaign actual delivery settlement' },
        },
      });

      // Release unused hold if any
      const unusedPaise = originallyReservedPaise - actualCostPaise;
      if (unusedPaise > 0n) {
        await tx.walletTransaction.create({
          data: {
            organizationId,
            walletId: wallet.id,
            transactionType: TransactionType.ESCROW_RELEASE,
            amountPaise: unusedPaise,
            balanceAfter: newBalance,
            referenceId: campaignId,
            idempotencyKey: `escrow_release_${campaignId}_${Date.now()}`,
            metadata: { campaignId, reason: 'Unused campaign escrow released' },
          },
        });
      }
    });
  }

  /**
   * Fetch transaction ledger history
   */
  async getTransactionHistory(organizationId: string, limit = 50) {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return transactions.map((t) => ({
      ...t,
      amountPaise: t.amountPaise.toString(),
      balanceAfter: t.balanceAfter.toString(),
      amountINR: (Number(t.amountPaise) / 100).toFixed(2),
    }));
  }
}

