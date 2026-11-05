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

@Injectable()
export class BaileysSessionService implements OnModuleInit {
  private readonly logger = new Logger(BaileysSessionService.name);
  private sock: WASocket | null = null;
  private sessionState: SessionConnectionState = 'DISCONNECTED';
  private currentQrCodeDataUrl: string | null = null;
  private connectedPhoneNumber: string | null = null;

  private getSessionDir(): string {
    const baseDir = fs.existsSync(path.resolve(process.cwd(), 'backend'))
      ? path.resolve(process.cwd(), 'backend')
      : process.cwd();
    return path.resolve(baseDir, 'sessions', 'active_device');
  }

  async onModuleInit() {
    this.initSocket().catch((err) => {
      this.logger.warn(`Deferred Baileys socket initialization: ${err.message}`);
    });
  }

  async initSocket() {
    const sessionDir = this.getSessionDir();
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      this.sessionState = 'CONNECTING';

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
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

        if (connection === 'open') {
          this.sessionState = 'ONLINE';
          this.currentQrCodeDataUrl = null;
          this.connectedPhoneNumber = this.sock?.user?.id?.split(':')[0] || 'Linked Device';
          this.logger.log(`🟢 WhatsApp Multi-Device session is LIVE & ONLINE! Number: ${this.connectedPhoneNumber}`);
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          this.logger.warn(`WhatsApp session closed (status: ${statusCode}). Logged out: ${isLoggedOut}`);

          if (isLoggedOut) {
            this.sessionState = 'DISCONNECTED';
            this.connectedPhoneNumber = null;
            this.currentQrCodeDataUrl = null;
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            setTimeout(() => this.initSocket(), 1500);
          } else {
            // Crucial: Code 515 (restartRequired) is standard Baileys handshake immediately after QR scan.
            // Do NOT purge credentials, simply reconnect to finalize pairing.
            this.sessionState = 'CONNECTING';
            const reconnectDelay = statusCode === DisconnectReason.restartRequired ? 500 : 2500;
            this.logger.log(`Reconnecting WhatsApp session in ${reconnectDelay}ms...`);
            setTimeout(() => this.initSocket(), reconnectDelay);
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
    } catch (err: any) {
      this.logger.error(`Error initializing Baileys socket: ${err.message}`);
      this.sessionState = 'DISCONNECTED';
    }
  }

  getSessionStatus() {
    const isOnline = this.sessionState === 'ONLINE' && !!this.sock?.user;
    return {
      state: this.sessionState,
      isOnline,
      qrCodeDataUrl: isOnline ? null : this.currentQrCodeDataUrl,
      connectedNumber: isOnline ? this.connectedPhoneNumber : null,
    };
  }

  /**
   * Transmits an ACTUAL, REAL WhatsApp message directly over the live WebSocket protocol
   */
  async sendRealMessage(
    toPhoneNumber: string,
    text: string,
    buttons?: Array<{ id?: string; type: string; text: string; value?: string }>,
  ): Promise<{ success: boolean; messageId: string; error?: string }> {
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

      // Format interactive button CTAs if present
      let finalText = text;
      if (buttons && buttons.length > 0) {
        const buttonLines = buttons.map((b) => {
          if (b.type === 'URL') {
            return `🔗 ${b.text}: ${b.value || 'https://'}`;
          } else if (b.type === 'PHONE') {
            return `📞 ${b.text}: ${b.value || ''}`;
          } else {
            return `👉 ${b.text}`;
          }
        });
        finalText = `${text}\n\n${buttonLines.join('\n')}`;
      }

      this.logger.log(`Transmitting real WhatsApp message to ${jid} over WebSocket...`);
      const sent = await this.sock.sendMessage(jid, { text: finalText });

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
   */
  async generateFreshQr(): Promise<{ success: boolean; qrCodeDataUrl: string | null; error?: string }> {
    if (this.sessionState === 'ONLINE') {
      return { success: false, qrCodeDataUrl: null, error: `Device (${this.connectedPhoneNumber}) is already online.` };
    }

    try {
      this.logger.log('Generating fresh real WhatsApp QR code...');
      if (this.sock) {
        try {
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }

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

    if (this.sessionState === 'ONLINE') {
      throw new Error(`Device (${this.connectedPhoneNumber}) is already linked and online. Unlink first.`);
    }

    try {
      this.logger.log(`Preparing clean pairing handshake for number: ${clean}...`);

      // 1. If not registered/online, reset uncompleted session state to avoid stale creds conflict
      if (this.sock) {
        try {
          this.sock.end(undefined);
        } catch (e) {}
        this.sock = null;
      }

      const sessionDir = this.getSessionDir();
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      // 2. Initialize fresh socket
      await this.initSocket();

      // 3. Wait until WebSocket is open and ready to accept IQ stanzas (max 10s)
      const startTime = Date.now();
      while (Date.now() - startTime < 10000) {
        if (this.sock && (this.sock.ws as any)?.isOpen) {
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!this.sock || !(this.sock.ws as any)?.isOpen) {
        throw new Error('Connection timed out waiting for WhatsApp servers. Please retry.');
      }

      // Ensure initial hello handshake completes
      await new Promise((r) => setTimeout(r, 1000));

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
      if (this.sock) {
        await this.sock.logout();
      }
      const sessionDir = this.getSessionDir();
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      this.sessionState = 'DISCONNECTED';
      this.connectedPhoneNumber = null;
      this.currentQrCodeDataUrl = null;
      setTimeout(() => this.initSocket(), 1000);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

