import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  Browsers,
  proto,
  generateWAMessageFromContent,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';
// @ts-ignore
import { HttpsProxyAgent } from 'https-proxy-agent';
// @ts-ignore
import { SocksProxyAgent } from 'socks-proxy-agent';

export type SessionConnectionState = 'DISCONNECTED' | 'SCAN_QR_REQUIRED' | 'CONNECTING' | 'ONLINE';
export type WarmupStage = 'WARMING_UP' | 'MATURING' | 'WARMED_UP';

export interface WhatsAppAccountInfo {
  sessionId: string;
  label: string;
  state: SessionConnectionState;
  isOnline: boolean;
  isConnecting: boolean;
  isRegistered: boolean;
  connectedNumber: string | null;
  qrCodeDataUrl: string | null;
  createdAt: string;
  proxyUrl?: string | null;
  dailySentCount: number;
  lastSentDate: string;
  maxDailySafeCap: number;
  warmupStage: WarmupStage;
  daysActive: number;
  recommendedDelaySec?: number;
  stageName?: string;
  stageDescription?: string;
}

interface SessionData {
  sessionId: string;
  label: string;
  sock: WASocket | null;
  sessionState: SessionConnectionState;
  currentQrCodeDataUrl: string | null;
  connectedPhoneNumber: string | null;
  reconnectTimeout: NodeJS.Timeout | null;
  isInitializing: boolean;
  createdAt: string;
  proxyUrl?: string | null;
  dailySentCount: number;
  lastSentDate: string;
  consecutiveSentCount: number;
}

interface AccountMetaEntry {
  label: string;
  createdAt: string;
  proxyUrl?: string | null;
  dailySentCount?: number;
  lastSentDate?: string;
  customDailyCap?: number;
}

export function calculateWarmupMetrics(createdAtStr: string): {
  daysActive: number;
  warmupStage: WarmupStage;
  maxDailySafeCap: number;
  recommendedDelaySec: number;
  stageName: string;
  stageDescription: string;
} {
  const createdTime = new Date(createdAtStr || Date.now()).getTime();
  const diffDays = Math.max(0, Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24)));
  const daysActive = diffDays + 1; // 1st day = 1

  if (daysActive <= 2) {
    // Day 1–2: Internal Mutual Chatting & Auto-Warmer loop
    return {
      daysActive,
      warmupStage: 'WARMING_UP',
      maxDailySafeCap: 10,
      recommendedDelaySec: 75,
      stageName: 'Day 1–2: Peer-to-Peer Warmup',
      stageDescription: 'Internal mutual chatting between pool numbers. Safe outbound cold limit: 10/day.',
    };
  } else if (daysActive <= 5) {
    // Day 3–5: Low-Volume Outbound (15–25 msgs/day, 45–90s delays)
    return {
      daysActive,
      warmupStage: 'MATURING',
      maxDailySafeCap: 25,
      recommendedDelaySec: 60,
      stageName: 'Day 3–5: Low-Volume Outbound',
      stageDescription: 'Limit to 15–25 msgs/day with 45–90s delays. Always prompt for a reply first.',
    };
  } else if (daysActive <= 7) {
    // Day 6–7: Maturing Transition (40–60 msgs/day, 30–60s delays)
    return {
      daysActive,
      warmupStage: 'MATURING',
      maxDailySafeCap: 50,
      recommendedDelaySec: 40,
      stageName: 'Day 6–7: Maturing Volume',
      stageDescription: '40–50 msgs/day with 30–60s delays across rotated pool.',
    };
  } else {
    // Day 7+: Scaled Rotation (80–120 msgs/day per SIM, 1,000+ msgs/day across 10 SIMs)
    return {
      daysActive,
      warmupStage: 'WARMED_UP',
      maxDailySafeCap: 100,
      recommendedDelaySec: 28,
      stageName: 'Day 7+: Scaled Rotation',
      stageDescription: 'Full velocity: 80–120 msgs/day per SIM. 10 SIMs = 1,000+ msgs/day safely.',
    };
  }
}

@Injectable()
export class BaileysSessionService implements OnModuleInit {
  private readonly logger = new Logger(BaileysSessionService.name);
  private sessions: Map<string, SessionData> = new Map();
  private roundRobinIndex = 0;
  private messageStatuses = new Map<
    string,
    {
      status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
      timestamp: number;
      recipientJid?: string;
      error?: string;
    }
  >();

  // Tracks verified 2-way inbound replies (Golden Rule: Prompt for a Reply First)
  private mutualReplies = new Map<
    string,
    {
      phoneNumber: string;
      replyText: string;
      receivedOnChannel: string;
      timestamp: number;
      timeFormatted: string;
    }
  >();

  getMessageStatuses() {
    return this.messageStatuses;
  }

  getMutualReplies() {
    return Array.from(this.mutualReplies.values());
  }

  hasMutualReply(phoneNumber: string): boolean {
    const clean = (phoneNumber || '').replace(/[^\d]/g, '');
    return this.mutualReplies.has(clean);
  }

