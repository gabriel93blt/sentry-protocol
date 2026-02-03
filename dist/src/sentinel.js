"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentinelEngine = exports.Verdict = void 0;
const web3_js_1 = require("@solana/web3.js");
var Verdict;
(function (Verdict) {
    Verdict["Safe"] = "safe";
    Verdict["Danger"] = "danger";
})(Verdict || (exports.Verdict = Verdict = {}));
class SentinelEngine {
    constructor(program, wallet, connection) {
        this.program = program;
        this.wallet = wallet;
        this.connection = connection;
    }
    async isRegistered() {
        const [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), this.wallet.publicKey.toBuffer()], this.program.programId);
        try {
            await this.program.account.sentinel.fetch(sentinelPda);
            return true;
        }
        catch {
            return false;
        }
    }
    async register(stakeAmountSol = 0.1) {
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], this.program.programId);
        const [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), this.wallet.publicKey.toBuffer()], this.program.programId);
        const tx = await this.program.methods
            .registerSentinel()
            .accounts({
            protocol: protocolPda,
            sentinel: sentinelPda,
            stake: this.wallet.publicKey,
            authority: this.wallet.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        await this.connection.confirmTransaction(tx);
        return tx;
    }
    async analyzeToken(mint) {
        console.log(`[ENGINE] Analyzing ${mint.toBase58()}...`);
        // Placeholder for real analysis logic (RugCheck API, Metadata check, etc.)
        // For now, it is a randomized logic for the demo engine
        const rand = Math.random();
        if (rand > 0.5) {
            return { verdict: Verdict.Safe, confidence: 90 + Math.floor(Math.random() * 10), reasoning: "Low holder concentration, metadata verified." };
        }
        else {
            return { verdict: Verdict.Danger, confidence: 95 + Math.floor(Math.random() * 5), reasoning: "High concentration, authority not renounced." };
        }
    }
    async submitVerdict(mint, result) {
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], this.program.programId);
        const [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), this.wallet.publicKey.toBuffer()], this.program.programId);
        const [analysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), mint.toBuffer()], this.program.programId);
        const [votePda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vote'), mint.toBuffer(), this.wallet.publicKey.toBuffer()], this.program.programId);
        const verdictParam = result.verdict === Verdict.Safe ? { safe: {} } : { danger: {} };
        const tx = await this.program.methods
            .submitVerdict(mint, verdictParam, result.confidence)
            .accounts({
            protocol: protocolPda,
            sentinel: sentinelPda,
            tokenAnalysis: analysisPda,
            sentinelVote: votePda,
            authority: this.wallet.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return tx;
    }
    // Real-time listener using logs
    async startMonitoring(callback) {
        console.log("[ENGINE] Starting Real-Time Monitoring via WebSockets...");
        // Listen for 'InitializeMint' or common swap program logs
        // Raydium: 675kPX9MHTjS2zt1qfr1NYRZYWDUYmSCPQ6tLpCcSrB3
        // Pump.fun: 6EF8rrecthR5DkZJ4zFLYZ9Z6Z1vMTbdUshNoCwf8EB
        const TARGET_PROGRAMS = [
            new web3_js_1.PublicKey('6EF8rrecthR5DkZJ4zFLYZ9Z6Z1vMTbdUshNoCwf8EB'), // Pump.fun
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
exports.SentinelEngine = SentinelEngine;
