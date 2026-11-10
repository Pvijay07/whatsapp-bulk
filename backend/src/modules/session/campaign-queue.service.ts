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

/**
 * Golden Rule 5: Box-Muller Gaussian Jitter Generator.
 * Transforms uniform random variables into a normal distribution centered at meanSec,
 * bounded between minSec and maxSec. Prevents machine-pattern detection by Meta heuristics.
 */
export function getGaussianJitter(
  meanSec: number,
  stdDevSec = 6,
  minSec = 18,
  maxSec = 65,
): number {
  let u1 = Math.random();
  let u2 = Math.random();
  while (u1 === 0) u1 = Math.random(); // avoid log(0)
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const sample = meanSec + z0 * stdDevSec;
  return Math.max(minSec, Math.min(maxSec, Math.round(sample)));
}

@Injectable()
export class CampaignQueueService implements OnModuleInit {
  private readonly logger = new Logger(CampaignQueueService.name);
  private campaigns: Map<string, QueuedCampaign> = new Map();
  private isWorkerRunning = false;
  private readonly storageFilePath: string;

  constructor(private readonly baileysService: BaileysSessionService) {
    const baseDir =
      process.env.DATA_DIR ||
      (fs.existsSync('d:\\vijay\\whatsapp-bulk\\backend')
        ? 'd:\\vijay\\whatsapp-bulk\\backend'
        : fs.existsSync(path.resolve(process.cwd(), 'backend'))
        ? path.resolve(process.cwd(), 'backend')
        : process.cwd());
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
        this.logger.log(`Loaded ${this.campaigns.size} campaign(s) from disk store.`);
      }
    } catch (e: any) {
      this.logger.error(`Failed to load campaigns store: ${e.message}`);
    }
  }

  private persistToDisk() {
    try {
      const data = Array.from(this.campaigns.values());
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e: any) {
      this.logger.error(`Failed to persist campaigns store: ${e.message}`);
    }
  }

  /**
   * Enqueues a full bulk campaign onto the asynchronous server queue.
   * Golden Rule 5: Default pacing is set to 25s Gaussian delay with 5-minute coffee break every 25 messages.
   */
  async enqueueCampaign(payload: {
    campaignName?: string;
    senderNumber?: string;
    dispatchType?: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
    senderPoolCount?: number;
    customMessageText: string;
    buttons?: Array<{ id?: string; type: string; text: string; value?: string }>;
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
    // Golden Rule 5: Default to 25s Gaussian base delay (range 18s - 65s)
    const delaySec = Math.max(15, payload.delayIntervalSec || 25);
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
      senderNumber: payload.senderNumber || session.connectedNumber || '918897727709',
      dispatchType: payload.dispatchType || 'DEDICATED_NUMBER',
      senderPoolCount: payload.senderPoolCount || 1,
      status: 'SENDING',
      customMessageText: payload.customMessageText || '',
      buttons: payload.buttons || [],
      media: payload.media || null,
      delayIntervalSec: delaySec,
      minJitterSec: 18,
      maxJitterSec: 65,
      batchCooldownAfter: 25, // Golden Rule 5: Pause / Cooldown after every 25 messages
      batchCooldownSec: 300, // Golden Rule 5: 5-minute coffee break (300 seconds)
      spintaxEnabled: payload.spintaxEnabled !== false,
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
      `🚀 Enqueued campaign "${campaign.name}" (${campaignId}) with ${campaign.totalContacts} recipients. Background anti-ban worker starting...`,
    );

    // Trigger async worker without blocking HTTP response
    this.triggerWorker();

    return {
      success: true,
      campaignId,
      name: campaign.name,
      totalQueued: campaign.totalContacts,
      status: campaign.status,
      message: `Campaign enqueued successfully with 6 Golden Rules anti-ban protection. Safe to close browser.`,
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
   * Processes a single campaign's queued messages with Gaussian anti-ban pacing & coffee breaks.
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

      // Golden Rule 5: Randomized Gaussian Jitter (e.g. mean 25s, bounded 18s - 65s)
      const baseMean = Math.max(18, campaign.delayIntervalSec || 25);
      const gaussianDelaySec = getGaussianJitter(baseMean, 6, 18, 65);
      this.logger.log(`⏳ Anti-Ban Pacing: Waiting ${gaussianDelaySec}s Gaussian delay before next message...`);
      await new Promise((r) => setTimeout(r, gaussianDelaySec * 1000));

      // Re-check status after sleep
      if ((campaign.status as string) === 'PAUSED' || (campaign.status as string) === 'CANCELLED') {
        break;
      }

      // Parameter substitution ({{1}} -> recipient name)
      let text = campaign.customMessageText.replace(/\{\{1\}\}/g, msg.recipientName || 'Customer');

      // Golden Rule 4: Spintax resolution {Hello|Hi|Greetings}
      if (campaign.spintaxEnabled) {
        text = this.baileysService.resolveSpintax(text);
      }

      msg.status = 'SENDING';

      // REAL TRANSMISSION via Baileys Multi-Device WebSocket
      // Multi-Number Pool automatically rotates across all online WhatsApp accounts
      const preferredSender =
        campaign.dispatchType === 'MULTI_NUMBER_POOL' || campaign.senderNumber === 'MULTI_NUMBER_POOL'
          ? 'AUTO'
          : campaign.senderNumber;

      const res = await this.baileysService.sendRealMessage(
        msg.recipientPhoneNumber,
        text,
        campaign.buttons,
        campaign.media,
        preferredSender,
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

      // Golden Rule 5: 25-message Cooldown / Coffee Break Safeguard
      // Protects account health against Meta's sliding window heuristic filters
      if (sentSinceLastCooldown >= (campaign.batchCooldownAfter || 25)) {
        const onlineSessions = this.baileysService.getOnlineSessions();
        if (
          onlineSessions.length > 1 &&
          (campaign.dispatchType === 'MULTI_NUMBER_POOL' || campaign.senderNumber === 'MULTI_NUMBER_POOL')
        ) {
          this.logger.log(
            `🔄 Multi-SIM Pool: 25 messages dispatched on current slot. Rotating automatically to next online SIM in pool without stalling...`,
          );
          sentSinceLastCooldown = 0;
        } else {
          const breakSec = Math.max(60, campaign.batchCooldownSec || 300);
          this.logger.log(
            `☕ Anti-Ban Cooldown: Taking a ${Math.round(breakSec / 60)}-minute coffee break (${breakSec}s) after 25 messages to let WhatsApp algorithmic sliding windows cool down...`,
          );
          sentSinceLastCooldown = 0;
          await new Promise((r) => setTimeout(r, breakSec * 1000));
        }
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
