# 🤖 Vercel Crypto Bot

Telegram bot yang memantau token crypto baru dari cookin.fun dan mengirim notifikasi otomatis menggunakan Vercel serverless functions.

![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)

## ✨ Fitur

- ✅ Monitor real-time cookin.fun
- ✅ Notifikasi otomatis ke Telegram
- ✅ Cron job setiap 5 menit
- ✅ Manual trigger endpoint
- ✅ Status monitoring dashboard
- ✅ State persistence dengan Redis/Upstash
- ✅ Support multi-chat/channel

## 🚀 Deployment Cepat

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/vercel-crypto-bot)

**1-Click Deploy:**
1. Klik tombol "Deploy to Vercel" di atas
2. Connect GitHub account
3. Atur environment variables:
   - `BOT_TOKEN`: Token bot Telegram dari @BotFather
   - `CHAT_ID`: ID chat/channel Telegram
   - `REDIS_URL`: (Opsional) URL Redis untuk state
4. Deploy!

## ⚙️ Setup Manual

```bash
# Clone repository
git clone https://github.com/yourusername/vercel-crypto-bot.git
cd vercel-crypto-bot

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local dengan token bot dan chat ID

# Deploy ke Vercel
npm run deploy
