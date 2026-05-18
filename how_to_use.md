# 🚀 WhatsApp Status Scheduler - Quick Start Guide

I have built a complete system for you to schedule your WhatsApp Business status updates. The system consists of a **Node.js backend** that handles the WhatsApp connection and a **React dashboard** for management.

## 🛠 How to Use

### 1. Link your WhatsApp
- Open the dashboard at [http://localhost:5173/](http://localhost:5173/).
- You will see a **QR Code** on the left side of the screen.
- Open WhatsApp on your phone -> **Settings** -> **Linked Devices** -> **Link a Device**.
- Scan the QR code. Once scanned, the status at the top will change to **Connected**.

### 2. Schedule a Status Update
- In the **New Status** section:
    - Choose **Image** or **Video**.
    - Upload your media file.
    - Type a **Caption** for your status.
    - Select the **Schedule Time** (must be in the future).
- Click **Schedule Status**.

### 3. Track Updates
- Your scheduled updates will appear in the **Scheduled History** column.
- The system checks every minute for pending updates.
- Once the scheduled time is reached, the status will be posted automatically, and the badge will turn green (**sent**).

## 📁 Project Structure
- `server/`: Node.js backend using `@whiskeysockets/baileys`.
- `client/`: React frontend using Vite and Lucide icons.
- `server/uploads/`: Stores your uploaded media until they are posted.
- `server/db.json`: Local database storing your schedule history.

> [!IMPORTANT]
> Keep the server running (`npm run dev` in the `server` folder) for the schedules to trigger. If the server is offline, it will post any missed schedules as soon as it's back online.

> [!WARNING]
> Using unofficial libraries for WhatsApp automation carries a small risk of account suspension if used for spam. Since this is for your own business status updates, it is generally safe, but avoid posting hundreds of updates rapidly.
