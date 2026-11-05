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

export type SessionConnectionState = 'DISCONNECTED' | 'SCAN_QR_REQUIRED' | 'CONNECTING' | 'ONLINE';

@Injectable()
export class BaileysSessionService implements OnModuleInit {
  private readonly logger = new Logger(BaileysSessionService.name);
  private sock: WASocket | null = null;
  private sessionState: SessionConnectionState = 'DISCONNECTED';
  private currentQrCodeDataUrl: string | null = null;
  private connectedPhoneNumber: string | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isInitializing = false;

  private getSessionDir(): string {
    const fixedPath = 'd:\\vijay\\whatsapp-bulk\\backend\\sessions\\active_device';
    if (fs.existsSync('d:\\vijay\\whatsapp-bulk\\backend')) {
      return fixedPath;
    }
    const baseDir = fs.existsSync(path.resolve(process.cwd(), 'backend'))
      ? path.resolve(process.cwd(), 'backend')
      : process.cwd();
    return path.resolve(baseDir, 'sessions', 'active_device');
  }

  /**
   * Reads saved credentials to recover registered phone number even during reconnects or after restart
   */
  private getSavedRegisteredNumber(): string | null {
    try {
      const credsPath = path.join(this.getSessionDir(), 'creds.json');
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

  private isSessionRegistered(): boolean {
    try {
      const credsPath = path.join(this.getSessionDir(), 'creds.json');
      if (fs.existsSync(credsPath)) {
        const raw = fs.readFileSync(credsPath, 'utf8');
        const data = JSON.parse(raw);
        return !!(data?.registered || data?.me?.id);
      }
    } catch (e) {}
    return false;
  }

  async onModuleInit() {
    // Restore connected number from disk if available
    const saved = this.getSavedRegisteredNumber();
    if (saved) {
      this.connectedPhoneNumber = saved;
      this.logger.log(`Found existing registered WhatsApp session for number: ${saved}`);
    }

    this.initSocket().catch((err) => {
      this.logger.warn(`Deferred Baileys socket initialization: ${err.message}`);
    });
  }

  /**
   * Cleanly closes and removes all listeners from any previous socket instance
   * to prevent duplicate connections (which cause status 440 connectionReplaced).
   */
  private cleanUpSocket() {
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ws?.close();
        this.sock.end(undefined);
      } catch (e) {}
      this.sock = null;
    }
  }

