import { Injectable, Logger, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BaileysSessionService } from '../../providers/messaging/baileys-session.service';

export interface QueuedMessage {
  id: string;
  campaignId: string;
  recipientPhoneNumber: string;
  recipientName: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'CANCELLED';
  providerMessageId?: string;
  sentAt?: string;
  errorCode?: string;
  errorMessage?: string;
  costINR: string;
}

export interface QueuedCampaign {
  id: string;
  name: string;
  senderNumber: string;
  dispatchType: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
  senderPoolCount?: number;
  status: 'QUEUED' | 'SENDING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  customMessageText: string;
  buttons?: Array<{ id?: string; type: string; text: string; value?: string }>;
  media?: {
    base64?: string;
    url?: string;
    mimeType: string;
    fileName: string;
    fileSize?: number;
  } | null;
  delayIntervalSec: number;
  minJitterSec: number;
  maxJitterSec: number;
  batchCooldownAfter: number;
  batchCooldownSec: number;
  spintaxEnabled: boolean;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  reservedINR: string;
  actualCostINR: string;
  createdAt: string;
  updatedAt: string;
  messages: QueuedMessage[];
}

@Injectable()
export class CampaignQueueService implements OnModuleInit {
  private readonly logger = new Logger(CampaignQueueService.name);
  private campaigns: Map<string, QueuedCampaign> = new Map();
  private isWorkerRunning = false;
  private readonly storageFilePath: string;

