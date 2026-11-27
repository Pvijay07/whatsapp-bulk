import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { BaileysSessionService } from '../../providers/messaging/baileys-session.service';
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

@Injectable()
export class SalesBusterFollowupsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SalesBusterFollowupsService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongoService: SalesBusterMongoService,
    private readonly baileysService: BaileysSessionService,
  ) {}

  onModuleInit() {
    if (!this.mongoService.isConfigured()) {
      this.logger.log(
        'SALESBUSTER_MONGO_URI not set; automatic MongoDB follow-up polling is disabled until configured.',
      );
      return;
    }

    const intervalMs = Number(process.env.SALESBUSTER_FOLLOWUP_POLL_MS || 5 * 60 * 1000);
    this.logger.log(`Starting SalesBuster MongoDB follow-up scheduler (every ${Math.round(intervalMs / 1000)}s)`);

    setTimeout(() => {
      this.runFollowupCycle().catch((err) =>
        this.logger.error(`Initial follow-up cycle failed: ${err.message}`),
      );
    }, 15000);

    this.pollTimer = setInterval(() => {
      this.runFollowupCycle().catch((err) =>
        this.logger.error(`Scheduled follow-up cycle failed: ${err.message}`),
      );
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

  async generateStageMessage(
    lead: SalesBusterLead,
    org: SalesBusterOrg,
    stage: FollowupStage,
    attemptNumber: number,
  ): Promise<string> {
    const leadName = lead.name?.trim() || 'there';
    const service = lead.service?.trim() || 'our services';
    const company = org.aiSettings?.companyName || org.name || 'Petsfolio';

    const fallbackMap: Record<FollowupStage, string> = {
      new_lead: `Hi ${leadName}! Thank you for reaching out to ${company} regarding *${service}*. How can we help you today?`,
      not_attended: `Hi ${leadName}, we noticed we missed connecting with you earlier about *${service}* at ${company}. Are you still looking for assistance?`,
      followup: `Hi ${leadName}, just following up as scheduled regarding *${service}* with ${company}. Let us know a good time to connect!`,
      not_responding: `Hi ${leadName}, checking in (follow-up #${attemptNumber}) regarding your *${service}* enquiry with ${company}. Reply anytime if you'd like details!`,
      marketing_drip: `Hi ${leadName}! Sharing a quick update from ${company} on *${service}* and our latest offers. Reply here if you'd like us to share details!`,
    };

    const geminiKey =
      process.env.GEMINI_API_KEY || decryptSalesBusterKey(org.aiSettings?.geminiApiKey);
    if (!geminiKey) {
      return formatWhatsAppReplyText(fallbackMap[stage]);
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
      return formatWhatsAppReplyText(aiText || fallbackMap[stage]);
    } catch {
      return formatWhatsAppReplyText(fallbackMap[stage]);
    }
  }

  async runFollowupCycle(): Promise<{
    processedOrgs: number;
    evaluatedLeads: number;
    sentCount: number;
    failedCount: number;
    skippedCount: number;
  }> {
    if (this.isRunning) {
      return { processedOrgs: 0, evaluatedLeads: 0, sentCount: 0, failedCount: 0, skippedCount: 0 };
    }

    this.isRunning = true;
    const summary = {
      processedOrgs: 0,
      evaluatedLeads: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
    };

    try {
      const orgs = await this.mongoService.fetchActiveOrganizations();
      summary.processedOrgs = orgs.length;

      for (const org of orgs) {
        const leads = await this.mongoService.fetchEligibleLeads(org.tenantDbName);
        for (const lead of leads) {
          summary.evaluatedLeads++;
          const outcome = await this.processSingleLead(lead, org);
          if (outcome === 'SENT') summary.sentCount++;
          else if (outcome === 'FAILED') summary.failedCount++;
          else summary.skippedCount++;
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

    const sendRes = await this.baileysService.sendRealMessage(phone, messageText);

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
    const [reports, counts] = await Promise.all([
      this.prisma.followupDispatchReport.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take: Math.min(limit, 500),
      }),
      this.prisma.followupDispatchReport.groupBy({
        by: ['stage', 'deliveryStatus'],
        _count: { _all: true },
      }),
    ]);

    return {
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
