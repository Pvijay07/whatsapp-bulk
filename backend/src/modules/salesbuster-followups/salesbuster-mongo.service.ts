import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';

export interface SalesBusterOrg {
  _id: string;
  name: string;
  tenantDbName: string;
  workflowSettings?: {
    notRespondingMaxFollowups?: number;
    notRespondingIntervalDays?: number[];
    futureLeadsDripIntervalDays?: number;
    callerReminderMinutesBefore?: number;
  };
  aiSettings?: {
    companyName?: string;
    businessDescription?: string;
    agentPersona?: string;
    customInstructions?: string;
    qdrantCollection?: string;
    geminiApiKey?: string;
    services?: Array<string | { name: string; description?: string }>;
  };
}

export interface SalesBusterMessage {
  direction?: string;
  sender?: string;
  text?: string;
  timestamp?: Date;
}

export interface SalesBusterLead {
  _id: string;
  name?: string;
  phone: string;
  phoneNormalized?: string;
  email?: string;
  service?: string;
  source?: string;
  status?: string;
  folder?: string;
  priorityLevel?: string;
  nextFollowUp?: string;
  followupTime?: string;
  isOptedOut?: boolean;
  aiEnabled?: boolean;
  disableAI?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class SalesBusterMongoService implements OnModuleDestroy {
  private readonly logger = new Logger(SalesBusterMongoService.name);
  private client: MongoClient | null = null;
  private connectingPromise: Promise<MongoClient | null> | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.SALESBUSTER_MONGO_URI);
  }

  private async getClient(): Promise<MongoClient | null> {
    const uri = process.env.SALESBUSTER_MONGO_URI;
    if (!uri) return null;

    if (this.client) return this.client;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      try {
        const client = new MongoClient(uri, {
          readPreference: 'secondaryPreferred',
          serverSelectionTimeoutMS: 8000,
        });
        await client.connect();
        this.client = client;
        this.logger.log('Connected read-only to SalesBuster MongoDB');
        return client;
      } catch (err: any) {
        this.logger.error(`Failed to connect to SalesBuster MongoDB: ${err.message}`);
        return null;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  private getMasterDb(client: MongoClient): Db {
    const masterDbName = process.env.SALESBUSTER_MASTER_DB || undefined;
    return masterDbName ? client.db(masterDbName) : client.db();
  }

  async fetchActiveOrganizations(): Promise<SalesBusterOrg[]> {
    const client = await this.getClient();
    if (!client) return [];

    const db = this.getMasterDb(client);
    const docs = await db
      .collection('organizations')
      .find(
        { status: 'active', tenantDbName: { $exists: true, $nin: ['', null] } },
        { projection: { _id: 1, name: 1, tenantDbName: 1, workflowSettings: 1, aiSettings: 1 } },
      )
      .toArray();

    return docs.map((d: any) => ({
      _id: String(d._id),
      name: d.name || 'Organization',
      tenantDbName: String(d.tenantDbName),
      workflowSettings: d.workflowSettings || {},
      aiSettings: d.aiSettings || {},
    }));
  }

  async fetchEligibleLeads(tenantDbName: string): Promise<SalesBusterLead[]> {
    const client = await this.getClient();
    if (!client || !tenantDbName) return [];

    const db = client.db(tenantDbName);
    const docs = await db
      .collection('leads')
      .find(
        {
          phone: { $exists: true, $nin: ['', null] },
          isOptedOut: { $ne: true },
          disableAI: { $ne: true },
          aiEnabled: { $ne: false },
          status: { $nin: ['DND', 'Converted', 'Not Interested', 'Irrelevant', 'Job Seeker', 'Jobs'] },
          folder: { $nin: ['DND', 'Not Interested', 'Irrelevant', 'Jobs'] },
        },
        {
          projection: {
            _id: 1,
            name: 1,
            phone: 1,
            phoneNormalized: 1,
            email: 1,
            service: 1,
            source: 1,
            status: 1,
            folder: 1,
            priorityLevel: 1,
            nextFollowUp: 1,
            followupTime: 1,
            isOptedOut: 1,
            aiEnabled: 1,
            disableAI: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray();

    return docs.map((d: any) => ({
      ...d,
      _id: String(d._id),
    }));
  }

  async fetchRecentLeadMessages(
    tenantDbName: string,
    mongoLeadId: string,
    limit = 8,
  ): Promise<SalesBusterMessage[]> {
    const client = await this.getClient();
    if (!client || !tenantDbName || !mongoLeadId) return [];

    try {
      const { ObjectId } = await import('mongodb');
      const db = client.db(tenantDbName);
      const leadFilter = ObjectId.isValid(mongoLeadId)
        ? { $in: [mongoLeadId, new ObjectId(mongoLeadId)] }
        : mongoLeadId;

      const docs = await db
        .collection('messages')
        .find(
          { leadId: leadFilter },
          { projection: { direction: 1, sender: 1, text: 1, timestamp: 1 } },
        )
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return docs.reverse().map((m: any) => ({
        direction: m.direction,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
      }));
    } catch {
      return [];
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.close().catch(() => {});
      this.client = null;
    }
  }
}
