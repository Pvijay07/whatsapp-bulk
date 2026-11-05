import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

// Dynamic proxy agent resolver for residential proxies
let HttpsProxyAgent: any;
try {
  HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent || require('https-proxy-agent');
} catch (e) {}

export interface PoolSessionData {
  id: string;
  phoneNumber: string;
  status: 'ONLINE' | 'CONNECTING' | 'SCAN_QR_REQUIRED' | 'DISCONNECTED' | 'BANNED' | 'WARMING_UP';
  healthScore: number; // 0 - 100%
  warmupStage: 'UNWARMED' | 'WARMING' | 'WARMED_READY';
  dailySentCount: number;
  dailyQuota: number;
  proxyUrl?: string;
  proxyDisplay?: string;
  qrCodeDataUrl?: string | null;
  lastActive: Date;
}

@Injectable()
export class VirtualPoolManagerService implements OnModuleInit {
  private readonly logger = new Logger(VirtualPoolManagerService.name);
  private sessions: Map<string, WASocket> = new Map();
  private poolMetadata: Map<string, PoolSessionData> = new Map();
  private roundRobinIndex = 0;

  async onModuleInit() {
    this.logger.log('Initializing Virtual Number Multi-Session Pool Manager...');
    await this.initDefaultPool();
  }

  /**
   * Initialize virtual numbers in the pool (clean start - no fake seed numbers)
   */
  private async initDefaultPool() {
    this.poolMetadata.clear();
    this.logger.log('Virtual Number Pool initialized. Waiting for real linked devices or verified sessions.');
  }

  /**
   * Get all virtual numbers in the pool with live status
   */
  getPoolStatus(): PoolSessionData[] {
    return Array.from(this.poolMetadata.values());
  }

  /**
   * Selects the next healthy virtual number in round-robin sequence
   */
  getNextAvailableSender(): PoolSessionData | null {
    const list = Array.from(this.poolMetadata.values()).filter(
      (s) => s.status === 'ONLINE' && s.dailySentCount < s.dailyQuota,
    );

    if (list.length === 0) {
      return null;
    }

    const selected = list[this.roundRobinIndex % list.length];
    this.roundRobinIndex++;
    return selected;
  }

  /**
   * Dispatches message using Round-Robin load balancing across the virtual pool
   */
  async dispatchPoolMessage(
    recipientNumber: string,
    text: string,
    preferredNumber?: string,
  ): Promise<{ success: boolean; messageId: string; senderNumber: string; error?: string }> {
    let sender: PoolSessionData | null = null;

    if (preferredNumber && this.poolMetadata.has(preferredNumber)) {
      sender = this.poolMetadata.get(preferredNumber)!;
    } else {
      sender = this.getNextAvailableSender();
    }

    if (!sender) {
      return {
        success: false,
        messageId: '',
        senderNumber: '',
        error: 'All virtual numbers in the pool have reached their daily quotas or are offline.',
      };
    }

    // Clean phone number: e.g. 919876543210@s.whatsapp.net
    let clean = recipientNumber.replace(/[^\d]/g, '');
    if (clean.length === 10) clean = `91${clean}`;
    const jid = `${clean}@s.whatsapp.net`;

    const realMsgId = `VMSG-${clean}-${Date.now().toString(36).toUpperCase()}`;

    // Check if real active socket exists for this number
    const activeSock = this.sessions.get(sender.phoneNumber);
    if (!activeSock) {
      return {
        success: false,
        messageId: '',
        senderNumber: sender.phoneNumber,
        error: `Number ${sender.phoneNumber} does not have an active WhatsApp socket connection. Please scan the QR code to link device.`,
      };
    }

    try {
      this.logger.log(`[Virtual Pool] Dispatching via ${sender.phoneNumber} over WebSocket to ${jid}`);
      const sent = await activeSock.sendMessage(jid, { text });
      const providerId = sent?.key?.id || realMsgId;

      // Update quota and activity
      sender.dailySentCount++;
      sender.lastActive = new Date();

      return {
        success: true,
        messageId: providerId,
        senderNumber: sender.phoneNumber,
      };
    } catch (e: any) {
      this.logger.error(`Live WebSocket dispatch error on ${sender.phoneNumber}: ${e.message}`);
      sender.healthScore = Math.max(0, sender.healthScore - 5);
      return {
        success: false,
        messageId: '',
        senderNumber: sender.phoneNumber,
        error: `WhatsApp WebSocket delivery failed: ${e.message}`,
      };
    }
  }

  /**
   * Adds an auto-provisioned number to the pool
   */
  addNumberToPool(data: {
    phoneNumber: string;
    proxyDisplay?: string;
    proxyUrl?: string;
  }): PoolSessionData {
    const id = `pool-num-${Date.now()}`;
    const newSession: PoolSessionData = {
      id,
      phoneNumber: data.phoneNumber,
      status: 'ONLINE',
      healthScore: 100,
      warmupStage: 'WARMING',
      dailySentCount: 0,
      dailyQuota: 500,
      proxyDisplay: data.proxyDisplay || 'Airtel 4G Residential Proxy (India)',
      proxyUrl: data.proxyUrl,
      lastActive: new Date(),
    };

    this.poolMetadata.set(data.phoneNumber, newSession);
    this.logger.log(`New virtual number ${data.phoneNumber} added to active pool.`);
    return newSession;
  }

  /**
   * Simulates an automated warming interaction between two virtual numbers
   */
  simulateWarmupRound(): { fromNumber: string; toNumber: string; snippet: string } | null {
    const numbers = Array.from(this.poolMetadata.values()).filter((n) => n.status === 'ONLINE');
    if (numbers.length < 2) return null;

    const from = numbers[0];
    const to = numbers[1];

    const warmSnippets = [
      'Hey, got your message! Looking forward to reviewing the proposal.',
      'Great, I will check and get back to you shortly.',
      'Thanks for sharing the details! 👍',
      'Please send the catalog when ready.',
      'Sure, let us schedule a quick call tomorrow morning.',
    ];
    const snippet = warmSnippets[Math.floor(Math.random() * warmSnippets.length)];

    from.healthScore = Math.min(100, from.healthScore + 1);
    to.healthScore = Math.min(100, to.healthScore + 1);
    from.lastActive = new Date();
    to.lastActive = new Date();

    this.logger.log(`[Account Warmer] Simulated warming exchange between ${from.phoneNumber} & ${to.phoneNumber}`);
    return {
      fromNumber: from.phoneNumber,
      toNumber: to.phoneNumber,
      snippet,
    };
  }

  /**
   * Unlink/disconnect a number
   */
  removeNumber(phoneNumber: string): boolean {
    if (this.sessions.has(phoneNumber)) {
      try {
        this.sessions.get(phoneNumber)?.logout();
      } catch (e) {}
      this.sessions.delete(phoneNumber);
    }
    return this.poolMetadata.delete(phoneNumber);
  }
}

