#!/usr/bin/env node
// Setup script for Render - creates wallet files from env vars

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up SENTRY wallets...');

// Admin wallet from base64 env var
if (process.env.ADMIN_WALLET_BASE64) {
  try {
    const walletJson = Buffer.from(process.env.ADMIN_WALLET_BASE64, 'base64').toString('utf8');
    fs.writeFileSync('./wallet.json', walletJson);
    console.log('✅ Admin wallet created from ADMIN_WALLET_BASE64');
  } catch (e) {
    console.error('❌ Failed to create admin wallet:', e.message);
    process.exit(1);
  }
} else if (process.env.ADMIN_PRIVATE_KEY) {
  try {
    const keyArray = JSON.parse(process.env.ADMIN_PRIVATE_KEY);
    fs.writeFileSync('./wallet.json', JSON.stringify(keyArray));
    console.log('✅ Admin wallet created from ADMIN_PRIVATE_KEY');
  } catch (e) {
    console.error('❌ Failed to create admin wallet:', e.message);
    process.exit(1);
  }
} else {
  console.log('⚠️ No admin wallet env var found, using file if exists');
}

// Sentinel wallet
if (process.env.SENTINEL_WALLET_BASE64) {
  try {
    const walletJson = Buffer.from(process.env.SENTINEL_WALLET_BASE64, 'base64').toString('utf8');
    fs.writeFileSync('./sentinel-wallet.json', walletJson);
    console.log('✅ Sentinel wallet created from SENTINEL_WALLET_BASE64');
  } catch (e) {
    console.error('❌ Failed to create sentinel wallet:', e.message);
  }
}

console.log('✅ Setup complete');
