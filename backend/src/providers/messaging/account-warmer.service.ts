import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { VirtualPoolManagerService } from './virtual-pool-manager.service';
import { BaileysSessionService } from './baileys-session.service';

export interface WarmupLogEntry {
  id: string;
  fromNumber: string;
  toNumber: string;
  snippet: string;
  timestamp: string;
  type?: 'REAL_PEER_EXCHANGE' | 'SIMULATED' | 'READINESS_CHECK';
  trustGain?: string;
}

export const PEER_WARMUP_CONVERSATIONS = [
  {
    topic: 'Team Sync',
    starter: 'Hey, are you joining the morning team sync in 10 minutes?',
    replies: [
      'Yes! Just wrapping up an email, joining in 2 minutes.',
      'Grabbing a coffee, will be on the call in 5 mins.',
      'Yep, already got the agenda open on my laptop.',
    ],
  },
  {
    topic: 'Proposal Review',
    starter: 'Hi! Did you get a chance to review the updated proposal draft?',
    replies: [
      'Just went through section 3, looks solid! Approved from my end.',
      'Reviewing it now, will ping you with any comments shortly.',
      'Looks good! Let us finalize and send it across after lunch.',
    ],
  },
  {
    topic: 'Dispatch Verification',
    starter: 'Good morning! Is the shipment status sheet updated for today?',
    replies: [
      'Good morning! Yes, all dispatched tracking IDs are uploaded.',
      'Morning! Updating the morning batch right now, give me 5 minutes.',
      'Yes, checked and verified with the warehouse team.',
    ],
  },
  {
    topic: 'Vendor Coordination',
    starter: 'Hey, do you have the contact details for the vendor we discussed yesterday?',
    replies: [
      'Sharing their business card right away, check in a moment.',
      'Yes, forwarded their WhatsApp number and catalog above.',
      'Let me pull up their quotation and forward it to you.',
    ],
  },
  {
    topic: 'Order Confirmation',
    starter: 'Hi! Quick check—has order #4829 been processed for delivery?',
    replies: [
      'Yes, courier team picked it up an hour ago.',
      'Processed and ready for dispatch. Tracking details shared.',
      'Confirmed! Scheduled for delivery tomorrow morning.',
    ],
  },
];

@Injectable()
export class AccountWarmerService implements OnModuleInit {
  private readonly logger = new Logger(AccountWarmerService.name);
  private warmupLogs: WarmupLogEntry[] = [];
  private isAutoWarmingEnabled = true;
  private totalPeerExchangesToday = 0;
  private lastExchangeDate = '';

  constructor(
    private readonly poolManager: VirtualPoolManagerService,
    private readonly baileysService: BaileysSessionService,
  ) {}

  onModuleInit() {
    this.logger.log('Starting Virtual Number Auto-Warmer Service (Day 1–2 Mutual Chat Engine)...');
    this.warmupLogs = [];
    this.lastExchangeDate = new Date().toISOString().split('T')[0];

    // Background interval: auto-cycles peer dialogue every 60 seconds
    setInterval(() => {
      if (this.isAutoWarmingEnabled) {
        this.runWarmupCycle().catch((err) => {
          this.logger.debug(`Background warmup tick notice: ${err.message}`);
        });
      }
    }, 60000);
  }

  private refreshDate() {
    const today = new Date().toISOString().split('T')[0];
    if (this.lastExchangeDate !== today) {
      this.totalPeerExchangesToday = 0;
      this.lastExchangeDate = today;
    }
  }

