import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import { Sentry } from '../target/types/sentry';

async function main() {
  const connection = new anchor.web3.Connection('https://api.devnet.solana.com', 'confirmed');
  const homeDir = os.homedir();
  const keypairPath = `${homeDir}/.config/solana/sentry-dev.json`;
  const wallet = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8')) as Sentry;
  // Use Program<Sentry>(idl, provider) to avoid type/argument ambiguity
  const program = new Program<Sentry>(idl, provider);

  const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('protocol')], program.programId);
  const [sentinelPda] = PublicKey.findProgramAddressSync([Buffer.from('sentinel'), wallet.publicKey.toBuffer()], program.programId);

  console.log('--- SENTRY SENTINEL BOT ---');
  console.log('Sentinel Wallet:', wallet.publicKey.toBase58());

  // 1. Check/Register Sentinel
  try {
    const sentinelAccount = await program.account.sentinel.fetch(sentinelPda);
    console.log('Status: Registered');
    console.log('Stake:', sentinelAccount.stake.toNumber() / LAMPORTS_PER_SOL, 'SOL');
    console.log('Reputation:', sentinelAccount.reputation);
  } catch (e) {
    console.log('Status: Not Registered. Registering with 0.1 SOL stake...');
    try {
      const tx = await (program.methods as any)
        .registerSentinel()
        .accounts({
          protocol: protocolPda,
          sentinel: sentinelPda,
          stake: wallet.publicKey,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log('Registration successful! Tx:', tx);
      await connection.confirmTransaction(tx);
    } catch (regError) {
      console.error('Registration failed:', regError);
      return;
    }
  }

  // 2. Main Loop: Monitoring Token Launches
  console.log('\nMonitoring for new tokens... (Simulated for Hackathon Demo)');
  
  const mockTokens = [
    { mint: anchor.web3.Keypair.generate().publicKey, name: 'SAFE_TOKEN', expected: 'safe' },
    { mint: anchor.web3.Keypair.generate().publicKey, name: 'RUG_COIN', expected: 'danger' }
  ];

  for (const token of mockTokens) {
    console.log(`\n[ANALYSIS] Analyzing Token: ${token.name} (${token.mint.toBase58()})`);
    
    const isSafe = token.expected === 'safe';
    const confidence = isSafe ? 95 : 99;
    const verdict = isSafe ? { safe: {} } : { danger: {} };

    console.log(`Result: ${token.expected.toUpperCase()} (Confidence: ${confidence}%)`);

    // 3. Submit Verdict
    const [analysisPda] = PublicKey.findProgramAddressSync([Buffer.from('analysis'), token.mint.toBuffer()], program.programId);
    const [votePda] = PublicKey.findProgramAddressSync([Buffer.from('vote'), token.mint.toBuffer(), wallet.publicKey.toBuffer()], program.programId);

    try {
      const tx = await (program.methods as any)
        .submitVerdict(token.mint, verdict, confidence)
        .accounts({
          protocol: protocolPda,
          sentinel: sentinelPda,
          tokenAnalysis: analysisPda,
          sentinelVote: votePda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log(`Verdict Submitted! Tx: ${tx}`);
    } catch (err) {
      console.error('Failed to submit verdict:', err);
    }
  }

  console.log('\nSentinel operations completed for this cycle.');
}

main().catch(console.error);