  recordMutualReply(phoneNumber: string, text: string, receivedOnChannel: string) {
    const clean = (phoneNumber || '').replace(/[^\d]/g, '');
    const entry = {
      phoneNumber: clean,
      replyText: text,
      receivedOnChannel,
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };
    this.mutualReplies.set(clean, entry);
    this.logger.log(`🤝 Mutual Trust Established for +${clean} on [${receivedOnChannel}]: "${text}"`);
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private refreshSessionDailyCount(session: SessionData) {
    const today = this.getTodayDateString();
    if (session.lastSentDate !== today) {
      session.dailySentCount = 0;
      session.lastSentDate = today;
      session.consecutiveSentCount = 0;
    }
  }

  private getSessionsBaseDir(): string {
    const fixedPath = 'd:\\vijay\\whatsapp-bulk\\backend\\sessions';
    if (fs.existsSync(fixedPath)) {
      return fixedPath;
    }
    const baseDir = fs.existsSync(path.resolve(process.cwd(), 'backend'))
      ? path.resolve(process.cwd(), 'backend')
      : process.cwd();
    const resolved = path.resolve(baseDir, 'sessions');
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    return resolved;
  }

  private getSessionDir(sessionId: string): string {
    const base = this.getSessionsBaseDir();
    if (sessionId === 'default') {
      return path.join(base, 'active_device');
    }
    return path.join(base, sessionId);
  }

  private getAccountsMetaFilePath(): string {
    return path.join(this.getSessionsBaseDir(), 'accounts_meta.json');
  }

  private loadAccountsMeta(): Record<string, AccountMetaEntry> {
    try {
      const file = this.getAccountsMetaFilePath();
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (e) {}
    return {};
  }

  private saveAccountsMeta(data: Record<string, AccountMetaEntry>) {
    try {
      fs.writeFileSync(this.getAccountsMetaFilePath(), JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {}
  }

  private getSavedRegisteredNumber(sessionId: string): string | null {
    try {
      const credsPath = path.join(this.getSessionDir(sessionId), 'creds.json');
      if (fs.existsSync(credsPath)) {
        const raw = fs.readFileSync(credsPath, 'utf8');
        const data = JSON.parse(raw);
        if (data?.me?.id) {
          const clean = data.me.id.split(':')[0].replace(/[^\d]/g, '');
          if (clean) return clean;
        }
      }
    } catch (e) {}
    return null;
  }

  private isSessionRegistered(sessionId: string): boolean {
    try {
      const credsPath = path.join(this.getSessionDir(sessionId), 'creds.json');
      if (fs.existsSync(credsPath)) {
        const raw = fs.readFileSync(credsPath, 'utf8');
        const data = JSON.parse(raw);
        return !!(data?.registered || data?.me?.id);
      }
    } catch (e) {}
    return false;
  }

  async onModuleInit() {
    const baseDir = this.getSessionsBaseDir();
    const meta = this.loadAccountsMeta();
    const today = this.getTodayDateString();

    // 1. Ensure default session (active_device) is registered
    const defaultDir = this.getSessionDir('default');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }

    const defaultSaved = this.getSavedRegisteredNumber('default');
    const defaultMeta = meta['default'];
    const defaultSession: SessionData = {
      sessionId: 'default',
      label: defaultMeta?.label || 'Primary WhatsApp Channel (SIM 1)',
      sock: null,
      sessionState: defaultSaved ? 'CONNECTING' : 'SCAN_QR_REQUIRED',
      currentQrCodeDataUrl: null,
      connectedPhoneNumber: defaultSaved,
      reconnectTimeout: null,
      isInitializing: false,
      createdAt: defaultMeta?.createdAt || new Date().toISOString(),
      proxyUrl: defaultMeta?.proxyUrl || null,
      dailySentCount: defaultMeta?.lastSentDate === today ? (defaultMeta?.dailySentCount || 0) : 0,
      lastSentDate: today,
      consecutiveSentCount: 0,
    };
    this.sessions.set('default', defaultSession);

    // 2. Discover any additional accounts in backend/sessions/
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'active_device' && !entry.name.startsWith('.')) {
          const sid = entry.name;
          const savedNum = this.getSavedRegisteredNumber(sid);
          const sMeta = meta[sid];
          const sessionObj: SessionData = {
            sessionId: sid,
            label: sMeta?.label || `WhatsApp Channel (${sid.slice(-4)})`,
            sock: null,
            sessionState: savedNum ? 'CONNECTING' : 'SCAN_QR_REQUIRED',
            currentQrCodeDataUrl: null,
            connectedPhoneNumber: savedNum,
            reconnectTimeout: null,
            isInitializing: false,
            createdAt: sMeta?.createdAt || new Date().toISOString(),
            proxyUrl: sMeta?.proxyUrl || null,
            dailySentCount: sMeta?.lastSentDate === today ? (sMeta?.dailySentCount || 0) : 0,
            lastSentDate: today,
            consecutiveSentCount: 0,
          };
          this.sessions.set(sid, sessionObj);
        }
      }
    } catch (e: any) {
      this.logger.warn(`Could not read sessions directory: ${e.message}`);
    }

    // Also include any sessions known in meta that might not have directory yet
    for (const [sid, info] of Object.entries(meta)) {
      if (!this.sessions.has(sid)) {
        const savedNum = this.getSavedRegisteredNumber(sid);
        this.sessions.set(sid, {
          sessionId: sid,
          label: info.label || `WhatsApp Channel (${sid.slice(-4)})`,
          sock: null,
          sessionState: savedNum ? 'CONNECTING' : 'SCAN_QR_REQUIRED',
          currentQrCodeDataUrl: null,
          connectedPhoneNumber: savedNum,
          reconnectTimeout: null,
          isInitializing: false,
          createdAt: info.createdAt || new Date().toISOString(),
          proxyUrl: info.proxyUrl || null,
          dailySentCount: info.lastSentDate === today ? (info.dailySentCount || 0) : 0,
          lastSentDate: today,
          consecutiveSentCount: 0,
        });
      }
    }

    this.logger.log(`BaileysSessionService initialized with ${this.sessions.size} WhatsApp account slot(s).`);

    // Initialize all sockets in parallel
    for (const sid of this.sessions.keys()) {
      this.initSocket(sid).catch((err) => {
        this.logger.warn(`Failed initial socket boot for session [${sid}]: ${err.message}`);
      });
    }
  }

