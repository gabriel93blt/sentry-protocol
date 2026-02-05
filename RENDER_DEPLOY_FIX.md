# SENTRY Deployment Guide for Render

## 🚨 Current Issue: Solana CLI SSL Error

The automatic Solana CLI installation fails on Render due to SSL connection issues.

## ✅ Solution: Manual Deployment Steps

### Step 1: Build Succeeds (Automatic)
The build will now complete without trying to install Solana CLI.

### Step 2: Get SOL from Faucet (Manual)

1. Go to **https://faucet.solana.com**
2. Enter wallet address: `3zvtcDRtfDV4MxA7B4huiWVVnBKzs7UcV2L8Q9hnUpSx`
3. Request 2-3 SOL
4. Wait 30 seconds for confirmation

### Step 3: Check Status

```bash
curl https://sentry-y3vs.onrender.com/api/v1/admin/status
```

Expected response:
```json
{
  "success": true,
  "status": {
    "programDeployed": false,
    "walletBalance": 0.0
  }
}
```

### Step 4: Deploy Program

**Option A: Via Web Faucet + API**

Since we can't use Solana CLI on Render, use this workaround:

1. First, ensure wallet has 2.5+ SOL from faucet
2. The API will show status but can't deploy without CLI

**Option B: Local Deployment (Recommended)**

Deploy from your local machine:

```bash
# Clone repo
git clone https://github.com/gabriel93blt/sentry-protocol.git
cd sentry-protocol

# Install Solana CLI (if not already)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Set config
solana config set --url https://api.devnet.solana.com
solana config set --keypair wallet.json

# Deploy
solana program deploy target/deploy/sentry.so \
    --program-id target/deploy/sentry-keypair.json

# Initialize protocol
anchor run setup
```

**Option C: Use Old Program ID (Quick)**

Revert to the previously deployed program:

1. Change Program ID back to `EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm`
2. The contract is already deployed there

### Step 5: Initialize Protocol

Once deployed, call:

```bash
curl -X POST https://sentry-y3vs.onrender.com/api/v1/admin/initialize
```

## 🔄 Alternative: Revert to Old Program

If deployment is too complex, revert to the old working program:

```bash
# Reset to old Program ID
git checkout f3eb398 -- programs/sentry/src/lib.rs Anchor.toml
```

## 📊 Current Status

| Component | Status |
|-----------|--------|
| API Build | ✅ Working |
| Dashboard | ✅ Working |
| New Program ID | `2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY` (Not deployed) |
| Old Program ID | `EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm` (Deployed, has fake data) |

## 🎯 Recommendation

**For quick testing:** Use Option C (revert to old Program ID)

**For clean deployment:** Use Option B (local deployment with Solana CLI)

**For production:** Deploy on Mainnet (requires real SOL ~$500)
