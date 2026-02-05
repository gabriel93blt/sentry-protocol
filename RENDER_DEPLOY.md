# SENTRY Render Deployment Guide

## 🚀 Deploy to Render (New v2.0 API)

### Option 1: Update Existing Service (Fastest)

1. Go to: https://dashboard.render.com/web/services
2. Find your existing service `sentry-y3vs` or create new
3. **Settings** → **Build & Deploy**:
   - **Build Command:** `cd api && npm install`
   - **Start Command:** `cd api && npm start`
   - **Root Directory:** (leave empty or `.`)
4. **Environment Variables**:
   ```
   NODE_ENV=production
   NETWORK=devnet
   ADMIN_WALLET_PATH=./wallet.json
   SENTINEL_WALLET_PATH=./sentinel-wallet.json
   ```
5. **Deploy** → **Manual Deploy** → **Clear Build Cache & Deploy**

### Option 2: Blueprint Deploy (Recommended)

1. Go to: https://dashboard.render.com/blueprints
2. Click **New Blueprint Instance**
3. Connect your GitHub repo: `gabriel93blt/sentry-protocol`
4. Select `render.yaml` file
5. Click **Apply**
6. Render will auto-create the web service

### Option 3: Manual Web Service

1. Go to: https://dashboard.render.com/web/new
2. **Build from Git repo**
3. Connect: `https://github.com/gabriel93blt/sentry-protocol`
4. **Settings**:
   - **Name:** sentry-api-v2
   - **Region:** Oregon (US West)
   - **Branch:** main
   - **Build Command:** `cd api && npm install`
   - **Start Command:** `cd api && npm start`
5. **Advanced**:
   - **Health Check Path:** `/health`
6. Add Environment Variables (see below)
7. Click **Create Web Service**

---

## 🔐 Environment Variables (Required)

```
NODE_ENV=production
NETWORK=devnet
ADMIN_WALLET_PATH=./wallet.json
SENTINEL_WALLET_PATH=./sentinel-wallet.json
MOLTBOOK_API_KEY=your_key_here  # Optional
```

---

## ⚠️ IMPORTANT: Wallet Files

**The wallet.json files must be committed to the repo for Render to access them.**

```bash
# Check they're tracked
git ls-files | grep wallet

# Should show:
# sentinel-wallet.json
# wallet.json
```

**Security Note:** These are devnet wallets with minimal funds. For production:
1. Use Render Environment Variables instead
2. Store private keys in `ADMIN_PRIVATE_KEY` env var
3. Remove wallet files from repo

---

## ✅ Verification After Deploy

Once deployed, test:
```bash
curl https://YOUR-RENDER-URL.onrender.com/health
```

Expected response:
```json
{
  "status": "operational",
  "version": "2.0.0",
  "network": "devnet",
  "program": "EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm",
  "admin": "3zvtcDRtfDV4MxA7B4huiWVVnBKzs7UcV2L8Q9hnUpSx"
}
```

---

## 🌐 Current Status

**Old API (v1):** https://sentry-y3vs.onrender.com/  
**New API (v2):** https://sentry-api-v2.onrender.com/ (after deploy)

The v1 is still running but uses different endpoints. Update your dashboard to use the new v2 endpoints:
- `/api/v1/agents` → List agents
- `/api/v1/verdicts` → List verdicts
- `/api/v1/protocol/stats` → Stats