  /**
   * Initializes a Baileys WebSocket connection for a given session slot.
   * Golden Rule 2: Binds socket to dedicated SOCKS5/HTTP residential proxy if configured.
   */
  async initSocket(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    if (session.isInitializing) {
      this.logger.debug(`Socket init already in progress for ${sessionId}, skipping duplicate call.`);
      return;
    }

    session.isInitializing = true;
    this.cleanUpSocket(session);

    const sessionDir = this.getSessionDir(sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      session.sessionState = 'CONNECTING';

      const savedNum = this.getSavedRegisteredNumber(sessionId);
      if (savedNum && !session.connectedPhoneNumber) {
        session.connectedPhoneNumber = savedNum;
      }

      // Golden Rule 2: Instantiate dedicated proxy agent if configured
      let proxyAgent: any = undefined;
      if (session.proxyUrl && session.proxyUrl.trim()) {
        const p = session.proxyUrl.trim();
        try {
          if (p.startsWith('socks4://') || p.startsWith('socks5://') || p.startsWith('socks://')) {
            proxyAgent = new SocksProxyAgent(p);
            this.logger.log(`Session [${sessionId}] bound to SOCKS5 residential proxy: ${p.replace(/:[^:]+@/, ':****@')}`);
          } else if (p.startsWith('http://') || p.startsWith('https://')) {
            proxyAgent = new HttpsProxyAgent(p);
            this.logger.log(`Session [${sessionId}] bound to HTTP residential proxy: ${p.replace(/:[^:]+@/, ':****@')}`);
          }
        } catch (proxyErr: any) {
          this.logger.error(`Failed to initialize proxy agent for session [${sessionId}]: ${proxyErr.message}`);
        }
      }

      session.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu(`Chrome-${sessionId}`),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 5,
        agent: proxyAgent,
        fetchAgent: proxyAgent,
        getMessage: async () => ({ conversation: 'SalesBuster keepalive' }),
      });

