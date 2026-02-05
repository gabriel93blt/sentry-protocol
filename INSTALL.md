# SENTRY Protocol - Installation Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# API dependencies
cd api && npm install
```

### 2. Setup Wallets

```bash
# Copy your wallet to the project
cp ~/.config/solana/id.json ./wallet.json

# Or generate new ones
solana-keygen new -o wallet.json        # Admin wallet
solana-keygen new -o sentinel-wallet.json  # Bot wallet
```

### 3. Configure Environment

```bash
cp api/.env.example api/.env
# Edit api/.env with your settings
```

### 4. Run the API

```bash
cd api
npm start
```

API will be available at `http://localhost:3001`

### 5. Run the Sentinel Bot

```bash
# First, register as sentinel (need SOL for stake)
anchor run register-sentinel -- --stake 0.1

# Then run the bot
npx ts-node scripts/sentinel-bot.ts
```

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/protocol/stats` | GET | Protocol statistics |
| `/api/v1/agents` | GET | List all agents |
| `/api/v1/agents/:id` | GET | Get agent details |
| `/api/v1/agents/register` | POST | Register new agent |
| `/api/v1/verdicts` | GET | List all verdicts |
| `/api/v1/verdicts` | POST | Submit verdict |
| `/api/v1/verdicts/:mint/finalize` | POST | Finalize consensus |
| `/api/v1/claims` | POST | Claim rewards |
| `/shield/:mint` | GET | Check if token is safe |

## 🔐 Environment Variables

```env
NETWORK=devnet                    # or 'mainnet'
PORT=3001
ADMIN_WALLET_PATH=./wallet.json   # Admin wallet
SENTINEL_WALLET_PATH=./sentinel-wallet.json  # Bot wallet
MOLTBOOK_API_KEY=xxx              # Optional Moltbook integration
```

## 🌐 Deploy to Mainnet

```bash
./scripts/deploy-mainnet.sh
```

## 📊 Monitoring

```bash
# Check API logs
pm2 logs sentry-api

# Check bot status
pm2 status
```

## 🆘 Troubleshooting

**Error: "Admin wallet not found"**
→ Create wallet.json or set ADMIN_PRIVATE_KEY in .env

**Error: "Insufficient funds"**
→ Airdrop SOL: `solana airdrop 2 $(solana address)`

**Error: "Program not found"**
→ Deploy first: `anchor deploy`
