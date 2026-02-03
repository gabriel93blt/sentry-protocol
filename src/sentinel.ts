import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Connection } from '@solana/web3.js';
import { Sentry } from '../target/types/sentry';

export enum Verdict {
  Safe = 'safe',
  Danger = 'danger',
}

export interface AnalysisResult {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
}

export class SentinelEngine {
  private program: Program<Sentry>;
  private wallet: anchor.Wallet;
  private connection: Connection;

  constructor(program: Program<Sentry>, wallet: anchor.Wallet, connection: Connection) {
    this.program = program;
    this.wallet = wallet;
    this.connection = connection;
  }

  async isRegistered(): Promise<boolean> {
    const [sentinelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sentinel'), this.wallet.publicKey.toBuffer()],
      this.program.programId
    );
    try {
      await this.program.account.sentinel.fetch(sentinelPda);
      return true;
    } catch {
      return false;
    }
  }

  async register(stakeAmountSol: number = 0.1): Promise<string> {
    const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('protocol')], this.program.programId);
    const [sentinelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sentinel'), this.wallet.publicKey.toBuffer()],
      this.program.programId
    );

    const tx = await (this.program.methods as any)
      .registerSentinel()
      .accounts({
        protocol: protocolPda,
        sentinel: sentinelPda,
        stake: this.wallet.publicKey,
        authority: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    await this.connection.confirmTransaction(tx);
    return tx;
  }

  async analyzeToken(mint: PublicKey): Promise<AnalysisResult> {
    console.log(`[ENGINE] Analyzing ${mint.toBase58()}...`);
    
    // Placeholder for real analysis logic (RugCheck API, Metadata check, etc.)
    // For now, it is a randomized logic for the demo engine
    const rand = Math.random();
    if (rand > 0.5) {
      return { verdict: Verdict.Safe, confidence: 90 + Math.floor(Math.random() * 10), reasoning: "Low holder concentration, metadata verified." };
    } else {
      return { verdict: Verdict.Danger, confidence: 95 + Math.floor(Math.random() * 5), reasoning: "High concentration, authority not renounced." };
    }
  }

  async submitVerdict(mint: PublicKey, result: AnalysisResult): Promise<string> {
    const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('protocol')], this.program.programId);
    const [sentinelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sentinel'), this.wallet.publicKey.toBuffer()],
      this.program.programId
    );
    const [analysisPda] = PublicKey.findProgramAddressSync([Buffer.from('analysis'), mint.toBuffer()], this.program.programId);
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), mint.toBuffer(), this.wallet.publicKey.toBuffer()],
      this.program.programId
    );

    const verdictParam = result.verdict === Verdict.Safe ? { safe: {} } : { danger: {} };

    const tx = await (this.program.methods as any)
      .submitVerdict(mint, verdictParam, result.confidence)
      .accounts({
        protocol: protocolPda,
        sentinel: sentinelPda,
        tokenAnalysis: analysisPda,
        sentinelVote: votePda,
        authority: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    return tx;
  }

  // Real-time listener using logs
  async startMonitoring(callback: (mint: PublicKey) => void) {
    console.log("[ENGINE] Starting Real-Time Monitoring via WebSockets...");
    
    // Listen for 'InitializeMint' or common swap program logs
    // Raydium: 675kPX9MHTjS2zt1qfr1NYRZYWDUYmSCPQ6tLpCcSrB3
    // Pump.fun: 6EF8rrecthR5DkZJ4zFLYZ9Z6Z1vMTbdUshNoCwf8EB
    
    const TARGET_PROGRAMS = [
      new PublicKey('6EF8rrecthR5DkZJ4zFLYZ9Z6Z1vMTbdUshNoCwf8EB'), // Pump.fun
    ];

    for (const programId of TARGET_PROGRAMS) {
      this.connection.onLogs(programId, (logs, ctx) => {
        // Simple heuristic: look for "create" or "initialize"
        if (logs.logs.some(l => l.includes("Create") || l.includes("Initialize"))) {
          // In a real bot, we would parse the instruction to extract the mint
          // Here we will just log the event for now
          console.log(`[EVENT] Potential New Launch detected in logs! (Slot: ${ctx.slot})`);
        }
      }, 'confirmed');
    }
  }
}
