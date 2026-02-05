#!/usr/bin/env node
// Deploy SENTRY program on Render startup if not already deployed

const { Connection, PublicKey, Keypair, sendAndConfirmTransaction, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const { execSync } = require('child_process');

const PROGRAM_ID = new PublicKey('2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY');
const CLUSTER = 'https://api.devnet.solana.com';

async function deploy() {
  console.log('🔍 Checking if SENTRY is deployed...');
  
  const connection = new Connection(CLUSTER, 'confirmed');
  const programInfo = await connection.getAccountInfo(PROGRAM_ID);
  
  if (programInfo) {
    console.log('✅ SENTRY already deployed at:', PROGRAM_ID.toBase58());
    console.log('   Program size:', programInfo.data.length, 'bytes');
    return;
  }
  
  console.log('⚠️  SENTRY not deployed. Starting deployment...');
  
  // Check balance
  const walletKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('./wallet.json'))));
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log('Deployer:', walletKeypair.publicKey.toBase58());
  console.log('Balance:', (balance / 1e9).toFixed(4), 'SOL');
  
  if (balance < 2.4 * 1e9) {
    console.error('❌ Insufficient balance. Need at least 2.4 SOL');
    console.error('   Request airdrop: https://faucet.solana.com');
    process.exit(1);
  }
  
  // Try to use solana CLI if available
  try {
    console.log('📦 Attempting deployment via solana CLI...');
    execSync('solana --version', { stdio: 'ignore' });
    
    // Set config
    execSync('solana config set --url https://api.devnet.solana.com --keypair ./wallet.json', { stdio: 'inherit' });
    
    // Deploy
    console.log('🚀 Deploying...');
    execSync(`solana program deploy ./target/deploy/sentry.so --program-id ./target/deploy/sentry-keypair.json`, { 
      stdio: 'inherit',
      timeout: 120000
    });
    
    console.log('✅ Deployment successful!');
  } catch (e) {
    console.error('❌ Deployment failed:', e.message);
    console.error('   You may need to deploy manually using:');
    console.error('   solana program deploy ./target/deploy/sentry.so --program-id ./target/deploy/sentry-keypair.json');
    process.exit(1);
  }
}

deploy().catch(console.error);
