import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';
import QRCode from 'qrcode';
import { waClient } from './whatsapp.js';
import { JSONFilePreset } from 'lowdb/node';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// Ensure persistent data directories exist
if (!fs.existsSync('data/uploads')) {
    fs.mkdirSync('data/uploads', { recursive: true });
}

app.use('/uploads', express.static('data/uploads'));
app.use(express.static(path.join(__dirname, 'public')));

// DB Setup
const defaultData = { schedules: [] };
const db = await JSONFilePreset('data/db.json', defaultData);

// Multer Setup
const storage = multer.diskStorage({
    destination: 'data/uploads/',
    filename: (req, file, cb) => {
        cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage });

// API Endpoints
app.get('/api/wa-status', async (req, res) => {
    let qrImage = null;
    if (waClient.qr) {
        qrImage = await QRCode.toDataURL(waClient.qr);
    }
    res.json({
        connected: waClient.isConnected,
        qr: qrImage
    });
});

app.post('/api/schedule', upload.single('media'), async (req, res) => {
    const { caption, scheduledTime, type } = req.body;
    const mediaPath = req.file ? req.file.path : null;

    const newSchedule = {
        id: uuidv4(),
        caption,
        scheduledTime,
        type: type || 'image',
        mediaPath,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    db.data.schedules.push(newSchedule);
    await db.write();

    res.json(newSchedule);
});

app.get('/api/schedules', (req, res) => {
    res.json(db.data.schedules);
});

app.delete('/api/schedule/:id', async (req, res) => {
    const { id } = req.params;
    const schedule = db.data.schedules.find(s => s.id === id);
    
    if (schedule && schedule.mediaPath) {
        if (fs.existsSync(schedule.mediaPath)) {
            fs.unlinkSync(schedule.mediaPath);
        }
    }

    db.data.schedules = db.data.schedules.filter(s => s.id !== id);
    await db.write();
    res.json({ success: true });
});

app.patch('/api/schedule/:id/done', async (req, res) => {
    const { id } = req.params;
    const item = db.data.schedules.find(s => s.id === id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    item.status = 'posted';
    item.postedAt = new Date().toISOString();
    await db.write();
    res.json(item);
});

// Catch-all route to serve React app for non-API requests
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Scheduler Cron — fires every minute, marks items as "ready" when their time arrives
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const pending = db.data.schedules.filter(s => s.status === 'pending');

    let changed = false;
    for (const item of pending) {
        const scheduleTime = new Date(item.scheduledTime);
        if (scheduleTime <= now) {
            console.log(`⏰ REMINDER: Status is ready to post — ${item.id}`);
            item.status = 'ready';
            item.readyAt = new Date().toISOString();
            changed = true;

            // Send WhatsApp message reminder
            try {
                const timeStr = new Date(item.scheduledTime).toLocaleString();
                await waClient.sendReminder('254731811933', item.mediaPath, item.caption, timeStr, item.type);
                console.log('✅ WhatsApp reminder sent to 254731811933');
            } catch (err) {
                console.error('❌ Failed to send WhatsApp reminder:', err.message);
            }
        }
    }
    if (changed) await db.write();
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
