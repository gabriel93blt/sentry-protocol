import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import { Sentry } from '../target/types/sentry';
import { SentinelEngine } from '../src/sentinel';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const homeDir = os.homedir();
  const keypairPath = `${homeDir}/.config/solana/sentry-dev.json`;
  const walletArr = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(walletArr));
  const wallet = new anchor.Wallet(keypair);

  const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8')) as Sentry;
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const program = new Program<Sentry>(idl, provider);

  const engine = new SentinelEngine(program, wallet, connection);

  console.log('--- SENTRY REAL-TIME SENTINEL ---');
  
  if (!(await engine.isRegistered())) {
    console.log('Sentinel not registered. Registering...');
    await engine.register(0.1);
    console.log('Registered.');
  } else {
    console.log('Sentinel is active.');
  }

  // Monitor for real launches (Pump.fun on mainnet would be better, but we stick to logs for demo)
  engine.startMonitoring(async (mint) => {
    console.log(`[REALTIME] New Token Found: ${mint.toBase58()}`);
    const analysis = await engine.analyzeToken(mint);
    console.log(`[REALTIME] Verdict: ${analysis.verdict} (${analysis.confidence}%)`);
    const tx = await engine.submitVerdict(mint, analysis);
    console.log(`[REALTIME] Submitted! Tx: ${tx}`);
  });

  console.log('Listening for Solana logs... (Ctrl+C to stop)');
}

main().catch(console.error);