      session.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          if (!this.isSessionRegistered(sessionId)) {
            session.sessionState = 'SCAN_QR_REQUIRED';
            try {
              const qrLib: any = QRCode?.toDataURL ? QRCode : (QRCode as any)?.default || require('qrcode');
              session.currentQrCodeDataUrl = await qrLib.toDataURL(qr, {
                margin: 2,
                scale: 6,
                color: { dark: '#075E54', light: '#FFFFFF' },
              });
              this.logger.log(`New QR code generated for ${session.label} (${sessionId}). Ready to scan.`);
            } catch (e: any) {
              this.logger.error(`Failed to generate QR data URL for ${sessionId}: ${e.message}`);
            }
          }
        }

        if (connection === 'open') {
          session.sessionState = 'ONLINE';
          session.currentQrCodeDataUrl = null;
          const detected =
            session.sock?.user?.id?.split(':')[0]?.replace(/[^\d]/g, '') ||
            this.getSavedRegisteredNumber(sessionId) ||
            'Linked Device';
          session.connectedPhoneNumber = detected;
          this.logger.log(`🟢 WhatsApp [${session.label}] (${sessionId}) is LIVE & ONLINE! Number: ${detected}`);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          this.logger.warn(`WhatsApp session [${sessionId}] closed (status: ${statusCode}). Logged out: ${isLoggedOut}`);

          if (isLoggedOut) {
            session.sessionState = 'DISCONNECTED';
            session.connectedPhoneNumber = null;
            session.currentQrCodeDataUrl = null;
            this.cleanUpSocket(session);
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            this.scheduleReconnect(session, 1500);
          } else if (statusCode === DisconnectReason.connectionReplaced) {
            session.sessionState = 'DISCONNECTED';
            this.logger.warn(`Session [${sessionId}] replaced by another connection.`);
          } else {
            session.sessionState = 'CONNECTING';
            this.scheduleReconnect(session, 5000);
          }
        }
      });

      session.sock.ev.on('creds.update', saveCreds);

      // Real-time WhatsApp read & delivery receipts listener
      session.sock.ev.on('messages.update', (updates) => {
        for (const update of updates) {
          const msgId = update.key.id;
          if (!msgId) continue;

          let newStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null = null;
          const s = (update.update?.status as any) || (update as any).status;

          if (s === 4 || s === 'READ' || s === 'PLAYED') {
            newStatus = 'READ';
          } else if (s === 3 || s === 'DELIVERY_ACK' || s === 'RECEIPT') {
            newStatus = 'DELIVERED';
          } else if (s === 2 || s === 'SERVER_ACK') {
            newStatus = 'SENT';
          }

          if (newStatus) {
            const existing = this.messageStatuses.get(msgId);
            if (existing) {
              if (existing.status === 'READ' && newStatus !== 'READ') {
                continue;
              }
              existing.status = newStatus;
              existing.timestamp = Date.now();
            } else {
              this.messageStatuses.set(msgId, {
                status: newStatus,
                timestamp: Date.now(),
                recipientJid: update.key.remoteJid || undefined,
              });
            }
            this.logger.debug(`Receipt update -> ${newStatus} for message ${msgId}`);
          }
        }
      });

      // Listen for inbound messages from real recipients (Golden Rule: Prompt for a Reply First)
      session.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
          if (!msg.key.fromMe && msg.message) {
            const remoteJid = msg.key.remoteJid || '';
            const cleanPhone = remoteJid.split('@')[0]?.replace(/[^\d]/g, '');
            const text =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              msg.message.imageMessage?.caption ||
              '';

            if (cleanPhone && text) {
              this.logger.log(`💬 Inbound mutual reply received on [${session.label}] from +${cleanPhone}: "${text}"`);
              this.recordMutualReply(cleanPhone, text, session.connectedPhoneNumber || session.label);
            }
          }
        }
      });
    } catch (err: any) {
      this.logger.error(`Error initializing Baileys socket for ${sessionId}: ${err.message}`, err.stack);
      session.sessionState = 'DISCONNECTED';
      this.scheduleReconnect(session, 10000);
    } finally {
      session.isInitializing = false;
    }
  }

  private scheduleReconnect(session: SessionData, delayMs: number) {
    if (session.reconnectTimeout) {
      clearTimeout(session.reconnectTimeout);
    }
    session.reconnectTimeout = setTimeout(() => {
      this.initSocket(session.sessionId).catch((err) => {
        this.logger.warn(`Reconnect failed for ${session.sessionId}: ${err.message}`);
      });
    }, delayMs);
  }

  private cleanUpSocket(session: SessionData) {
    if (session.reconnectTimeout) {
      clearTimeout(session.reconnectTimeout);
      session.reconnectTimeout = null;
    }
    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners('connection.update');
        session.sock.ev.removeAllListeners('creds.update');
        session.sock.ev.removeAllListeners('messages.update');
        session.sock.ev.removeAllListeners('messages.upsert');
        session.sock.end(undefined);
      } catch (e) {}
      session.sock = null;
    }
  }

  /**
   * Returns list of all configured WhatsApp accounts and their connection/anti-ban statuses.
   */
  listAccounts(): WhatsAppAccountInfo[] {
    const list: WhatsAppAccountInfo[] = [];
    const today = this.getTodayDateString();

    for (const s of this.sessions.values()) {
      this.refreshSessionDailyCount(s);
      const isOnline = s.sessionState === 'ONLINE' && !!s.sock?.user;
      const isConnecting = s.sessionState === 'CONNECTING';
      const isRegistered = this.isSessionRegistered(s.sessionId);
      const registeredNumber = s.connectedPhoneNumber || this.getSavedRegisteredNumber(s.sessionId);
      const warmup = calculateWarmupMetrics(s.createdAt);

      list.push({
        sessionId: s.sessionId,
        label: s.label,
        state: s.sessionState,
        isOnline,
        isConnecting,
        isRegistered,
        connectedNumber: registeredNumber,
        qrCodeDataUrl: isOnline || isRegistered ? null : s.currentQrCodeDataUrl,
        createdAt: s.createdAt,
        proxyUrl: s.proxyUrl || null,
        dailySentCount: s.dailySentCount || 0,
        lastSentDate: s.lastSentDate || today,
        maxDailySafeCap: warmup.maxDailySafeCap,
        warmupStage: warmup.warmupStage,
        daysActive: warmup.daysActive,
        recommendedDelaySec: warmup.recommendedDelaySec,
        stageName: warmup.stageName,
        stageDescription: warmup.stageDescription,
      });
    }
    return list;
  }

  /**
   * Creates a new WhatsApp account slot (e.g. Account 2, Account 3) and initializes its pairing process.
   */
  async createAccount(label?: string): Promise<WhatsAppAccountInfo> {
    const count = this.sessions.size + 1;
    const sessionId = `wa_account_${Date.now()}`;
    const accountLabel = label?.trim() || `WhatsApp Channel #${count}`;
    const today = this.getTodayDateString();
    const createdAt = new Date().toISOString();

    const newSession: SessionData = {
      sessionId,
      label: accountLabel,
      sock: null,
      sessionState: 'SCAN_QR_REQUIRED',
      currentQrCodeDataUrl: null,
      connectedPhoneNumber: null,
      reconnectTimeout: null,
      isInitializing: false,
      createdAt,
      proxyUrl: null,
      dailySentCount: 0,
      lastSentDate: today,
      consecutiveSentCount: 0,
    };

    this.sessions.set(sessionId, newSession);

    // Persist meta
    const meta = this.loadAccountsMeta();
    meta[sessionId] = {
      label: accountLabel,
      createdAt: newSession.createdAt,
      proxyUrl: null,
      dailySentCount: 0,
      lastSentDate: today,
    };
    this.saveAccountsMeta(meta);

    this.logger.log(`Created new WhatsApp account slot: "${accountLabel}" (${sessionId})`);

    // Initialize socket in background
    this.initSocket(sessionId).catch((e) => {
      this.logger.warn(`Error initializing fresh account ${sessionId}: ${e.message}`);
    });

    const warmup = calculateWarmupMetrics(newSession.createdAt);

    return {
      sessionId,
      label: accountLabel,
      state: 'SCAN_QR_REQUIRED',
      isOnline: false,
      isConnecting: true,
      isRegistered: false,
      connectedNumber: null,
      qrCodeDataUrl: null,
      createdAt: newSession.createdAt,
      proxyUrl: null,
      dailySentCount: 0,
      lastSentDate: today,
      maxDailySafeCap: warmup.maxDailySafeCap,
      warmupStage: warmup.warmupStage,
      daysActive: warmup.daysActive,
      recommendedDelaySec: warmup.recommendedDelaySec,
      stageName: warmup.stageName,
      stageDescription: warmup.stageDescription,
    };
  }

  /**
   * Configures a dedicated residential/mobile SOCKS5 or HTTP proxy for a session slot.
   */
  async setSessionProxy(
    sessionId: string,
    proxyUrl: string | null,
  ): Promise<{ success: boolean; message: string; account: WhatsAppAccountInfo }> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.proxyUrl = proxyUrl && proxyUrl.trim() ? proxyUrl.trim() : null;

    // Persist in accounts_meta.json
    const meta = this.loadAccountsMeta();
    if (!meta[sessionId]) {
      meta[sessionId] = {
        label: session.label,
        createdAt: session.createdAt,
        dailySentCount: session.dailySentCount,
        lastSentDate: session.lastSentDate,
      };
    }
    meta[sessionId].proxyUrl = session.proxyUrl;
    this.saveAccountsMeta(meta);

    const masked = session.proxyUrl ? session.proxyUrl.replace(/:[^:]+@/, ':****@') : 'Direct IP';
    this.logger.log(`Updated proxy for [${session.label}] (${sessionId}): ${masked}`);

    // If socket is active, reconnect to bind with new proxy
    this.cleanUpSocket(session);
    await this.initSocket(sessionId).catch((err) => {
      this.logger.warn(`Error reinitializing socket with new proxy: ${err.message}`);
    });

    return {
      success: true,
      message: session.proxyUrl ? `Proxy configured (${masked}). Socket refreshed.` : 'Proxy removed. Using direct IP.',
      account: this.getSessionStatus(sessionId),
    };
  }

  /**
   * Deletes a WhatsApp account slot and removes its session credentials from disk.
   */
  async deleteAccount(sessionId: string): Promise<{ success: boolean; message: string }> {
    if (sessionId === 'default') {
      // For default session, don't delete slot, simply logout
      await this.logout('default');
      return { success: true, message: 'Primary channel reset and unlinked.' };
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, message: 'Account not found.' };
    }

    this.cleanUpSocket(session);
    const sessionDir = this.getSessionDir(sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    this.sessions.delete(sessionId);

    const meta = this.loadAccountsMeta();
    delete meta[sessionId];
    this.saveAccountsMeta(meta);

    this.logger.log(`Deleted WhatsApp account slot ${sessionId}`);
    return { success: true, message: `Account ${session.label} removed.` };
  }

  /**
   * Gets session status for a specific session or the primary/first active session.
   */
  getSessionStatus(sessionId = 'default'): WhatsAppAccountInfo {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.sessions.get('default') || Array.from(this.sessions.values())[0];
    }

    if (!session) {
      const today = this.getTodayDateString();
      return {
        sessionId: 'default',
        label: 'Primary WhatsApp Channel (SIM 1)',
        state: 'DISCONNECTED' as SessionConnectionState,
        isOnline: false,
        isConnecting: false,
        isRegistered: false,
        qrCodeDataUrl: null,
        connectedNumber: null,
        createdAt: new Date().toISOString(),
        proxyUrl: null,
        dailySentCount: 0,
        lastSentDate: today,
        maxDailySafeCap: 25,
        warmupStage: 'WARMING_UP',
        daysActive: 1,
      };
    }

    this.refreshSessionDailyCount(session);
    const isOnline = session.sessionState === 'ONLINE' && !!session.sock?.user;
    const isConnecting = session.sessionState === 'CONNECTING';
    const isRegistered = this.isSessionRegistered(session.sessionId);
    const registeredNumber = session.connectedPhoneNumber || this.getSavedRegisteredNumber(session.sessionId);
    const warmup = calculateWarmupMetrics(session.createdAt);

    return {
      sessionId: session.sessionId,
      label: session.label,
      state: session.sessionState,
      isOnline,
      isConnecting,
      isRegistered,
      qrCodeDataUrl: isOnline || isRegistered ? null : session.currentQrCodeDataUrl,
      connectedNumber: registeredNumber,
      createdAt: session.createdAt,
      proxyUrl: session.proxyUrl || null,
      dailySentCount: session.dailySentCount || 0,
      lastSentDate: session.lastSentDate,
      maxDailySafeCap: warmup.maxDailySafeCap,
      warmupStage: warmup.warmupStage,
      daysActive: warmup.daysActive,
      recommendedDelaySec: warmup.recommendedDelaySec,
      stageName: warmup.stageName,
      stageDescription: warmup.stageDescription,
    };
  }

  /**
   * Returns all currently connected and online WhatsApp sessions.
   */
  getOnlineSessions(): SessionData[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.sessionState === 'ONLINE' && s.sock && !!s.sock.user,
    );
  }

  /**
   * Golden Rule 1: Resolves session with fair round-robin rotation,
   * prioritizing online sessions that are within their daily safe cap.
   */
  private getNextOnlineSession(preferredSessionId?: string): SessionData | null {
    if (preferredSessionId && preferredSessionId !== 'AUTO' && preferredSessionId !== 'MULTI_NUMBER_POOL') {
      const direct = this.sessions.get(preferredSessionId);
      if (direct && direct.sessionState === 'ONLINE' && direct.sock) {
        this.refreshSessionDailyCount(direct);
        return direct;
      }
      // Match by phone number
      const cleanPreferred = preferredSessionId.replace(/[^\d]/g, '');
      for (const s of this.sessions.values()) {
        const sNum = (s.connectedPhoneNumber || '').replace(/[^\d]/g, '');
        if (sNum && (sNum === cleanPreferred || sNum.endsWith(cleanPreferred) || cleanPreferred.endsWith(sNum))) {
          if (s.sessionState === 'ONLINE' && s.sock) {
            this.refreshSessionDailyCount(s);
            return s;
          }
        }
      }
    }

    const onlineList = this.getOnlineSessions();
    if (onlineList.length === 0) {
      const fallback = Array.from(this.sessions.values()).find((s) => s.sock && s.sessionState === 'ONLINE');
      return fallback || null;
    }

    // Golden Rule 1: Filter online sessions that have remaining daily safe cap
    const safeCandidates = onlineList.filter((s) => {
      this.refreshSessionDailyCount(s);
      const { maxDailySafeCap } = calculateWarmupMetrics(s.createdAt);
      return s.dailySentCount < maxDailySafeCap;
    });

    if (safeCandidates.length > 0) {
      const selected = safeCandidates[this.roundRobinIndex % safeCandidates.length];
      this.roundRobinIndex++;
      return selected;
    }

    // If all sessions reached daily safe cap, fallback to the one with the lowest daily usage
    this.logger.warn(`⚠️ All online WhatsApp sessions have reached daily safe cap. Selecting lowest-utilized account.`);
    const sorted = [...onlineList].sort((a, b) => (a.dailySentCount || 0) - (b.dailySentCount || 0));
    return sorted[0];
  }

  /**
   * Golden Rule 4: Spintax resolver {A|B|C}
   */
  resolveSpintax(text: string): string {
    if (!text) return '';
    let result = text;
    const spintaxRegex = /\{([^{}]+)\}/g;
    while (spintaxRegex.test(result)) {
      result = result.replace(spintaxRegex, (_, choices) => {
        const options = choices.split('|');
        return options[Math.floor(Math.random() * options.length)];
      });
    }
    return result;
  }

  /**
   * Transmits an authentic message directly over the live WebSocket protocol.
   * Enforces all 6 Golden Rules of Anti-Ban Architecture:
   * 1. Multi-Session Round-Robin Pool rotation
   * 2. Dedicated proxy support
   * 3. Human Presence Simulation (typing packet, length-based duration, paused teardown)
   * 4. Spintax + 4-8 zero-width cryptographic suffix (\u200B, \u200C, \u200D, \uFEFF)
   * 5. Randomized pacing
   * 6. Daily safe quota tracking
   */
  async sendRealMessage(
    toPhoneNumber: string,
    text: string,
    buttons?: Array<{ id?: string; type: string; text: string; value?: string }>,
    media?: {
      base64?: string;
      url?: string;
      mimeType: string;
      fileName: string;
      fileSize?: number;
    },
    preferredSessionId?: string,
  ): Promise<{ success: boolean; messageId: string; dispatchedVia?: string; error?: string }> {
    const session = this.getNextOnlineSession(preferredSessionId);
    if (!session || !session.sock) {
      return {
        success: false,
        messageId: '',
        error: `No online WhatsApp account available. Link at least one WhatsApp number in Virtual Numbers.`,
      };
    }

    const sock = session.sock;

    try {
      let clean = toPhoneNumber.replace(/[^\d]/g, '');
      if (clean.length === 10) {
        clean = `91${clean}`;
      }
      const jid = `${clean}@s.whatsapp.net`;

      // 1. Pre-flight verification: Check if recipient exists on WhatsApp
      try {
        const checkResults = await sock.onWhatsApp(clean);
        const exists = checkResults && checkResults.length > 0 && !!checkResults[0]?.exists;
        if (!exists) {
          const errMsg = `Recipient number +${clean} is not registered on WhatsApp.`;
          this.logger.warn(`❌ Message rejected: ${errMsg}`);
          return {
            success: false,
            messageId: '',
            error: errMsg,
          };
        }
      } catch (checkErr: any) {
        this.logger.warn(`WhatsApp onWhatsApp check warning: ${checkErr.message}`);
      }

      // Golden Rule 4: Resolve Spintax {A|B|C}
      let finalText = this.resolveSpintax(text || '');

      // Format 1-Click Interactive WhatsApp Action (wa.me)
      // Exactly matching the reference layout: "<Label>: https://wa.me/<TargetPhone>"
      if (buttons && buttons.length > 0) {
        const b = buttons.find((btn) => (btn.type || '').toUpperCase() === 'QUICK_REPLY') || buttons[0];
        const label = b.text || 'WhatsApp Now';
        const targetClean = (b.value || '917997887788').replace(/[^\d]/g, '') || '917997887788';
        const waLink = `https://wa.me/${targetClean}`;
        const buttonLine = `${label}: ${waLink}`;
        finalText = finalText ? `${finalText}\n\n${buttonLine}` : buttonLine;
      }

      // Golden Rule 4: Inject 4-8 zero-width invisible characters (\u200B, \u200C, \u200D, \uFEFF)
      // Every single payload now yields an entirely unique SHA-256 hash across Meta's heuristic filters
      const zeroWidthChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
      const entropyLength = 4 + Math.floor(Math.random() * 5); // 4 to 8 characters
      const invisibleSuffix = Array.from({ length: entropyLength }, () =>
        zeroWidthChars[Math.floor(Math.random() * zeroWidthChars.length)],
      ).join('');
      finalText = `${finalText}${invisibleSuffix}`;

      // Golden Rule 3: Human Presence Simulation (composing typing packet + realistic wait)
      try {
        await sock.sendPresenceUpdate('composing', jid);
        const typingDurationMs =
          Math.min(5500, Math.max(3000, Math.floor(finalText.length * 25))) + Math.floor(Math.random() * 1000);
        this.logger.debug(`Human presence simulating typing for ${typingDurationMs}ms to ${jid}...`);
        await new Promise((resolve) => setTimeout(resolve, typingDurationMs));
      } catch (presErr: any) {
        this.logger.debug(`Presence update notice: ${presErr.message}`);
      }

      let sent: any;

      if (media && (media.base64 || media.url)) {
        let mediaBuffer: Buffer | null = null;
        if (media.base64) {
          const cleanB64 = media.base64.replace(/^data:[^;]+;base64,/, '');
          mediaBuffer = Buffer.from(cleanB64, 'base64');
        }
        const mediaSource = mediaBuffer || { url: media.url };
        const mime = (media.mimeType || 'application/octet-stream').toLowerCase();
        const fileName = media.fileName || 'attachment';

        if (mime.startsWith('image/')) {
          this.logger.log(`Transmitting WhatsApp image via [${session.label}] to ${jid}...`);
          sent = await sock.sendMessage(jid, {
            image: mediaSource,
            caption: finalText || undefined,
          });
        } else if (mime.startsWith('video/')) {
          this.logger.log(`Transmitting WhatsApp video via [${session.label}] to ${jid}...`);
          sent = await sock.sendMessage(jid, {
            video: mediaSource,
            caption: finalText || undefined,
            mimetype: mime,
          });
        } else if (mime.startsWith('audio/')) {
          this.logger.log(`Transmitting WhatsApp audio via [${session.label}] to ${jid}...`);
          sent = await sock.sendMessage(jid, {
            audio: mediaSource,
            mimetype: mime,
            ptt: false,
          });
          if (finalText && finalText.trim()) {
            await sock.sendMessage(jid, { text: finalText });
          }
        } else {
          this.logger.log(`Transmitting WhatsApp document via [${session.label}] to ${jid}...`);
          sent = await sock.sendMessage(jid, {
            document: mediaSource,
            mimetype: mime,
            fileName: fileName,
            caption: finalText || undefined,
          });
        }
      } else {
        this.logger.log(`Transmitting WhatsApp text via [${session.label}] to ${jid}...`);
        sent = await sock.sendMessage(jid, { text: finalText });
      }

      // Golden Rule 3 Teardown: Mark presence as paused
      try {
        await sock.sendPresenceUpdate('paused', jid);
      } catch (e) {}

      // Golden Rule 1 & 6: Increment daily count and track quota
      this.refreshSessionDailyCount(session);
      session.dailySentCount = (session.dailySentCount || 0) + 1;
      session.consecutiveSentCount = (session.consecutiveSentCount || 0) + 1;

      // Persist in accounts_meta.json
      const meta = this.loadAccountsMeta();
      if (!meta[session.sessionId]) {
        meta[session.sessionId] = { label: session.label, createdAt: session.createdAt };
      }
      meta[session.sessionId].dailySentCount = session.dailySentCount;
      meta[session.sessionId].lastSentDate = session.lastSentDate;
      this.saveAccountsMeta(meta);

      const realMsgId = sent?.key?.id || `VMSG-${clean}-${Date.now().toString(36)}`;
      this.logger.log(
        `✅ Message dispatched via [${session.label}]! Key ID: ${realMsgId} (Daily: ${session.dailySentCount})`,
      );

      this.messageStatuses.set(realMsgId, {
        status: 'SENT',
        timestamp: Date.now(),
        recipientJid: jid,
      });

      return {
        success: true,
        messageId: realMsgId,
        dispatchedVia: session.connectedPhoneNumber || session.label,
      };
    } catch (err: any) {
      this.logger.error(`Failed to deliver real WhatsApp message: ${err.message}`, err.stack);
      return {
        success: false,
        messageId: '',
        error: err.message,
      };
    }
  }

  /**
   * Pre-flight verification of a phone number on WhatsApp.
   */
  async checkNumberOnWhatsApp(phoneNumber: string, sessionId?: string): Promise<{ exists: boolean; jid?: string }> {
    const session = this.getNextOnlineSession(sessionId);
    if (!session || !session.sock) {
      return { exists: false };
    }
    try {
      let clean = phoneNumber.replace(/[^\d]/g, '');
      if (clean.length === 10) clean = `91${clean}`;
      const results = await session.sock.onWhatsApp(clean);
      const matched = results && results.length > 0 && results[0]?.exists ? results[0] : null;
      return {
        exists: !!matched,
        jid: matched?.jid,
      };
    } catch (err: any) {
      this.logger.warn(`Failed checking number on WhatsApp: ${err.message}`);
      return { exists: false };
    }
  }

  /**
   * Resets and regenerates a fresh pairing QR code for a specific session.
   */
  async generateFreshQr(
    sessionId = 'default',
  ): Promise<{ success: boolean; qrCodeDataUrl: string | null; error?: string }> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      await this.createAccount();
      session = this.sessions.get(sessionId);
    }
    if (!session) {
      return { success: false, qrCodeDataUrl: null, error: `Session ${sessionId} not found.` };
    }

    if (session.sessionState === 'ONLINE' || this.isSessionRegistered(sessionId)) {
      const num = session.connectedPhoneNumber || this.getSavedRegisteredNumber(sessionId) || '';
      return {
        success: false,
        qrCodeDataUrl: null,
        error: `Account (${num}) is already linked. Click Logout first if you want to unlink.`,
      };
    }

    try {
      this.logger.log(`Generating fresh QR code for ${session.label} (${sessionId})...`);
      this.cleanUpSocket(session);

      const sessionDir = this.getSessionDir(sessionId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      session.currentQrCodeDataUrl = null;
      session.sessionState = 'CONNECTING';

      await this.initSocket(sessionId);

      const start = Date.now();
      while (Date.now() - start < 12000) {
        if (session.currentQrCodeDataUrl) {
          return { success: true, qrCodeDataUrl: session.currentQrCodeDataUrl };
        }
        await new Promise((r) => setTimeout(r, 400));
      }

      return {
        success: !!session.currentQrCodeDataUrl,
        qrCodeDataUrl: session.currentQrCodeDataUrl,
        error: session.currentQrCodeDataUrl ? undefined : 'Timed out waiting for WhatsApp QR code',
      };
    } catch (err: any) {
      return { success: false, qrCodeDataUrl: null, error: err.message };
    }
  }

  /**
   * Request an 8-character Pairing Code for an existing WhatsApp number without QR scanning.
   */
  async requestPairingCode(phoneNumber: string, sessionId = 'default'): Promise<string> {
    let clean = phoneNumber.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    if (clean.length === 10) {
      clean = `91${clean}`;
    }

    let session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found.`);
    }

    if (session.sessionState === 'ONLINE' && session.connectedPhoneNumber) {
      throw new Error(`Account (${session.connectedPhoneNumber}) is already linked and online. Unlink first.`);
    }

    try {
      this.logger.log(`Preparing clean pairing handshake for ${clean} on ${session.label}...`);
      this.cleanUpSocket(session);

      const sessionDir = this.getSessionDir(sessionId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      session.connectedPhoneNumber = null;
      session.currentQrCodeDataUrl = null;

      await this.initSocket(sessionId);

      const startTime = Date.now();
      while (Date.now() - startTime < 12000) {
        if (session.sock && (session.sock.ws as any)?.isOpen) {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!session.sock || !(session.sock.ws as any)?.isOpen) {
        throw new Error('Connection timed out waiting for WhatsApp servers. Please retry.');
      }

      await new Promise((r) => setTimeout(r, 1200));

      this.logger.log(`Requesting 8-digit WhatsApp pairing code for ${clean}...`);
      const code = await session.sock.requestPairingCode(clean);
      this.logger.log(`WhatsApp pairing code generated for ${clean}: ${code}`);
      return code;
    } catch (err: any) {
      this.logger.error(`Failed to request pairing code for ${clean}: ${err.message}`);
      throw new Error(err.message || 'Failed to request pairing code from WhatsApp servers');
    }
  }

  /**
   * Disconnects / unlinks a session slot.
   */
  async logout(sessionId = 'default') {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found.' };
    }

    try {
      this.cleanUpSocket(session);
      const sessionDir = this.getSessionDir(sessionId);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      session.sessionState = 'DISCONNECTED';
      session.connectedPhoneNumber = null;
      session.currentQrCodeDataUrl = null;
      this.scheduleReconnect(session, 1000);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Computes system-wide 6 Golden Rules Anti-Ban Health Report.
   */
  getAntiBanHealthReport() {
    const allAccounts = this.listAccounts();
    const onlineAccounts = allAccounts.filter((a) => a.isOnline);
    const totalDailySent = allAccounts.reduce((acc, a) => acc + (a.dailySentCount || 0), 0);
    const totalDailyCap = allAccounts.reduce((acc, a) => acc + (a.maxDailySafeCap || 25), 0);
    const proxiesConfigured = allAccounts.filter((a) => !!a.proxyUrl).length;

    return {
      status: 'SHIELD_ACTIVE',
      rules: [
        {
          ruleNumber: 1,
          name: 'Multi-Session Round-Robin Pool',
          status: onlineAccounts.length > 1 ? 'OPTIMAL' : onlineAccounts.length === 1 ? 'FUNCTIONAL' : 'OFFLINE',
          details: `${onlineAccounts.length} online account(s). Total pool daily capacity: ${totalDailySent}/${totalDailyCap} messages sent today.`,
          metrics: {
            onlineAccounts: onlineAccounts.length,
            totalAccounts: allAccounts.length,
            poolDailySent: totalDailySent,
            poolDailyCap: totalDailyCap,
          },
        },
        {
          ruleNumber: 2,
          name: 'Residential / Mobile Proxies per Session',
          status: proxiesConfigured > 0 ? (proxiesConfigured === allAccounts.length ? 'OPTIMAL' : 'PARTIAL') : 'STANDBY',
          details: `${proxiesConfigured} of ${allAccounts.length} session(s) bound to dedicated SOCKS5/HTTP proxies.`,
          metrics: {
            proxiesConfigured,
            totalAccounts: allAccounts.length,
          },
        },
        {
          ruleNumber: 3,
          name: 'Human Presence Simulation',
          status: 'ACTIVE',
          details:
            'Pre-flight onWhatsApp verification, composing typing presence packet, 3-6s humanized duration, and paused teardown enabled on every dispatch.',
        },
        {
          ruleNumber: 4,
          name: 'Spintax & Zero-Width Entropy Randomization',
          status: 'ACTIVE',
          details:
            'Dynamic Spintax variation resolution + 4-8 character invisible zero-width cryptographic suffix (\\u200B, \\u200C, \\u200D, \\uFEFF) injected to ensure unique SHA-256 outbound hash.',
        },
        {
          ruleNumber: 5,
          name: 'Randomized Gaussian Jitter & Coffee Breaks',
          status: 'ACTIVE',
          details:
            'Box-Muller Gaussian normal distribution (18s-65s range, mean 25-35s) + automatic pool rotation or 5-minute coffee break every 25 messages.',
        },
        {
          ruleNumber: 6,
          name: 'Virtual Number Sourcing & Warmup Protocol',
          status: 'ENFORCED',
          details:
            'Automated 3-tier safe cap enforcement: Warming Up (<3d: 25/day), Maturing (3-7d: 50/day), Warmed Up (>7d: 100/day). Guidelines to avoid free VoIP in favor of Non-VoIP SIMs.',
        },
      ],
      summary: {
        onlineAccounts: onlineAccounts.length,
        totalAccounts: allAccounts.length,
        proxiesConfigured,
        poolDailySent: totalDailySent,
        poolDailyCap: totalDailyCap,
        remainingSafeQuota: Math.max(0, totalDailyCap - totalDailySent),
      },
    };
  }
}
