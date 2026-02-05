#!/bin/bash

# SENTRY Mainnet Deployment Script
# Usage: ./deploy-mainnet.sh

set -e

echo "🛡️ SENTRY Mainnet Deployment"
echo "=============================="

# Check prerequisites
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Install from https://docs.solana.com/cli/install"
    exit 1
fi

if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found. Install: cargo install --git https://github.com/coral-xyz/anchor avm"
    exit 1
fi

# Get wallet balance
WALLET=$(solana address)
echo "📍 Deployer: $WALLET"

BALANCE=$(solana balance)
echo "💰 Balance: $BALANCE SOL"

# Check if enough balance (need ~2.5 SOL for deployment)
REQUIRED_BALANCE=2.5
if (( $(echo "$BALANCE < $REQUIRED_BALANCE" | bc -l) )); then
    echo "❌ Insufficient balance. Need at least $REQUIRED_BALANCE SOL"
    echo "   Fund this wallet before deploying:"
    echo "   solana airdrop 3 $WALLET  # devnet only"
    exit 1
fi

# Confirm mainnet
CONFIG=$(solana config get | grep "RPC URL")
echo "🔗 Network: $CONFIG"

if [[ $CONFIG != *"mainnet"* ]]; then
    echo "⚠️  WARNING: Not connected to mainnet!"
    echo "   Current: $CONFIG"
    read -p "   Switch to mainnet? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        solana config set --url https://api.mainnet-beta.solana.com
        echo "✅ Switched to mainnet"
    else
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi

# Build program
echo ""
echo "🔨 Building program..."
anchor build

# Get program ID
PROGRAM_ID=$(solana-address -k target/deploy/sentry-keypair.json 2>/dev/null || echo "")
if [ -z "$PROGRAM_ID" ]; then
    echo "⚠️  Generating new program keypair..."
    solana-keygen new -o target/deploy/sentry-keypair.json --force --no-passphrase
    PROGRAM_ID=$(solana-address -k target/deploy/sentry-keypair.json)
fi

echo "📋 Program ID: $PROGRAM_ID"

# Update declare_id in lib.rs
echo "📝 Updating program ID in source..."
sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/" programs/sentry/src/lib.rs

# Rebuild with correct ID
echo "🔨 Rebuilding with program ID..."
anchor build

# Deploy
echo ""
echo "🚀 Deploying to mainnet..."
echo "   This will cost ~2.2 SOL"
read -p "   Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

anchor deploy --provider.cluster mainnet

echo ""
echo "✅ Deployment complete!"
echo "   Program: $PROGRAM_ID"
echo ""
echo "📋 Next steps:"
echo "   1. Initialize the protocol:"
echo "      anchor run initialize --provider.cluster mainnet"
echo "   2. Update API .env with new PROGRAM_ID"
echo "   3. Redeploy API to production"
echo ""
echo "🔍 Verify on SolanaFM:"
echo "   https://solana.fm/address/$PROGRAM_ID"
