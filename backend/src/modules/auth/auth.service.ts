import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, OrgStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerOrganization(dto: {
    orgName: string;
    email: string;
    password: string;
  }) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: dto.orgName,
          status: OrgStatus.ACTIVE,
        },
      });

      // 2. Create Owner User
      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          role: UserRole.OWNER,
        },
      });

      // 3. Initialize Wallet
      await tx.wallet.create({
        data: {
          organizationId: org.id,
          currency: 'INR',
          balancePaise: 0n,
          reservedPaise: 0n,
        },
      });

      // Generate JWT
      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        organizationId: org.id,
        role: user.role,
      });

      return {
        accessToken: token,
        organization: { id: org.id, name: org.name },
        user: { id: user.id, email: user.email, role: user.role },
      };
    });
  }

  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase() },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });

    return {
      accessToken: token,
      organization: { id: user.organization.id, name: user.organization.name },
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}

