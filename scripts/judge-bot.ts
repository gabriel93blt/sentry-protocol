import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import { Sentry } from '../target/types/sentry';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const homeDir = os.homedir();
  
  // Judge uses the Admin Wallet (required for reportRug in current implementation)
  const keypairPath = `${homeDir}/.config/solana/sentry-dev.json`;
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))))
  );

  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8')) as Sentry;
  const program = new Program<Sentry>(idl, provider);

  console.log('--- ⚖️ SENTRY JUDGE BOT (Ground Truth Oracle) ---');
  console.log('Judge Wallet:', wallet.publicKey.toBase58());

  while (true) {
    try {
      const allAnalysis = await program.account.tokenAnalysis.all();
      const now = Math.floor(Date.now() / 1000);

      const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('v2')], program.programId);
      const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], program.programId);
      const protocol = await program.account.protocol.fetch(protocolPda);
      const windowSeconds = protocol.verdictWindow;

      console.log(`[JUDGE] Scanning ${allAnalysis.length} analyses... (Time: ${now})`);

      for (const record of allAnalysis) {
        const analysis = record.account;
        const pda = record.publicKey;
        const mint = analysis.tokenMint;

        if (!analysis.isFinalized && now > (analysis.createdAt.toNumber() + windowSeconds)) {
          console.log(`[JUDGE] ⏳ Time's up for ${mint.toBase58()}. Finalizing Consensus...`);
          try {
            await program.methods.finalizeConsensus().accounts({
                protocol: protocolPda,
                tokenAnalysis: pda,
            } as any).rpc();
            console.log(`[JUDGE] 🔨 Consensus Finalized!`);
          } catch (e) {
            console.error(`[JUDGE] Failed to finalize:`, e);
          }
        }

        if (analysis.isFinalized && !analysis.isRugged) {
             const mintInfo = await connection.getParsedAccountInfo(mint);
             if (mintInfo.value && 'parsed' in mintInfo.value.data) {
                 const info = mintInfo.value.data.parsed.info;
                 const isActuallyDangerous = info.freezeAuthority !== null;
                 const verdictIsSafe = Object.keys(analysis.finalVerdict)[0] === 'safe';

                 // Check grace period before allowing rug report
                 const gracePeriodExpired = now > (analysis.finalizedAt.toNumber() + protocol.gracePeriod);
                 
                 if (verdictIsSafe && isActuallyDangerous && gracePeriodExpired) {
                     console.log(`[JUDGE] 🚨 SLASHING TRIGGERED for ${mint.toBase58()}`);
                     const evidenceHash = new Array(32).fill(1); 
                     try {
                         await program.methods.reportRug(evidenceHash).accounts({
                                 protocol: protocolPda,
                                 tokenAnalysis: pda,
                                 reporter: wallet.publicKey
                         } as any).rpc();
                         
                         const votes = await program.account.sentinelVote.all();
                         const safeVoters = votes.filter(v => v.account.tokenMint.equals(mint) && !v.account.isSlashed);
                         for (const vote of safeVoters) {
                             const [sentinelPda] = PublicKey.findProgramAddressSync([Buffer.from('sentinel'), vote.account.sentinel.toBuffer()], program.programId);
                             await program.methods.slashSentinel().accounts({
                                     protocol: protocolPda,
                                     vault: vaultPda,
                                     sentinel: sentinelPda,
                                     sentinelVote: vote.publicKey,
                                     tokenAnalysis: pda,
                                     admin: wallet.publicKey,
                             } as any).rpc();
                             console.log(`[JUDGE] Slashed ${vote.account.sentinel.toBase58()}`);
                         }
                     } catch (e) { console.error(e); }
                 } else if (verdictIsSafe && !isActuallyDangerous && (now > analysis.finalizedAt.toNumber() + 60)) {
                     console.log(`[JUDGE] ✅ REWARDS TRIGGERED for ${mint.toBase58()}`);
                     try {
                         const votes = await program.account.sentinelVote.all();
                         const correctVoters = votes.filter(v => v.account.tokenMint.equals(mint) && !v.account.isRewarded);
                         for (const vote of correctVoters) {
                             const [sentinelPda] = PublicKey.findProgramAddressSync([Buffer.from('sentinel'), vote.account.sentinel.toBuffer()], program.programId);
                             await program.methods.rewardSentinel().accounts({
                                 protocol: protocolPda,
                                 vault: vaultPda,
                                 sentinel: sentinelPda,
                                 sentinelVote: vote.publicKey,
                                 tokenAnalysis: pda,
                                 authority: vote.account.sentinel,
                             } as any).rpc();
                             console.log(`[JUDGE] Rewarded ${vote.account.sentinel.toBase58()}`);
                         }
                     } catch (e) { console.error(e); }
                 }
             }
        }
      }
    } catch (err) { console.error(err); }
    await new Promise(r => setTimeout(r, 10000));
  }
}

main().catch(console.error);