  constructor(private readonly baileysService: BaileysSessionService) {
    const baseDir = fs.existsSync('d:\\vijay\\whatsapp-bulk\\backend')
      ? 'd:\\vijay\\whatsapp-bulk\\backend'
      : process.cwd();
    const dataDir = path.resolve(baseDir, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.storageFilePath = path.join(dataDir, 'campaign_queue.json');
  }

  onModuleInit() {
    this.loadFromDisk();
    // If any campaign was interrupted in 'SENDING' state, safely resume queue processing
    const hasPending = Array.from(this.campaigns.values()).some(
      (c) => c.status === 'SENDING' && c.messages.some((m) => m.status === 'QUEUED'),
    );
    if (hasPending) {
      this.logger.log('Pending campaigns found on startup. Waking background queue runner...');
      this.triggerWorker();
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf8');
        const data: QueuedCampaign[] = JSON.parse(raw);
        this.campaigns.clear();
        for (const c of data) {
          this.campaigns.set(c.id, c);
        }
        this.logger.log(`Loaded ${this.campaigns.size} campaigns from disk queue storage.`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to load campaign queue from disk: ${err.message}`);
    }
  }

  private persistToDisk() {
    try {
      const data = Array.from(this.campaigns.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err: any) {
      this.logger.error(`Failed to persist campaign queue to disk: ${err.message}`);
    }
  }

  /**
   * Enqueues N numbers of messages into the persistent server-side background queue.
   * Returns immediately so the frontend / user does not need to wait or keep browser open.
   */
  async enqueueCampaign(payload: {
    campaignName: string;
    dispatchType?: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
    senderNumber?: string;
    senderPoolCount?: number;
    customMessageText: string;
    buttons?: any[];
    media?: {
      base64?: string;
      url?: string;
      mimeType: string;
      fileName: string;
      fileSize?: number;
    } | null;
    recipients: Array<{ phoneNumber: string; name?: string }>;
    delayIntervalSec?: number;
    spintaxEnabled?: boolean;
    totalCostINR?: number;
  }) {
    if (!payload.recipients || payload.recipients.length === 0) {
      throw new BadRequestException('Recipient list cannot be empty.');
    }

    const session = this.baileysService.getSessionStatus();
    if (!session.isOnline) {
      throw new BadRequestException(
        'WhatsApp device is not linked or offline. Link your device before enqueuing campaigns.',
      );
    }

    const campaignId = `camp-${Date.now()}`;
    const delaySec = Math.max(1, payload.delayIntervalSec || 5);
    const totalCost = payload.totalCostINR || payload.recipients.length * 1.0;

    const queuedMessages: QueuedMessage[] = payload.recipients.map((rec, idx) => ({
      id: `msg-${Date.now()}-${idx}`,
      campaignId,
      recipientPhoneNumber: rec.phoneNumber,
      recipientName: rec.name || 'Customer',
      status: 'QUEUED',
      costINR: '1.00',
    }));

    const campaign: QueuedCampaign = {
      id: campaignId,
      name: payload.campaignName || `Campaign ${new Date().toLocaleTimeString('en-IN')}`,
      senderNumber: session.connectedNumber || '918897727709',
      dispatchType: payload.dispatchType || 'DEDICATED_NUMBER',
      senderPoolCount: payload.senderPoolCount || 1,
      status: 'SENDING',
      customMessageText: payload.customMessageText || '',
      buttons: payload.buttons || [],
      media: payload.media || null,
      delayIntervalSec: delaySec,
      minJitterSec: 1,
      maxJitterSec: 4,
      batchCooldownAfter: 35, // pause after every 35 messages
      batchCooldownSec: 20, // 20s cooldown pause
      spintaxEnabled: !!payload.spintaxEnabled,
      totalContacts: payload.recipients.length,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      reservedINR: totalCost.toFixed(2),
      actualCostINR: '0.00',
      createdAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      updatedAt: new Date().toISOString(),
      messages: queuedMessages,
    };

    this.campaigns.set(campaignId, campaign);
    this.persistToDisk();

    this.logger.log(
      `🚀 Enqueued campaign "${campaign.name}" (${campaignId}) with ${campaign.totalContacts} recipients. Background worker starting...`,
    );

    // Trigger async worker without blocking HTTP response
    this.triggerWorker();

    return {
      success: true,
      campaignId,
      name: campaign.name,
      totalQueued: campaign.totalContacts,
      status: campaign.status,
      message: `Campaign enqueued successfully on server background worker. Safe to close browser.`,
    };
  }

  /**
   * Triggers the background worker loop if not already running.
   */
  private triggerWorker() {
    if (this.isWorkerRunning) {
      return;
    }
    this.isWorkerRunning = true;
    setImmediate(() => this.runWorkerLoop());
  }

  /**
   * Main Background Queue Processing Loop.
   * Runs inside the server process independently of client connection.
   */
  private async runWorkerLoop() {
    try {
      this.logger.log('Campaign queue background worker started.');

      while (true) {
        // Find active campaign in SENDING state that has remaining QUEUED messages
        const activeCampaign = Array.from(this.campaigns.values()).find(
          (c) => c.status === 'SENDING' && c.messages.some((m) => m.status === 'QUEUED'),
        );

        if (!activeCampaign) {
          // No more active jobs
          break;
        }

        await this.processCampaign(activeCampaign);
      }
    } catch (err: any) {
      this.logger.error(`Unexpected worker loop error: ${err.message}`, err.stack);
    } finally {
      this.isWorkerRunning = false;
      this.logger.log('Campaign queue background worker finished all active jobs.');
    }
  }

  /**
   * Processes a single campaign's queued messages with humanized anti-ban pacing & cooldowns.
   */
  private async processCampaign(campaign: QueuedCampaign) {
    let sentSinceLastCooldown = 0;

    for (let i = 0; i < campaign.messages.length; i++) {
      // Check if campaign was paused or cancelled by user
      if ((campaign.status as string) === 'PAUSED' || (campaign.status as string) === 'CANCELLED') {
        this.logger.log(`Campaign ${campaign.id} is now ${campaign.status}. Stopping processing.`);
        break;
      }

      const msg = campaign.messages[i];
      if (msg.status !== 'QUEUED') {
        continue;
      }

      // Check device connection
      const session = this.baileysService.getSessionStatus();
      if (!session.isOnline) {
        this.logger.warn(`WhatsApp session disconnected. Auto-pausing campaign ${campaign.id}...`);
        campaign.status = 'PAUSED';
        this.persistToDisk();
        break;
      }

      // Anti-Ban Throttling: Base delay + Randomized Jitter (e.g. 5s + 1-4s random = 6s-9s)
      const baseDelay = campaign.delayIntervalSec || 5;
      const jitter =
        Math.floor(Math.random() * (campaign.maxJitterSec - campaign.minJitterSec + 1)) +
        campaign.minJitterSec;
      const totalDelayMs = (baseDelay + jitter) * 1000;

      await new Promise((r) => setTimeout(r, totalDelayMs));

      // Re-check status after sleep
      if ((campaign.status as string) === 'PAUSED' || (campaign.status as string) === 'CANCELLED') {
        break;
      }

      // Parameter substitution ({{1}} -> recipient name)
      let text = campaign.customMessageText.replace(/\{\{1\}\}/g, msg.recipientName || 'Customer');

      // Spintax resolution: {Hello|Hi|Greetings}
      if (campaign.spintaxEnabled) {
        text = text.replace(/\{([^{}]+)\}/g, (_, choices) => {
          const arr = choices.split('|');
          return arr[Math.floor(Math.random() * arr.length)];
        });
      }

      msg.status = 'SENDING';

      // REAL TRANSMISSION via Baileys Multi-Device WebSocket
      const res = await this.baileysService.sendRealMessage(
        msg.recipientPhoneNumber,
        text,
        campaign.buttons,
        campaign.media,
      );

      const now = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (res.success) {
        msg.status = 'SENT';
        msg.providerMessageId = res.messageId;
        msg.sentAt = now;
        campaign.sentCount++;
        sentSinceLastCooldown++;
      } else {
        msg.status = 'FAILED';
        msg.errorCode = res.error?.includes('not registered') ? 'NOT_ON_WHATSAPP' : 'DISPATCH_FAILED';
        msg.errorMessage = res.error || 'Recipient not registered on WhatsApp';
        msg.costINR = '0.00';
        campaign.failedCount++;
      }

      campaign.actualCostINR = (campaign.sentCount * 1.0).toFixed(2);
      campaign.updatedAt = new Date().toISOString();

      // Persist after each send
      this.persistToDisk();

      // Batch cooldown safeguard: pause 20s every 35 messages to protect account health
      if (sentSinceLastCooldown >= campaign.batchCooldownAfter) {
        this.logger.log(
          `🛡️ Anti-ban safeguard: Pausing ${campaign.batchCooldownSec}s after ${sentSinceLastCooldown} messages...`,
        );
        sentSinceLastCooldown = 0;
        await new Promise((r) => setTimeout(r, campaign.batchCooldownSec * 1000));
      }
    }

    // Check completion
    const remaining = campaign.messages.filter((m) => m.status === 'QUEUED').length;
    if (remaining === 0 && campaign.status === 'SENDING') {
      campaign.status = 'COMPLETED';
      this.persistToDisk();
      this.logger.log(
        `🎉 Campaign ${campaign.id} completed! Sent: ${campaign.sentCount}, Failed: ${campaign.failedCount}`,
      );
    }
  }

  /**
   * Syncs real delivery receipts from Baileys session events (DELIVERED, READ)
   */
  private syncReceipts(campaign: QueuedCampaign) {
    const receipts = this.baileysService.getMessageStatuses();
    let deliveredCount = 0;
    let readCount = 0;

    for (const msg of campaign.messages) {
      if (msg.providerMessageId && receipts.has(msg.providerMessageId)) {
        const item = receipts.get(msg.providerMessageId)!;
        if (item.status === 'DELIVERED' && msg.status === 'SENT') {
          msg.status = 'DELIVERED';
        } else if (item.status === 'READ') {
          msg.status = 'READ';
        }
      }
      if (msg.status === 'DELIVERED') deliveredCount++;
      if (msg.status === 'READ') readCount++;
    }

    campaign.deliveredCount = deliveredCount;
    campaign.readCount = readCount;
  }

  /**
   * Get all campaigns with latest sync metrics
   */
  getAllCampaigns(): QueuedCampaign[] {
    const list = Array.from(this.campaigns.values());
    for (const c of list) {
      this.syncReceipts(c);
    }
    // Sort descending by creation
    return list.sort((a, b) => (b.id > a.id ? 1 : -1));
  }

  /**
   * Get single campaign with full messages list
   */
  getCampaign(id: string): QueuedCampaign {
    const campaign = this.campaigns.get(id);
    if (!campaign) {
      throw new NotFoundException(`Campaign ${id} not found.`);
    }
    this.syncReceipts(campaign);
    return campaign;
  }

  /**
   * Pause campaign
   */
  pauseCampaign(id: string) {
    const campaign = this.getCampaign(id);
    if (campaign.status !== 'SENDING' && campaign.status !== 'QUEUED') {
      throw new BadRequestException(`Cannot pause campaign with status: ${campaign.status}`);
    }
    campaign.status = 'PAUSED';
    campaign.updatedAt = new Date().toISOString();
    this.persistToDisk();
    this.logger.log(`Campaign ${id} paused by user.`);
    return { success: true, campaignId: id, status: 'PAUSED' };
  }

  /**
   * Resume campaign
   */
  resumeCampaign(id: string) {
    const campaign = this.getCampaign(id);
    if (campaign.status !== 'PAUSED') {
      throw new BadRequestException(`Cannot resume campaign with status: ${campaign.status}`);
    }
    campaign.status = 'SENDING';
    campaign.updatedAt = new Date().toISOString();
    this.persistToDisk();
    this.logger.log(`Campaign ${id} resumed by user.`);
    this.triggerWorker();
    return { success: true, campaignId: id, status: 'SENDING' };
  }

  /**
   * Cancel campaign
   */
  cancelCampaign(id: string) {
    const campaign = this.getCampaign(id);
    campaign.status = 'CANCELLED';
    for (const msg of campaign.messages) {
      if (msg.status === 'QUEUED') {
        msg.status = 'CANCELLED';
        msg.costINR = '0.00';
      }
    }
    campaign.updatedAt = new Date().toISOString();
    this.persistToDisk();
    this.logger.log(`Campaign ${id} cancelled by user.`);
    return { success: true, campaignId: id, status: 'CANCELLED' };
  }
}
