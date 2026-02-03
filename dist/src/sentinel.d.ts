import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
import { Sentry } from '../target/types/sentry';
export declare enum Verdict {
    Safe = "safe",
    Danger = "danger"
}
export interface AnalysisResult {
    verdict: Verdict;
    confidence: number;
    reasoning: string;
}
export declare class SentinelEngine {
    private program;
    private wallet;
    private connection;
    constructor(program: Program<Sentry>, wallet: anchor.Wallet, connection: Connection);
    isRegistered(): Promise<boolean>;
    register(stakeAmountSol?: number): Promise<string>;
    analyzeToken(mint: PublicKey): Promise<AnalysisResult>;
    submitVerdict(mint: PublicKey, result: AnalysisResult): Promise<string>;
    startMonitoring(callback: (mint: PublicKey) => void): Promise<void>;
}
