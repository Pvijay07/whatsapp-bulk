import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
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

  async onModuleInit() {
    this.initSocket().catch((err) => {
      this.logger.warn(`Deferred Baileys socket initialization: ${err.message}`);
    });
  }

  async initSocket() {
    const sessionDir = path.resolve(process.cwd(), 'sessions', 'active_device');
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      this.sessionState = 'CONNECTING';

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ['WhatsApp SaaS Platform', 'Chrome', '1.0.0'],
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
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.sessionState = 'DISCONNECTED';
          this.logger.warn(`WhatsApp session closed (status: ${statusCode}). Reconnect allowed: ${shouldReconnect}`);

          if (shouldReconnect) {
            setTimeout(() => this.initSocket(), 3000);
          } else {
            this.connectedPhoneNumber = null;
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
    return {
      state: this.sessionState,
      isOnline: this.sessionState === 'ONLINE',
      qrCodeDataUrl: this.currentQrCodeDataUrl,
      connectedNumber: this.connectedPhoneNumber,
    };
  }

  /**
   * Transmits an ACTUAL, REAL WhatsApp message directly over the live WebSocket protocol
   */
  async sendRealMessage(toPhoneNumber: string, text: string): Promise<{ success: boolean; messageId: string; error?: string }> {
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

      this.logger.log(`Transmitting real WhatsApp message to ${jid} over WebSocket...`);
      const sent = await this.sock.sendMessage(jid, { text });

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

  async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
      const sessionDir = path.resolve(process.cwd(), 'sessions', 'active_device');
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

