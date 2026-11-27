import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { BaileysSessionService } from '../../providers/messaging/baileys-session.service';
import { getGaussianJitter } from '../session/campaign-queue.service';
import {
  SalesBusterLead,
  SalesBusterMessage,
  SalesBusterMongoService,
  SalesBusterOrg,
} from './salesbuster-mongo.service';

export function formatWhatsAppReplyText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let formatted = text;
  formatted = formatted.replace(/([:?!])\s*(\b1\.\s+)/g, '$1\n$2');
  formatted = formatted.replace(/([^\n])\s+(\b\d+\.\s+)/g, '$1\n$2');
  formatted = formatted.replace(/([^\n])\s+([•\-\*]\s+)/g, '$1\n$2');
  formatted = formatted.replace(
    /((\b\d+\.|[•\-\*])\s+[^\n.?!]+[.?!])\s+([A-Z\p{Extended_Pictographic}])/gu,
    '$1\n\n$3',
  );
  return formatted;
}

function decryptSalesBusterKey(encryptedText?: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText || '';
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) return '';
  try {
    const [ivHex, cipherHex] = encryptedText.split(':');
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

export type FollowupStage =
  | 'new_lead'
  | 'not_attended'
  | 'followup'
  | 'not_responding'
  | 'marketing_drip';

export interface FollowupCampaignConfig {
  autoPollingEnabled: boolean;
  maxPerSimPerCycle: number;
  mode: 'TEMPLATE' | 'AI_PLUS_TEMPLATE';
  dispatchType: 'MULTI_NUMBER_POOL' | 'DEDICATED_NUMBER';
  senderNumber: string;
  delayIntervalSec: number;
  batchCooldownAfter: number;
  batchCooldownSec: number;
  spintaxEnabled: boolean;
  buttonEnabled: boolean;
  buttonText: string;
  buttonValue: string;
  stageTemplates: Record<FollowupStage, string>;
}

const DEFAULT_STAGE_TEMPLATES: Record<FollowupStage, string> = {
  new_lead:
    "{Hi|Hello|Dear} {{1}}! 🐾\nThank you for reaching out to {{company}} regarding *{{service}}*.\n{Looking for Walking, Grooming, Training or Pet Sitting services? Book your pet's favourite service with Petsfolio today!|Give your furry friend the care they deserve with Petsfolio. 📲 Explore our services now!}",
  not_attended:
    '{Hi|Hello} {{1}}! 🐶\nWe noticed we missed connecting with you earlier about *{{service}}* at {{company}}.\nBusy with your daily schedule? Petsfolio is here to take care of your furry friend. 🐾 Book your service today!',
  followup:
    '{Hi|Hello|Dear} {{1}}, 🐕\nJust following up as scheduled regarding *{{service}}* with {{company}}.\nFrom daily walks to grooming, training and sitting, Petsfolio makes pet care easier. 📲 Book Now!',
  not_responding:
    "{Hi|Hello|Dear} {{1}}! {🐾|🐶|❤️}\nChecking in regarding your *{{service}}* enquiry with {{company}}.\n{Looking for Walking, Grooming, Training or Pet Sitting services? Book your pet's favourite service with Petsfolio today!|Give your furry friend the care they deserve with Petsfolio. 📲 Explore our services now!|Busy with your daily schedule? Petsfolio is here to take care of your furry friend. 🐾 Book your service today!}",
  marketing_drip:
    "{Hi|Hello|Dear} Pet Parent! {🐾|🐶|❤️|🐕}\n{Looking for Walking, Grooming, Training or Pet Sitting services? Book your pet's favourite service with Petsfolio today!|Give your furry friend the care they deserve with Petsfolio. 📲 Explore our services now!|Busy with your daily schedule? Petsfolio is here to take care of your furry friend. 🐾 Book your service today!|From daily walks to grooming, training and sitting, Petsfolio makes pet care easier. 📲 Book Now!|Happy pets begin with quality care. Discover convenient pet care services with Petsfolio. 📲 Open the Petsfolio App & Book Today!}",
};

@Injectable()
export class SalesBusterFollowupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SalesBusterFollowupsService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private stopRequested = false;
  private readonly configFilePath: string;
  private config: FollowupCampaignConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongoService: SalesBusterMongoService,
    private readonly baileysService: BaileysSessionService,
  ) {
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
    this.configFilePath = path.join(dataDir, 'followup_settings.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): FollowupCampaignConfig {
    const defaults: FollowupCampaignConfig = {
      autoPollingEnabled: false,
      maxPerSimPerCycle: 30,
      mode: 'TEMPLATE',
      dispatchType: 'MULTI_NUMBER_POOL',
      senderNumber: 'MULTI_NUMBER_POOL',
      delayIntervalSec: 28,
      batchCooldownAfter: 15,
      batchCooldownSec: 300,
      spintaxEnabled: true,
      buttonEnabled: true,
      buttonText: 'WhatsApp Now',
      buttonValue: '917997887788',
      stageTemplates: { ...DEFAULT_STAGE_TEMPLATES },
    };
    try {
      if (fs.existsSync(this.configFilePath)) {
        const raw = JSON.parse(fs.readFileSync(this.configFilePath, 'utf8'));
        return {
          ...defaults,
          ...raw,
          stageTemplates: {
            ...DEFAULT_STAGE_TEMPLATES,
            ...(raw.stageTemplates || {}),
          },
        };
      }
    } catch (e: any) {
      this.logger.warn(`Failed to load followup_settings.json: ${e.message}`);
    }
    return defaults;
  }

  getConfig(): FollowupCampaignConfig {
    return this.config;
  }

  updateConfig(partial: Partial<FollowupCampaignConfig>): FollowupCampaignConfig {
    this.config = {
      ...this.config,
      ...partial,
      stageTemplates: {
        ...this.config.stageTemplates,
        ...(partial.stageTemplates || {}),
      },
    };
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e: any) {
      this.logger.warn(`Failed to save followup_settings.json: ${e.message}`);
    }
    return this.config;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  triggerBackgroundRun(selectedKeys?: string[]): { started: boolean; isRunning: boolean; message: string } {
    if (this.isRunning) {
      return {
        started: false,
        isRunning: true,
        message: 'Follow-up campaign dispatch is already running in background.',
      };
    }
    this.stopRequested = false;
    setImmediate(() => {
      this.runFollowupCycle(selectedKeys).catch((err) =>
        this.logger.error(`Background follow-up cycle failed: ${err.message}`),
      );
    });
    return {
      started: true,
      isRunning: true,
      message: selectedKeys?.length
        ? `Follow-up dispatch started for ${selectedKeys.length} selected lead(s) with anti-ban pacing.`
        : 'Follow-up dispatch started in background with campaign templates & anti-ban pacing.',
    };
  }

  async previewDueLeads(now: Date = new Date()): Promise<{
    totalEvaluated: number;
    dueCount: number;
    onlineSimsCount: number;
    maxPerSimCap: number;
    dueLeads: Array<{
      key: string;
      orgId: string;
      orgName: string;
      tenantDbName: string;
      mongoLeadId: string;
      leadName: string;
      phone: string;
      service: string;
      stage: FollowupStage;
      nextAttempt: number;
    }>;
  }> {
    const onlineSimsCount = Math.max(
      0,
      typeof (this.baileysService as any).getOnlineSessions === 'function'
        ? this.baileysService.getOnlineSessions().length
        : 0,
    );
    const maxPerSimCap = this.config.maxPerSimPerCycle || 30;
    const dueLeads: Array<{
      key: string;
      orgId: string;
      orgName: string;
      tenantDbName: string;
      mongoLeadId: string;
      leadName: string;
      phone: string;
      service: string;
      stage: FollowupStage;
      nextAttempt: number;
    }> = [];
    let totalEvaluated = 0;

    const orgs = await this.mongoService.fetchActiveOrganizations();
    for (const org of orgs) {
      const leads = await this.mongoService.fetchEligibleLeads(org.tenantDbName);
      for (const lead of leads) {
        totalEvaluated++;
        const stage = this.resolveLeadStage(lead, now);
        if (!stage) continue;

        const phone = lead.phoneNormalized || lead.phone;
        if (!phone) continue;

        const existingState = await this.prisma.leadFollowupState.findUnique({
          where: {
            tenantDbName_mongoLeadId_stage: {
              tenantDbName: org.tenantDbName,
              mongoLeadId: lead._id,
              stage,
            },
          },
        });

        if (existingState) {
          if (existingState.status === 'COMPLETED' || existingState.status === 'SKIPPED') {
            continue;
          }
          if (existingState.nextDueAt && existingState.nextDueAt > now) {
            continue;
          }
        }

        dueLeads.push({
          key: `${org.tenantDbName}:${lead._id}:${stage}`,
          orgId: org._id,
          orgName: org.name,
          tenantDbName: org.tenantDbName,
          mongoLeadId: lead._id,
          leadName: lead.name?.trim() || phone,
          phone,
          service: lead.service?.trim() || 'General',
          stage,
          nextAttempt: (existingState?.attemptCount || 0) + 1,
        });
      }
    }

    return {
      totalEvaluated,
      dueCount: dueLeads.length,
      onlineSimsCount,
      maxPerSimCap,
      dueLeads,
    };
  }

  stopFollowupCycle(): { success: boolean; message: string } {
    this.stopRequested = true;
    if (this.config.autoPollingEnabled) {
      this.updateConfig({ autoPollingEnabled: false });
    }
    this.logger.warn('🛑 Follow-up dispatch STOP requested by user. Halting loop & disabling auto-polling.');
    return {
      success: true,
      message: 'Stop requested. Current cycle will halt and auto-polling is disabled.',
    };
  }

  async clearFollowupData(): Promise<{ success: boolean; deletedReports: number; deletedStates: number }> {
    const [delReports, delStates] = await Promise.all([
      this.prisma.followupDispatchReport.deleteMany({}),
      this.prisma.leadFollowupState.deleteMany({}),
    ]);
    this.logger.warn(
      `🧹 Cleared SalesBuster follow-up data: ${delReports.count} reports, ${delStates.count} lead states removed.`,
    );
    return {
      success: true,
      deletedReports: delReports.count,
      deletedStates: delStates.count,
    };
  }

  onModuleInit() {
    if (!this.mongoService.isConfigured()) {
      this.logger.log(
        'SALESBUSTER_MONGO_URI not set; automatic MongoDB follow-up polling is disabled until configured.',
      );
      return;
    }

    const intervalMs = Number(process.env.SALESBUSTER_FOLLOWUP_POLL_MS || 5 * 60 * 1000);
    this.logger.log(
      `SalesBuster MongoDB follow-up scheduler ready (Auto-Polling: ${this.config.autoPollingEnabled ? 'ON' : 'OFF (Manual Run Only)'})`,
    );

    if (this.config.autoPollingEnabled) {
      setTimeout(() => {
        if (this.config.autoPollingEnabled) {
          this.runFollowupCycle().catch((err) =>
            this.logger.error(`Initial follow-up cycle failed: ${err.message}`),
          );
        }
      }, 15000);
    }

    this.pollTimer = setInterval(() => {
      if (this.config.autoPollingEnabled && !this.isRunning) {
        this.runFollowupCycle().catch((err) =>
          this.logger.error(`Scheduled follow-up cycle failed: ${err.message}`),
        );
      }
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  resolveLeadStage(lead: SalesBusterLead, now: Date = new Date()): FollowupStage | null {
    const status = String(lead.status || '').trim().toLowerCase();
    const folder = String(lead.folder || '').trim().toLowerCase();

    if (folder === 'future leads' || status === 'future leads') {
      return 'marketing_drip';
    }
    if (folder === 'not responding' || status === 'not responding') {
      return 'not_responding';
    }
    if (folder === 'not attended' || status === 'not attended') {
      return 'not_attended';
    }
    if (status === 'follow up' || folder === 'upcoming followup') {
      if (!lead.nextFollowUp) return null;
      const todayStr = now.toISOString().slice(0, 10);
      if (lead.nextFollowUp > todayStr) return null;
      if (lead.nextFollowUp === todayStr && lead.followupTime) {
        const [h, m] = lead.followupTime.split(':').map(Number);
        if (!Number.isNaN(h) && !Number.isNaN(m)) {
          const scheduled = new Date(now);
          scheduled.setHours(h, m, 0, 0);
          const diffMin = (scheduled.getTime() - now.getTime()) / (1000 * 60);
          if (diffMin > 30) return null;
        }
      }
      return 'followup';
    }
    if (status === 'new' || folder === 'new leads') {
      return 'new_lead';
    }
    return null;
  }

  async fetchQdrantKbContext(
    org: SalesBusterOrg,
    queryText: string,
    geminiKey: string,
  ): Promise<string> {
    const qdrantUrl = process.env.CLUSTER_ENDPOINT;
    const qdrantApiKey = process.env.QDRANT_API_KEY;
    if (!qdrantUrl || !qdrantApiKey || !geminiKey) return '';

    const collectionName = org.aiSettings?.qdrantCollection || `org_${org._id}_kb`;
    try {
      const embRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${geminiKey}`,
        { content: { parts: [{ text: queryText }] } },
        { timeout: 6000 },
      );
      const vector = embRes.data?.embedding?.values;
      if (!Array.isArray(vector) || vector.length === 0) return '';

      const searchRes = await axios.post(
        `${qdrantUrl.replace(/\/$/, '')}/collections/${collectionName}/points/search`,
        { vector, limit: 5, with_payload: true },
        {
          headers: { 'api-key': qdrantApiKey, 'Content-Type': 'application/json' },
          timeout: 6000,
        },
      );
      const hits = Array.isArray(searchRes.data?.result) ? searchRes.data.result : [];
      return hits
        .map((h: any) => h?.payload?.content || h?.payload?.pageContent || h?.payload?.text || '')
        .filter(Boolean)
        .join('\n\n');
    } catch {
      return '';
    }
  }

  private renderStageTemplate(
    stage: FollowupStage,
    leadName: string,
    service: string,
    company: string,
  ): string {
    const rawTemplate =
      this.config.stageTemplates?.[stage] || DEFAULT_STAGE_TEMPLATES[stage];
    let rendered = rawTemplate
      .replace(/\{\{1\}\}/g, leadName)
      .replace(/\{\{name\}\}/gi, leadName)
      .replace(/\{\{service\}\}/gi, service)
      .replace(/\{\{company\}\}/gi, company);

    if (this.config.spintaxEnabled !== false) {
      if (typeof (this.baileysService as any).resolveSpintax === 'function') {
        rendered = this.baileysService.resolveSpintax(rendered);
      } else {
        const spintaxRegex = /\{([^{}]+)\}/g;
        while (spintaxRegex.test(rendered)) {
          rendered = rendered.replace(spintaxRegex, (_, choices) => {
            const options = choices.split('|');
            return options[Math.floor(Math.random() * options.length)];
          });
        }
      }
    }
    return rendered;
  }

  async generateStageMessage(
    lead: SalesBusterLead,
    org: SalesBusterOrg,
    stage: FollowupStage,
    attemptNumber: number,
  ): Promise<string> {
    const leadName = lead.name?.trim() || 'there';
    const service = lead.service?.trim() || 'our services';
    const company = org.aiSettings?.companyName || org.name || 'Petsfolio';

    const templateText = this.renderStageTemplate(stage, leadName, service, company);

    // Campaign-style Template Mode: send exact Petsfolio Spintax template directly
    if (this.config.mode === 'TEMPLATE') {
      return templateText;
    }

    const geminiKey =
      process.env.GEMINI_API_KEY || decryptSalesBusterKey(org.aiSettings?.geminiApiKey);
    if (!geminiKey) {
      return formatWhatsAppReplyText(templateText);
    }

    try {
      const [ragContext, recentMessages] = await Promise.all([
        this.fetchQdrantKbContext(org, `${service} ${stage}`, geminiKey),
        typeof (this.mongoService as any).fetchRecentLeadMessages === 'function'
          ? this.mongoService.fetchRecentLeadMessages(org.tenantDbName, lead._id, 6)
          : Promise.resolve([] as SalesBusterMessage[]),
      ]);

      const servicesList = Array.isArray(org.aiSettings?.services) ? org.aiSettings!.services : [];
      const servicesBlock =
        servicesList.length > 0
          ? 'CORE PRODUCTS & SERVICES:\n' +
            servicesList
              .map((s, idx) =>
                typeof s === 'string'
                  ? `${idx + 1}. ${s}`
                  : `${idx + 1}. ${s.name}${s.description ? `: ${s.description}` : ''}`,
              )
              .join('\n')
          : '';

      const historyBlock =
        recentMessages.length > 0
          ? 'RECENT CHAT HISTORY:\n' +
            recentMessages
              .map((m) => `${m.direction === 'outgoing' ? 'Agent' : 'Client'}: ${m.text || ''}`)
              .join('\n')
          : '';

      const customRules =
        org.aiSettings?.customInstructions ||
        `1. HUMAN TONE: Communicate warmly, politely, and conversationally. Never say you are an AI or bot.\n2. PACING: Ask at most 1-2 questions.\n3. WHATSAPP FORMATTING: Keep messages short (maximum 50-60 words), clean bullet points, bold key terms (*term*), and emojis.`;

      const prompt = [
        `You are a ${org.aiSettings?.agentPersona || 'friendly, human sales representative'} for "${company}".`,
        org.aiSettings?.businessDescription ? `BUSINESS DESCRIPTION:\n${org.aiSettings.businessDescription}` : '',
        servicesBlock,
        ragContext ? `KNOWLEDGE BASE CONTEXT:\n${ragContext}` : '',
        historyBlock,
        `INSTRUCTIONS:\n${customRules}`,
        `TASK: Write a WhatsApp ${stage} message (attempt #${attemptNumber}) for customer "${leadName}" interested in "${service}". Output ONLY the WhatsApp message text.`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 8000 },
      );
      const aiText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return formatWhatsAppReplyText(aiText || templateText);
    } catch {
      return formatWhatsAppReplyText(templateText);
    }
  }

  async runFollowupCycle(selectedKeys?: string[]): Promise<{
    processedOrgs: number;
    evaluatedLeads: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
  }> {
    if (this.isRunning) {
      return { processedOrgs: 0, evaluatedLeads: 0, sentCount: 0, failedCount: 0, skippedCount: 0 };
    }

    const selectedSet =
      Array.isArray(selectedKeys) && selectedKeys.length > 0 ? new Set(selectedKeys) : null;

    this.isRunning = true;
    this.stopRequested = false;
    const summary = {
      processedOrgs: 0,
      evaluatedLeads: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
    };
    let sentSinceCooldown = 0;
    const onlineSessionsCount = Math.max(
      1,
      typeof (this.baileysService as any).getOnlineSessions === 'function'
        ? this.baileysService.getOnlineSessions().length
        : 1,
    );
    const maxLeadsThisCycle = onlineSessionsCount * (this.config.maxPerSimPerCycle || 30);

    try {
      const orgs = await this.mongoService.fetchActiveOrganizations();
      summary.processedOrgs = orgs.length;

      for (const org of orgs) {
        if (this.stopRequested || summary.sentCount >= maxLeadsThisCycle) break;
        const leads = await this.mongoService.fetchEligibleLeads(org.tenantDbName);
        for (const lead of leads) {
          if (this.stopRequested || summary.sentCount >= maxLeadsThisCycle) break;
          if (selectedSet) {
            const st = this.resolveLeadStage(lead);
            const k = st ? `${org.tenantDbName}:${lead._id}:${st}` : '';
            if (!st || !selectedSet.has(k)) {
              summary.skippedCount++;
              continue;
            }
          }
          summary.evaluatedLeads++;
          const outcome = await this.processSingleLead(lead, org);
          if (outcome === 'SENT') {
            summary.sentCount++;
            sentSinceCooldown++;
            if (this.stopRequested) break;

            // Coffee break cooldown (same as Campaigns)
            const cooldownAfter = this.config.batchCooldownAfter || 15;
            if (sentSinceCooldown >= cooldownAfter) {
              const breakSec = Math.max(60, this.config.batchCooldownSec || 300);
              this.logger.log(
                `☕ Follow-up Anti-Ban Cooldown: Sent ${sentSinceCooldown} messages. Taking a ${Math.round(breakSec / 60)}-minute coffee break (${breakSec}s)...`,
              );
              sentSinceCooldown = 0;
              await new Promise((r) => setTimeout(r, breakSec * 1000));
            } else {
              // 25-30s Box-Muller Gaussian pacing between follow-ups (same as Campaigns)
              const baseMean = Math.max(18, this.config.delayIntervalSec || 28);
              const gaussianDelaySec = getGaussianJitter(baseMean, 6, 18, 65);
              this.logger.log(`⏳ Follow-up Anti-Ban Pacing: Waiting ${gaussianDelaySec}s before next lead...`);
              await new Promise((r) => setTimeout(r, gaussianDelaySec * 1000));
            }
          } else if (outcome === 'FAILED') {
            summary.failedCount++;
          } else {
            summary.skippedCount++;
          }
        }
      }
    } finally {
      this.isRunning = false;
    }

    return summary;
  }

  async processSingleLead(
    lead: SalesBusterLead,
    org: SalesBusterOrg,
    now: Date = new Date(),
  ): Promise<'SENT' | 'FAILED' | 'SKIPPED'> {
    const stage = this.resolveLeadStage(lead, now);
    if (!stage) return 'SKIPPED';

    const phone = lead.phoneNormalized || lead.phone;
    if (!phone) return 'SKIPPED';

    const existingState = await this.prisma.leadFollowupState.findUnique({
      where: {
        tenantDbName_mongoLeadId_stage: {
          tenantDbName: org.tenantDbName,
          mongoLeadId: lead._id,
          stage,
        },
      },
    });

    if (existingState) {
      if (existingState.status === 'COMPLETED' || existingState.status === 'SKIPPED') {
        return 'SKIPPED';
      }
      if (existingState.nextDueAt && existingState.nextDueAt > now) {
        return 'SKIPPED';
      }
    }

    const nextAttempt = (existingState?.attemptCount || 0) + 1;
    const messageText = await this.generateStageMessage(lead, org, stage, nextAttempt);

    const buttons =
      this.config.buttonEnabled !== false
        ? [
            {
              id: 'btn-interactive',
              type: 'QUICK_REPLY',
              text: this.config.buttonText || 'WhatsApp Now',
              value: this.config.buttonValue || '917997887788',
            },
          ]
        : [];
    const preferredSender =
      this.config.dispatchType === 'MULTI_NUMBER_POOL' ||
      this.config.senderNumber === 'MULTI_NUMBER_POOL'
        ? 'AUTO'
        : this.config.senderNumber;

    const sendRes = await this.baileysService.sendRealMessage(
      phone,
      messageText,
      buttons,
      undefined,
      preferredSender,
    );

    const workflow = org.workflowSettings || {};
    const maxNotResponding = workflow.notRespondingMaxFollowups || 5;
    const notRespondingIntervals = workflow.notRespondingIntervalDays || [1, 3, 6, 10, 15];
    const dripDays = workflow.futureLeadsDripIntervalDays || 15;

    let nextStatus = 'ACTIVE';
    let nextDueAt: Date | null = null;

    if (stage === 'new_lead' || stage === 'not_attended' || stage === 'followup') {
      nextStatus = 'COMPLETED';
    } else if (stage === 'not_responding') {
      if (nextAttempt >= maxNotResponding) {
        nextStatus = 'COMPLETED';
      } else {
        const days = notRespondingIntervals[Math.min(nextAttempt, notRespondingIntervals.length - 1)] || 3;
        nextDueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      }
    } else if (stage === 'marketing_drip') {
      nextStatus = 'ACTIVE';
      nextDueAt = new Date(now.getTime() + dripDays * 24 * 60 * 60 * 1000);
    }

    // Store state & report strictly in bulk.petsfolio PostgreSQL (zero writes to MongoDB)
    await this.prisma.leadFollowupState.upsert({
      where: {
        tenantDbName_mongoLeadId_stage: {
          tenantDbName: org.tenantDbName,
          mongoLeadId: lead._id,
          stage,
        },
      },
      create: {
        orgId: org._id,
        tenantDbName: org.tenantDbName,
        mongoLeadId: lead._id,
        phone,
        stage,
        attemptCount: sendRes.success ? nextAttempt : 0,
        status: sendRes.success ? nextStatus : 'ACTIVE',
        lastSentAt: sendRes.success ? now : null,
        nextDueAt: sendRes.success ? nextDueAt : new Date(now.getTime() + 60 * 60 * 1000),
      },
      update: {
        phone,
        attemptCount: sendRes.success ? nextAttempt : existingState?.attemptCount || 0,
        status: sendRes.success ? nextStatus : 'ACTIVE',
        lastSentAt: sendRes.success ? now : existingState?.lastSentAt || null,
        nextDueAt: sendRes.success ? nextDueAt : new Date(now.getTime() + 60 * 60 * 1000),
      },
    });

    await this.prisma.followupDispatchReport.create({
      data: {
        orgId: org._id,
        orgName: org.name,
        tenantDbName: org.tenantDbName,
        mongoLeadId: lead._id,
        leadName: lead.name || phone,
        phone,
        stage,
        attemptNumber: nextAttempt,
        messageText,
        senderNumber: sendRes.senderNumber || null,
        providerMessageId: sendRes.messageId || null,
        deliveryStatus: sendRes.success ? 'SENT' : 'FAILED',
        errorMessage: sendRes.success ? null : sendRes.error || 'WhatsApp dispatch failed',
        sentAt: now,
      },
    });

    return sendRes.success ? 'SENT' : 'FAILED';
  }

  async getReports(stage?: string, limit = 100) {
    const where = stage && stage !== 'ALL' ? { stage } : {};
    const reports = await this.prisma.followupDispatchReport.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: Math.min(limit, 500),
    });

    // Sync real delivery & read receipts from Baileys sockets
    const receipts =
      typeof (this.baileysService as any).getMessageStatuses === 'function'
        ? this.baileysService.getMessageStatuses()
        : null;

    if (receipts) {
      for (const r of reports) {
        if (r.providerMessageId && receipts.has(r.providerMessageId)) {
          const item = receipts.get(r.providerMessageId)!;
          if (
            (item.status === 'DELIVERED' && r.deliveryStatus === 'SENT') ||
            (item.status === 'READ' && r.deliveryStatus !== 'READ')
          ) {
            r.deliveryStatus = item.status;
            this.prisma.followupDispatchReport
              .update({
                where: { id: r.id },
                data: { deliveryStatus: item.status },
              })
              .catch(() => {});
          }
        }
      }
    }

    const counts = await this.prisma.followupDispatchReport.groupBy({
      by: ['stage', 'deliveryStatus'],
      _count: { _all: true },
    });

    return {
      isRunning: this.isRunning,
      reports,
      summary: counts.map((c) => ({
        stage: c.stage,
        deliveryStatus: c.deliveryStatus,
        count: c._count._all,
      })),
    };
  }

  async getStates(limit = 100) {
    return this.prisma.leadFollowupState.findMany({
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }
}