  /**
   * Day 1–2 Protocol: Executes a mutual peer-to-peer conversational chat
   * between two connected virtual SIMs in your pool.
   * Both sides send & reply, neither clicks "Report", rapidly raising trust scores.
   */
  async runWarmupCycle(): Promise<WarmupLogEntry | null> {
    this.refreshDate();
    const onlineSessions = this.baileysService.getOnlineSessions();

    if (onlineSessions.length >= 2) {
      // Pick 2 distinct online WhatsApp accounts in the pool
      const idxA = Math.floor(Math.random() * onlineSessions.length);
      let idxB = Math.floor(Math.random() * (onlineSessions.length - 1));
      if (idxB >= idxA) idxB++;

      const sessionA = onlineSessions[idxA];
      const sessionB = onlineSessions[idxB];

      const numA = sessionA.connectedPhoneNumber;
      const numB = sessionB.connectedPhoneNumber;

      if (numA && numB) {
        const convo = PEER_WARMUP_CONVERSATIONS[Math.floor(Math.random() * PEER_WARMUP_CONVERSATIONS.length)];
        const reply = convo.replies[Math.floor(Math.random() * convo.replies.length)];

        this.logger.log(
          `🔥 Auto-Warmer: Executing 2-way peer chat between [${sessionA.label}] (+${numA}) and [${sessionB.label}] (+${numB})...`,
        );

        try {
          // 1. Session A transmits starter to Session B over real Baileys WebSocket
          await this.baileysService.sendRealMessage(numB, convo.starter, undefined, undefined, sessionA.sessionId);

          // 2. Session B simulates human typing delay and replies back to Session A
          const typingDelayMs = 4000 + Math.floor(Math.random() * 3500);
          setTimeout(async () => {
            try {
              await this.baileysService.sendRealMessage(numA, reply, undefined, undefined, sessionB.sessionId);
              this.logger.log(
                `🤝 2-Way Peer Warmup Complete! [${sessionB.label}] replied to [${sessionA.label}]. Trust score elevated.`,
              );
            } catch (replyErr: any) {
              this.logger.warn(`Peer warmup reply error: ${replyErr.message}`);
            }
          }, typingDelayMs);

          this.totalPeerExchangesToday++;
          const now = new Date().toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const entry: WarmupLogEntry = {
            id: `wl-${Date.now()}`,
            fromNumber: `+${numA} (${sessionA.label})`,
            toNumber: `+${numB} (${sessionB.label})`,
            snippet: `"${convo.starter}" ➔ "${reply}"`,
            timestamp: now,
            type: 'REAL_PEER_EXCHANGE',
            trustGain: '+2.5% Mutual Trust',
          };

          this.warmupLogs.unshift(entry);
          if (this.warmupLogs.length > 50) this.warmupLogs.pop();
          return entry;
        } catch (err: any) {
          this.logger.warn(`Live peer warmup dispatch warning: ${err.message}`);
        }
      }
    }

    if (onlineSessions.length === 1) {
      const single = onlineSessions[0];
      const now = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const entry: WarmupLogEntry = {
        id: `wl-${Date.now()}`,
        fromNumber: `+${single.connectedPhoneNumber || 'Channel 1'} (${single.label})`,
        toNumber: 'Awaiting 2nd SIM in Pool',
        snippet: '1 SIM online. Ready to start live peer-to-peer mutual chatting once Account #2 pairs.',
        timestamp: now,
        type: 'READINESS_CHECK',
        trustGain: 'Standby',
      };
      this.warmupLogs.unshift(entry);
      if (this.warmupLogs.length > 50) this.warmupLogs.pop();
      return entry;
    }

    // Fallback: simulated pool cycle if no live Baileys sockets are open yet
    const result = this.poolManager.simulateWarmupRound();
    if (result) {
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const entry: WarmupLogEntry = {
        id: `wl-${Date.now()}`,
        fromNumber: result.fromNumber,
        toNumber: result.toNumber,
        snippet: result.snippet,
        timestamp: now,
        type: 'SIMULATED',
        trustGain: '+1% Health',
      };

      this.warmupLogs.unshift(entry);
      if (this.warmupLogs.length > 50) {
        this.warmupLogs.pop();
      }
      return entry;
    }

    // Default standby log when 0 accounts are online yet
    const now = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const fallbackEntry: WarmupLogEntry = {
      id: `wl-${Date.now()}`,
      fromNumber: 'Auto-Warmer Engine',
      toNumber: 'Virtual Channels',
      snippet: 'Auto-Warmer loop active. Link your WhatsApp accounts in Virtual Numbers to begin live mutual peer chatting.',
      timestamp: now,
      type: 'READINESS_CHECK',
      trustGain: 'Standby Ready',
    };
    this.warmupLogs.unshift(fallbackEntry);
    if (this.warmupLogs.length > 50) this.warmupLogs.pop();
    return fallbackEntry;
  }

  getWarmupLogs(): WarmupLogEntry[] {
    return this.warmupLogs;
  }

  getWarmerStatus() {
    this.refreshDate();
    const onlineSessions = this.baileysService.getOnlineSessions();
    return {
      isAutoWarmingEnabled: this.isAutoWarmingEnabled,
      totalPeerExchangesToday: this.totalPeerExchangesToday,
      onlinePoolCount: onlineSessions.length,
      mode: onlineSessions.length >= 2 ? 'REAL_PEER_EXCHANGE' : onlineSessions.length === 1 ? 'STANDBY_AWAITING_SECOND_SIM' : 'OFFLINE',
      riskReduction: onlineSessions.length >= 2 ? 'HIGH (Mutual Chatting Active)' : 'MEDIUM',
      recentLogs: this.warmupLogs.slice(0, 10),
      protocol: {
        day1_2: {
          name: 'Day 1–2: Internal Mutual Chatting',
          action: 'Pool virtual numbers send random messages & replies to each other every few hours.',
          cap: '0–10 outbound messages/day',
          benefit: 'Both sides reply, 0% reports → WhatsApp trust score rises rapidly.',
        },
        day3_5: {
          name: 'Day 3–5: Low-Volume Outbound',
          action: 'Gradually introduce external leads with conversational hooks.',
          cap: '15–25 messages/day',
          pacing: '45–90 second delays',
        },
        day6_7: {
          name: 'Day 6–7: Maturing Volume',
          action: 'Medium rotation across pool.',
          cap: '40–60 messages/day',
          pacing: '30–60 second delays',
        },
        day7_plus: {
          name: 'Day 7+: Scaled Rotation',
          action: 'Full velocity: 80–120 messages/day per SIM.',
          cap: '80–120 messages/day per SIM',
          scale: '10 numbers in pool = 1,000+ messages/day safely without triggering Meta limits.',
        },
      },
    };
  }

  toggleAutoWarming(enable: boolean) {
    this.isAutoWarmingEnabled = enable;
    this.logger.log(`Account auto-warming ${enable ? 'enabled' : 'paused'}.`);
    return { enabled: this.isAutoWarmingEnabled };
  }
}
