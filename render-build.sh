#!/bin/bash
# Build script for Render - Simplified version without Solana CLI dependency

set -e

echo "🛠️  SENTRY Build Script"

# Skip Solana CLI install - we'll check deployment status via API instead
echo "⚠️  Skipping Solana CLI installation (SSL issues on Render)"
echo "   Program deployment must be done manually or via external faucet"

# Just build the API
echo "📦 Building API..."
cd api
npm install
npm run build

echo ""
echo "🎉 Build complete!"
echo ""
echo "⚠️  IMPORTANT: Program is NOT deployed yet!"
echo "   New Program ID: 2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY"
echo ""
echo "To deploy:"
echo "1. Go to https://faucet.solana.com"
echo "2. Request SOL for: 3zvtcDRtfDV4MxA7B4huiWVVnBKzs7UcV2L8Q9hnUpSx"
echo "3. Call POST /api/v1/admin/initialize once deployed"
echo ""
