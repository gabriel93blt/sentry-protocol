import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import { Sentry } from '../target/types/sentry';
import { SentinelEngine, Verdict } from '../src/sentinel';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const homeDir = os.homedir();
  const keypairPath = `${homeDir}/.config/solana/sentinel-2.json`;
  const walletArr = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(walletArr));
  const wallet = new anchor.Wallet(keypair);

  const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8')) as Sentry;
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const program = new Program<Sentry>(idl, provider);

  const engine = new SentinelEngine(program, wallet, connection);

  console.log('--- 🤖 SENTINEL-2 (The Twin) ---');
  console.log('Wallet:', wallet.publicKey.toBase58());
  
  // 1. Check Balance & Airdrop if needed
  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < 0.2 * 1e9) {
      console.log('Low balance. Requesting Airdrop...');
      try {
        const sig = await connection.requestAirdrop(wallet.publicKey, 1 * 1e9);
        await connection.confirmTransaction(sig);
        console.log('Airdrop received.');
      } catch (e) {
          console.log('Airdrop failed (rate limit?), trying to proceed or wait.');
      }
  }

  // 2. Register
  if (!(await engine.isRegistered())) {
    console.log('Sentinel-2 not registered. Registering...');
    try {
        await engine.register(0.1);
        console.log('Sentinel-2 Registered.');
    } catch (e) {
        console.error("Registration failed:", e);
        // If registration fails (e.g. insufficient funds), we can't vote.
        return;
    }
  } else {
    console.log('Sentinel-2 is active.');
  }

  // 3. Monitor (Same Logic as Sentinel 1)
  engine.startMonitoring(async (mint) => {
    console.log(`[SENTINEL-2] New Token: ${mint.toBase58()}`);
    // Add some "personality" delay
    await new Promise(r => setTimeout(r, 2000));
    
    const analysis = await engine.analyzeToken(mint);
    // Sentinel-2 is slightly more paranoid (higher confidence on danger)
    if (analysis.verdict === Verdict.Danger) {
        analysis.confidence = Math.min(100, analysis.confidence + 1);
    }
    
    console.log(`[SENTINEL-2] Verdict: ${analysis.verdict} (${analysis.confidence}%)`);
    try {
        const tx = await engine.submitVerdict(mint, analysis);
        console.log(`[SENTINEL-2] Voted! Tx: ${tx}`);
    } catch (e) {
        console.log(`[SENTINEL-2] Failed to vote: ${e}`);
    }
  });

  console.log('Sentinel-2 Listening... (Ctrl+C to stop)');
}

main().catch(console.error);
