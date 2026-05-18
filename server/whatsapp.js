import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import { EventEmitter } from 'events';
import fs from 'fs';

class WhatsAppClient extends EventEmitter {
    constructor() {
        super();
        this.sock = null;
        this.qr = null;
        this.isConnected = false;
        this.authDir = path.resolve('data/auth_info');
    }

    async init() {
        const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
        
        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            browser: ["WhatsApp Scheduler", "Chrome", "1.0.0"]
        });

        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                this.qr = qr;
                this.emit('qr', qr);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
                this.isConnected = false;
                this.emit('status', 'disconnected');
                if (shouldReconnect) {
                    this.init();
                } else {
                    console.log('Logged out or session invalid. Clearing auth and restarting...');
                    if (fs.existsSync(this.authDir)) {
                        fs.rmSync(this.authDir, { recursive: true, force: true });
                    }
                    setTimeout(() => this.init(), 2000);
                }
            } else if (connection === 'open') {
                console.log('opened connection');
                this.isConnected = true;
                this.qr = null;
                this.emit('status', 'connected');
            }
        });

        this.sock.ev.on('creds.update', saveCreds);
    }

    async postStatus(mediaPath, caption, type = 'image') {
        if (!this.isConnected) throw new Error('WhatsApp not connected');

        const media = fs.readFileSync(mediaPath);
        const statusRecipient = 'status@broadcast';

        const statusOptions = {
            backgroundColor: '#000000',
            font: 1,
            statusJidList: [this.sock.user.id] // Adding own JID to ensure it appears in "My Status"
        };

        if (type === 'image') {
            await this.sock.sendMessage(statusRecipient, {
                image: media,
                caption: caption,
                broadcast: true
            }, statusOptions);
        } else if (type === 'video') {
            await this.sock.sendMessage(statusRecipient, {
                video: media,
                caption: caption,
                broadcast: true
            }, statusOptions);
        } else {
            await this.sock.sendMessage(statusRecipient, {
                text: caption,
                broadcast: true
            }, statusOptions);
        }
    }

    async sendReminder(phone, mediaPath, caption, timeStr, type = 'image') {
        if (!this.isConnected) throw new Error('WhatsApp not connected');

        const jid = `${phone.replace('+', '')}@s.whatsapp.net`;
        const media = fs.readFileSync(mediaPath);
        const text = `⏰ *STATUS REMINDER*\n\n*Time:* ${timeStr}\n*Caption:* ${caption || 'None'}\n\n_Forward this to your Status._`;

        if (type === 'image') {
            await this.sock.sendMessage(jid, { image: media, caption: text });
        } else if (type === 'video') {
            await this.sock.sendMessage(jid, { video: media, caption: text });
        }
    }
}

export const waClient = new WhatsAppClient();
waClient.init();
