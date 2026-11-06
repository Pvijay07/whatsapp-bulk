import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  Browsers,
} from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

export type SessionConnectionState = 'DISCONNECTED' | 'SCAN_QR_REQUIRED' | 'CONNECTING' | 'ONLINE';

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

  getMessageStatuses() {
    return this.messageStatuses;
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

  private loadAccountsMeta(): Record<string, { label: string; createdAt: string }> {
    try {
      const file = this.getAccountsMetaFilePath();
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      }
    } catch (e) {}
    return {};
  }

  private saveAccountsMeta(data: Record<string, { label: string; createdAt: string }>) {
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

    // 1. Ensure default session (active_device) is registered
    const defaultDir = this.getSessionDir('default');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }

    const defaultSaved = this.getSavedRegisteredNumber('default');
    const defaultSession: SessionData = {
      sessionId: 'default',
      label: meta['default']?.label || 'Primary WhatsApp Channel (SIM 1)',
      sock: null,
      sessionState: defaultSaved ? 'CONNECTING' : 'SCAN_QR_REQUIRED',
      currentQrCodeDataUrl: null,
      connectedPhoneNumber: defaultSaved,
      reconnectTimeout: null,
      isInitializing: false,
      createdAt: meta['default']?.createdAt || new Date().toISOString(),
    };
    this.sessions.set('default', defaultSession);

    // 2. Discover any additional accounts in backend/sessions/
    try {
      const entries = fs.readdirSync(baseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'active_device' && !entry.name.startsWith('.')) {
          const sid = entry.name;
          const savedNum = this.getSavedRegisteredNumber(sid);
          const sessionObj: SessionData = {
            sessionId: sid,
            label: meta[sid]?.label || `WhatsApp Channel (${sid.slice(-4)})`,
            sock: null,
            sessionState: savedNum ? 'CONNECTING' : 'SCAN_QR_REQUIRED',
            currentQrCodeDataUrl: null,
            connectedPhoneNumber: savedNum,
            reconnectTimeout: null,
            isInitializing: false,
            createdAt: meta[sid]?.createdAt || new Date().toISOString(),
          };
          this.sessions.set(sid, sessionObj);
        }
      }
    } catch (e) {
      this.logger.warn(`Session discovery warning: ${(e as any).message}`);
    }

    this.logger.log(`📱 Discovered ${this.sessions.size} WhatsApp account slots. Initializing connections...`);

    // 3. Initialize sockets for all registered accounts
    for (const [sid] of this.sessions.entries()) {
      this.initSocket(sid).catch((err) => {
        this.logger.warn(`Deferred socket initialization for ${sid}: ${err.message}`);
      });
    }
  }

  /**
   * Cleans up socket instance for a given session.
   */
  private cleanUpSocket(session: SessionData) {
    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners('connection.update');
        session.sock.ev.removeAllListeners('creds.update');
        session.sock.ev.removeAllListeners('messages.update');
        session.sock.ws?.close();
        session.sock.end(undefined);
      } catch (e) {}
      session.sock = null;
    }
  }

  /**
   * Schedules reconnect for a given session.
   */
  private scheduleReconnect(session: SessionData, delayMs: number) {
    if (session.reconnectTimeout) {
      clearTimeout(session.reconnectTimeout);
      session.reconnectTimeout = null;
    }
    session.reconnectTimeout = setTimeout(() => {
      session.reconnectTimeout = null;
      this.initSocket(session.sessionId).catch((err) => {
        this.logger.error(`Error in scheduled socket reconnect for ${session.sessionId}: ${err.message}`);
      });
    }, delayMs);
  }

  /**
   * Initializes a Baileys WebSocket connection for a given session slot.
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
            this.logger.warn(`Session connection replaced for ${sessionId}. Delaying reconnect.`);
            session.sessionState = 'CONNECTING';
            this.cleanUpSocket(session);
            this.scheduleReconnect(session, 5000);
          } else {
            session.sessionState = 'CONNECTING';
            this.cleanUpSocket(session);
            const reconnectDelay = statusCode === DisconnectReason.restartRequired ? 500 : 2500;
            this.logger.log(`Reconnecting WhatsApp [${sessionId}] in ${reconnectDelay}ms...`);
            this.scheduleReconnect(session, reconnectDelay);
          }
        }
      });

      session.sock.ev.on('creds.update', async () => {
        await saveCreds();
        const saved = this.getSavedRegisteredNumber(sessionId);
        if (saved && !session.connectedPhoneNumber) {
          session.connectedPhoneNumber = saved;
          this.logger.log(`WhatsApp credentials updated for ${sessionId} with number: ${saved}`);
        }
      });

      // Global live delivery receipt tracker across all active sockets
      session.sock.ev.on('messages.update', (updates) => {
        for (const update of updates) {
          const msgId = update.key?.id;
          if (!msgId) continue;
          const statusVal = update.update?.status;
          let newStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | null = null;
          if (statusVal === 3) {
            newStatus = 'DELIVERED';
          } else if (statusVal === 4 || statusVal === 5) {
            newStatus = 'READ';
          } else if (statusVal === 0) {
            newStatus = 'FAILED';
          } else if (statusVal === 2) {
            newStatus = 'SENT';
          }

          if (newStatus) {
            const existing = this.messageStatuses.get(msgId);
            this.messageStatuses.set(msgId, {
              status: newStatus,
              timestamp: Date.now(),
              recipientJid: update.key?.remoteJid || existing?.recipientJid,
            });
            this.logger.log(`Receipt update: [${msgId}] -> ${newStatus}`);
          }
        }
      });
    } catch (err: any) {
      this.logger.error(`Error initializing Baileys socket for ${sessionId}: ${err.message}`);
      session.sessionState = 'DISCONNECTED';
    } finally {
      session.isInitializing = false;
    }
  }

  /**
   * Returns list of all configured WhatsApp accounts and their connection statuses.
   */
  listAccounts(): WhatsAppAccountInfo[] {
    const list: WhatsAppAccountInfo[] = [];
    for (const s of this.sessions.values()) {
      const isOnline = s.sessionState === 'ONLINE' && !!s.sock?.user;
      const isConnecting = s.sessionState === 'CONNECTING';
      const isRegistered = this.isSessionRegistered(s.sessionId);
      const registeredNumber = s.connectedPhoneNumber || this.getSavedRegisteredNumber(s.sessionId);

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

    const newSession: SessionData = {
      sessionId,
      label: accountLabel,
      sock: null,
      sessionState: 'SCAN_QR_REQUIRED',
      currentQrCodeDataUrl: null,
      connectedPhoneNumber: null,
      reconnectTimeout: null,
      isInitializing: false,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(sessionId, newSession);

    // Persist meta
    const meta = this.loadAccountsMeta();
    meta[sessionId] = { label: accountLabel, createdAt: newSession.createdAt };
    this.saveAccountsMeta(meta);

    this.logger.log(`Created new WhatsApp account slot: "${accountLabel}" (${sessionId})`);

    // Initialize socket in background
    this.initSocket(sessionId).catch((e) => {
      this.logger.warn(`Error initializing fresh account ${sessionId}: ${e.message}`);
    });

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
  getSessionStatus(sessionId = 'default') {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.sessions.get('default') || Array.from(this.sessions.values())[0];
    }

    if (!session) {
      return {
        state: 'DISCONNECTED' as SessionConnectionState,
        isOnline: false,
        isConnecting: false,
        isRegistered: false,
        qrCodeDataUrl: null,
        connectedNumber: null,
      };
    }

    const isOnline = session.sessionState === 'ONLINE' && !!session.sock?.user;
    const isConnecting = session.sessionState === 'CONNECTING';
    const isRegistered = this.isSessionRegistered(session.sessionId);
    const registeredNumber = session.connectedPhoneNumber || this.getSavedRegisteredNumber(session.sessionId);

    return {
      sessionId: session.sessionId,
      label: session.label,
      state: session.sessionState,
      isOnline,
      isConnecting,
      isRegistered,
      qrCodeDataUrl: isOnline || isRegistered ? null : session.currentQrCodeDataUrl,
      connectedNumber: registeredNumber,
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
   * Resolves the session to use for sending: specific session or round-robin rotation.
   */
  private getNextOnlineSession(preferredSessionId?: string): SessionData | null {
    if (preferredSessionId && preferredSessionId !== 'AUTO' && preferredSessionId !== 'MULTI_NUMBER_POOL') {
      const direct = this.sessions.get(preferredSessionId);
      if (direct && direct.sessionState === 'ONLINE' && direct.sock) {
        return direct;
      }
      // Match by phone number
      const cleanPreferred = preferredSessionId.replace(/[^\d]/g, '');
      for (const s of this.sessions.values()) {
        const sNum = (s.connectedPhoneNumber || '').replace(/[^\d]/g, '');
        if (sNum && (sNum === cleanPreferred || sNum.endsWith(cleanPreferred) || cleanPreferred.endsWith(sNum))) {
          if (s.sessionState === 'ONLINE' && s.sock) {
            return s;
          }
        }
      }
    }

    const onlineList = this.getOnlineSessions();
    if (onlineList.length === 0) {
      // Fallback to any session with sock
      const fallback = Array.from(this.sessions.values()).find((s) => s.sock && s.sessionState === 'ONLINE');
      return fallback || null;
    }

    const selected = onlineList[this.roundRobinIndex % onlineList.length];
    this.roundRobinIndex++;
    return selected;
  }

  /**
   * Transmits an authentic message directly over the live WebSocket protocol.
   * Supports multi-number pool round-robin rotation or dedicated number dispatching.
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

      // Format Action Buttons into authentic WhatsApp Click-to-Chat Deep Links (wa.me)
      let finalText = text || '';
      if (buttons && buttons.length > 0) {
        const senderClean = (
          session.connectedPhoneNumber ||
          this.getSavedRegisteredNumber(session.sessionId) ||
          '918897727709'
        ).replace(/[^\d]/g, '');

        const actionLines = buttons.map((b) => {
          const typeUpper = (b.type || 'QUICK_REPLY').toUpperCase();
          if (typeUpper === 'URL') {
            const url = b.value || 'https://example.com';
            return `🌐 *${b.text}*\n   🔗 ${url}`;
          } else if (typeUpper === 'PHONE') {
            let phone = (b.value || '').replace(/[^\d+]/g, '');
            if (!phone.startsWith('+') && phone.length === 10) phone = `+91${phone}`;
            return `📞 *${b.text}*\n   📲 ${phone}`;
          } else {
            const replyText = b.text.replace(/^[^\w\s]+/g, '').trim() || b.text;
            const encoded = encodeURIComponent(replyText);
            const deepLink = `https://wa.me/${senderClean}?text=${encoded}`;
            return `💬 *${b.text}* (Tap to Instant Reply):\n   👉 ${deepLink}`;
          }
        });

        finalText = finalText
          ? `${finalText}\n\n━━━━━━━━━━━━━━━━━━━━\n${actionLines.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━`
          : `━━━━━━━━━━━━━━━━━━━━\n${actionLines.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━━`;
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

      const realMsgId = sent?.key?.id || `VMSG-${clean}-${Date.now().toString(36)}`;
      this.logger.log(`✅ Message dispatched via [${session.label}]! Key ID: ${realMsgId}`);

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
  async generateFreshQr(sessionId = 'default'): Promise<{ success: boolean; qrCodeDataUrl: string | null; error?: string }> {
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
}
