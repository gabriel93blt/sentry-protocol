import { web3, BN } from '@coral-xyz/anchor';
import { PublicKey, Connection } from '@solana/web3.js';
export declare enum Verdict {
    Safe = "safe",
    Danger = "danger"
}
export interface ProtocolConfig {
    minStake: BN;
    verdictWindow: number;
    quorum: number;
    slashPercent: number;
}
export interface Sentinel {
    authority: PublicKey;
    stake: BN;
    reputation: number;
    correctVerdicts: BN;
    totalVerdicts: BN;
    isActive: boolean;
    registeredAt: BN;
}
export interface TokenAnalysis {
    tokenMint: PublicKey;
    createdAt: BN;
    finalizedAt: BN;
    totalVotes: BN;
    safeVotes: BN;
    dangerVotes: BN;
    safeStake: BN;
    dangerStake: BN;
    finalVerdict: Verdict;
    consensusConfidence: number;
    isFinalized: boolean;
    isRugged: boolean;
    rugEvidence: number[];
    rugReportedAt: BN;
    slashPool: BN;
}
export interface SentinelVote {
    sentinel: PublicKey;
    tokenMint: PublicKey;
    verdict: Verdict;
    confidence: number;
    stakeAtVote: BN;
    submittedAt: BN;
    isSlashed: boolean;
    isRewarded: boolean;
}
export declare class SentrySDK {
    private connection;
    private programId;
    constructor(connection: Connection, programId?: PublicKey);
    getProtocolPDA(): [PublicKey, number];
    getSentinelPDA(authority: PublicKey): [PublicKey, number];
    getTokenAnalysisPDA(tokenMint: PublicKey): [PublicKey, number];
    getSentinelVotePDA(tokenMint: PublicKey, sentinel: PublicKey): [PublicKey, number];
    getProtocol(): Promise<any>;
    getSentinel(authority: PublicKey): Promise<Sentinel | null>;
    getTokenAnalysis(tokenMint: PublicKey): Promise<TokenAnalysis | null>;
    getSentinelVote(tokenMint: PublicKey, sentinel: PublicKey): Promise<SentinelVote | null>;
    buildInitializeIx(admin: PublicKey, config: ProtocolConfig): web3.TransactionInstruction;
    buildRegisterSentinelIx(authority: PublicKey, stakeAccount: PublicKey): web3.TransactionInstruction;
    buildSubmitVerdictIx(authority: PublicKey, tokenMint: PublicKey, verdict: Verdict, confidence: number): web3.TransactionInstruction;
    buildFinalizeConsensusIx(tokenMint: PublicKey): web3.TransactionInstruction;
    buildReportRugIx(reporter: PublicKey, tokenMint: PublicKey, evidenceHash: Buffer): web3.TransactionInstruction;
    private deserializeProtocol;
    private deserializeSentinel;
    private deserializeTokenAnalysis;
    private deserializeSentinelVote;
}
export default SentrySDK;