  /**
   * Schedules a single, debounced reconnect attempt.
   */
  private scheduleReconnect(delayMs: number) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.initSocket().catch((err) => {
        this.logger.error(`Error in scheduled socket reconnect: ${err.message}`);
      });
    }, delayMs);
  }

  async initSocket() {
    if (this.isInitializing) {
      this.logger.debug('Socket initialization already in progress, skipping duplicate call');
      return;
    }

    this.isInitializing = true;
    this.cleanUpSocket();

    const sessionDir = this.getSessionDir();
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      this.sessionState = 'CONNECTING';

      // Ensure we keep existing registered phone number in memory
      const savedNum = this.getSavedRegisteredNumber();
      if (savedNum && !this.connectedPhoneNumber) {
        this.connectedPhoneNumber = savedNum;
      }

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 5,
        getMessage: async () => {
          return {
            conversation: 'SalesBuster keepalive',
          };
        },
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          // Only show QR if device is not already registered
          if (!this.isSessionRegistered()) {
            this.sessionState = 'SCAN_QR_REQUIRED';
            try {
              const qrLib: any = QRCode?.toDataURL ? QRCode : (QRCode as any)?.default || require('qrcode');
              this.currentQrCodeDataUrl = await qrLib.toDataURL(qr, {
                margin: 2,
                scale: 6,
                color: { dark: '#075E54', light: '#FFFFFF' },
              });
              this.logger.log('New WhatsApp pairing QR code generated. Ready to scan on phone!');
            } catch (e: any) {
              this.logger.error(`Failed to generate QR code data URL: ${e.message}`);
            }
          }
        }

        if (connection === 'open') {
          this.sessionState = 'ONLINE';
          this.currentQrCodeDataUrl = null;
          const detected =
            this.sock?.user?.id?.split(':')[0]?.replace(/[^\d]/g, '') ||
            this.getSavedRegisteredNumber() ||
            'Linked Device';
          this.connectedPhoneNumber = detected;
          this.logger.log(`🟢 WhatsApp Multi-Device session is LIVE & ONLINE! Number: ${this.connectedPhoneNumber}`);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          this.logger.warn(`WhatsApp session closed (status: ${statusCode}). Logged out: ${isLoggedOut}`);

          if (isLoggedOut) {
            // User explicitly logged out from mobile app
            this.sessionState = 'DISCONNECTED';
            this.connectedPhoneNumber = null;
            this.currentQrCodeDataUrl = null;
            this.cleanUpSocket();
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            this.scheduleReconnect(1500);
          } else if (statusCode === DisconnectReason.connectionReplaced) {
            // Another connection opened with same creds. Delay to prevent thrashing loop.
            this.logger.warn(`Session connection was replaced by another instance. Delaying reconnect to stabilize.`);
            this.sessionState = 'CONNECTING';
            this.cleanUpSocket();
            this.scheduleReconnect(5000);
          } else {
            // Normal transient drop (e.g. 515 restartRequired right after pairing, or 428 connectionClosed)
            // DO NOT wipe credentials or connectedPhoneNumber!
            this.sessionState = 'CONNECTING';
            this.cleanUpSocket();
            const reconnectDelay = statusCode === DisconnectReason.restartRequired ? 500 : 2500;
            this.logger.log(`Reconnecting WhatsApp session in ${reconnectDelay}ms (Handset preserved: ${this.connectedPhoneNumber})...`);
            this.scheduleReconnect(reconnectDelay);
          }
        }
      });

      this.sock.ev.on('creds.update', async () => {
        await saveCreds();
        // Update connected phone number as soon as creds contain registration
        const saved = this.getSavedRegisteredNumber();
        if (saved && !this.connectedPhoneNumber) {
          this.connectedPhoneNumber = saved;
          this.logger.log(`WhatsApp credentials updated with phone number: ${saved}`);
        }
      });
    } catch (err: any) {
      this.logger.error(`Error initializing Baileys socket: ${err.message}`);
      this.sessionState = 'DISCONNECTED';
    } finally {
      this.isInitializing = false;
    }
  }

  getSessionStatus() {
    const isOnline = this.sessionState === 'ONLINE' && !!this.sock?.user;
    const isConnecting = this.sessionState === 'CONNECTING';
    const isRegistered = this.isSessionRegistered();
    const registeredNumber = this.connectedPhoneNumber || this.getSavedRegisteredNumber();

    return {
      state: this.sessionState,
      isOnline,
      isConnecting,
      isRegistered,
      qrCodeDataUrl: isOnline || isRegistered ? null : this.currentQrCodeDataUrl,
      connectedNumber: registeredNumber,
    };
  }

  /**
   * Transmits an ACTUAL,  message directly over the live WebSocket protocol
   */
  /**
   * Transmits a real WhatsApp message over the live Baileys WebSocket protocol.
   * Supports rich text, Click-to-Chat deep link buttons, and media attachments (images, PDFs, documents, video, audio).
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
  ): Promise<{ success: boolean; messageId: string; error?: string }> {
    // If briefly reconnecting, wait up to 4 seconds for online state
    if (this.sessionState !== 'ONLINE') {
      const waitStart = Date.now();
      while (Date.now() - waitStart < 4000) {
        if ((this.sessionState as any) === 'ONLINE' && this.sock) {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (this.sessionState !== 'ONLINE' || !this.sock) {
      return {
        success: false,
        messageId: '',
        error: `Device not linked to WhatsApp. Current status: ${this.sessionState}. Scan QR code in Virtual Numbers to link.`,
      };
    }

    try {
      // Format 10 or 12 digit phone number to JID format: e.g. 919876543210@s.whatsapp.net
      let clean = toPhoneNumber.replace(/[^\d]/g, '');
      if (clean.length === 10) {
        clean = `91${clean}`;
      }
      const jid = `${clean}@s.whatsapp.net`;

      // Format Action Buttons into authentic WhatsApp Click-to-Chat Deep Links (wa.me) & Rich Cards
      let finalText = text || '';
      if (buttons && buttons.length > 0) {
        const senderClean = (
          this.connectedPhoneNumber ||
          this.getSavedRegisteredNumber() ||
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
            // Quick reply using wa.me deep link with pre-typed text
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
          this.logger.log(`Transmitting real WhatsApp image broadcast (${fileName}) to ${jid}...`);
          sent = await this.sock.sendMessage(jid, {
            image: mediaSource,
            caption: finalText || undefined,
          });
        } else if (mime.startsWith('video/')) {
          this.logger.log(`Transmitting real WhatsApp video broadcast (${fileName}) to ${jid}...`);
          sent = await this.sock.sendMessage(jid, {
            video: mediaSource,
            caption: finalText || undefined,
            mimetype: mime,
          });
        } else if (mime.startsWith('audio/')) {
          this.logger.log(`Transmitting real WhatsApp audio broadcast (${fileName}) to ${jid}...`);
          sent = await this.sock.sendMessage(jid, {
            audio: mediaSource,
            mimetype: mime,
            ptt: false,
          });
          if (finalText && finalText.trim()) {
            await this.sock.sendMessage(jid, { text: finalText });
          }
        } else {
          // Document / PDF / Sheets / Text / Any file
          this.logger.log(`Transmitting real WhatsApp document broadcast (${fileName}, ${mime}) to ${jid}...`);
          sent = await this.sock.sendMessage(jid, {
            document: mediaSource,
            mimetype: mime,
            fileName: fileName,
            caption: finalText || undefined,
          });
        }
      } else {
        this.logger.log(`Transmitting real WhatsApp broadcast to ${jid} over WebSocket...`);
        sent = await this.sock.sendMessage(jid, { text: finalText });
      }

      const realMsgId = sent?.key?.id || `VMSG-${clean}-${Date.now().toString(36)}`;
      this.logger.log(`✅ Message delivered to WhatsApp servers! Key ID: ${realMsgId}`);

      return {
        success: true,
        messageId: realMsgId,
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
   * Resets uncompleted session and triggers a fresh, authentic WhatsApp QR code.
   * If session is already linked, rejects to prevent accidental key destruction.
   */
  async generateFreshQr(): Promise<{ success: boolean; qrCodeDataUrl: string | null; error?: string }> {
    if (this.sessionState === 'ONLINE' || this.isSessionRegistered()) {
      const num = this.connectedPhoneNumber || this.getSavedRegisteredNumber() || '';
      return {
        success: false,
        qrCodeDataUrl: null,
        error: `Device (${num}) is already linked. Click Logout in Virtual Numbers tab first if you want to unlink.`,
      };
    }

    try {
      this.logger.log('Generating fresh  QR code...');
      this.cleanUpSocket();

      const sessionDir = this.getSessionDir();
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      this.currentQrCodeDataUrl = null;
      this.sessionState = 'CONNECTING';

      await this.initSocket();

      // Poll until QR is emitted (up to 12s)
      const start = Date.now();
      while (Date.now() - start < 12000) {
        if (this.currentQrCodeDataUrl) {
          return { success: true, qrCodeDataUrl: this.currentQrCodeDataUrl };
        }
        await new Promise((r) => setTimeout(r, 400));
      }

      return {
        success: !!this.currentQrCodeDataUrl,
        qrCodeDataUrl: this.currentQrCodeDataUrl,
        error: this.currentQrCodeDataUrl ? undefined : 'Timed out waiting for WhatsApp QR code',
      };
    } catch (err: any) {
      return { success: false, qrCodeDataUrl: null, error: err.message };
    }
  }

  /**
   * Request an 8-character Pairing Code for an existing WhatsApp number without QR camera scanning.
   * User enters this code in WhatsApp -> Linked Devices -> "Link with phone number instead".
   */
  async requestPairingCode(phoneNumber: string): Promise<string> {
    let clean = phoneNumber.replace(/[^\d]/g, '');
    if (clean.startsWith('0')) {
      clean = clean.substring(1);
    }
    if (clean.length === 10) {
      clean = `91${clean}`;
    }

    if (this.sessionState === 'ONLINE' && this.connectedPhoneNumber) {
      throw new Error(`Device (${this.connectedPhoneNumber}) is already linked and online. Unlink first.`);
    }

    try {
      this.logger.log(`Preparing clean pairing handshake for number: ${clean}...`);

      // 1. Reset uncompleted session state to avoid stale creds conflict
      this.cleanUpSocket();

      const sessionDir = this.getSessionDir();
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      this.connectedPhoneNumber = null;
      this.currentQrCodeDataUrl = null;

      // 2. Initialize fresh socket
      await this.initSocket();

      // 3. Wait until WebSocket is open and ready to accept IQ stanzas (max 12s)
      const startTime = Date.now();
      while (Date.now() - startTime < 12000) {
        if (this.sock && (this.sock.ws as any)?.isOpen) {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!this.sock || !(this.sock.ws as any)?.isOpen) {
        throw new Error('Connection timed out waiting for WhatsApp servers. Please retry.');
      }

      // Ensure initial hello handshake completes
      await new Promise((r) => setTimeout(r, 1200));

      this.logger.log(`Requesting 8-digit WhatsApp pairing code for ${clean}...`);
      const code = await this.sock.requestPairingCode(clean);
      this.logger.log(`WhatsApp pairing code successfully generated for ${clean}: ${code}`);
      return code;
    } catch (err: any) {
      this.logger.error(`Failed to request pairing code for ${clean}: ${err.message}`);
      throw new Error(err.message || 'Failed to request pairing code from WhatsApp servers');
    }
  }

  async logout() {
    try {
      this.cleanUpSocket();
      const sessionDir = this.getSessionDir();
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      this.sessionState = 'DISCONNECTED';
      this.connectedPhoneNumber = null;
      this.currentQrCodeDataUrl = null;
      this.scheduleReconnect(1000);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
