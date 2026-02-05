#!/bin/bash
# Build script for Render - includes Solana CLI installation and deployment

set -e

echo "🛠️  SENTRY Build Script"

# Install Solana CLI if not present
if ! command -v solana &> /dev/null; then
    echo "📥 Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

echo "✅ Solana CLI version:"
solana --version

# Set config
echo "🔧 Configuring Solana..."
solana config set --url https://api.devnet.solana.com
solana config set --keypair ./wallet.json

# Check balance
echo "💰 Checking balance..."
BALANCE=$(solana balance | cut -d' ' -f1)
echo "Balance: $BALANCE SOL"

# Deploy if needed
echo "🚀 Checking program status..."
if solana program show 2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY 2>/dev/null; then
    echo "✅ Program already deployed"
else
    echo "📦 Deploying program..."
    solana program deploy ./target/deploy/sentry.so \
        --program-id ./target/deploy/sentry-keypair.json \
        --max-len 500000
    echo "✅ Deployment complete!"
fi

# Build API
echo "📦 Building API..."
cd api
npm install
npm run build

echo "🎉 Build complete!"
