"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const chai_1 = require("chai");
describe('sentry', () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.Sentry;
    let protocolPda;
    let sentinelPda;
    let tokenAnalysisPda;
    let votePda;
    const admin = provider.wallet;
    const sentinelUser = anchor.web3.Keypair.generate();
    const tokenMint = anchor.web3.Keypair.generate().publicKey;
    it('Is initialized!', async () => {
        [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], program.programId);
        await program.methods
            .initialize({
            minStake: new anchor.BN(1 * web3_js_1.LAMPORTS_PER_SOL),
            verdictWindow: 5, // 5 seconds for test
            quorum: 1,
            slashPercent: 50,
        })
            .accounts({
            protocol: protocolPda,
            admin: admin.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        const account = await program.account.protocol.fetch(protocolPda);
        chai_1.assert.ok(account.admin.equals(admin.publicKey));
    });
    it('Registers a sentinel', async () => {
        // Airdrop to sentinel
        const signature = await provider.connection.requestAirdrop(sentinelUser.publicKey, 5 * web3_js_1.LAMPORTS_PER_SOL);
        await provider.connection.confirmTransaction(signature);
        [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), sentinelUser.publicKey.toBuffer()], program.programId);
        await program.methods
            .registerSentinel()
            .accounts({
            protocol: protocolPda,
            sentinel: sentinelPda,
            stake: sentinelUser.publicKey, // Staking from own wallet
            authority: sentinelUser.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([sentinelUser])
            .rpc();
        const account = await program.account.sentinel.fetch(sentinelPda);
        chai_1.assert.ok(account.stake.gte(new anchor.BN(1 * web3_js_1.LAMPORTS_PER_SOL)));
        chai_1.assert.ok(account.isActive);
    });
    it('Submits a verdict', async () => {
        [tokenAnalysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMint.toBuffer()], program.programId);
        [votePda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vote'), tokenMint.toBuffer(), sentinelUser.publicKey.toBuffer()], program.programId);
        await program.methods
            .submitVerdict(tokenMint, { safe: {} }, 90)
            .accounts({
            protocol: protocolPda,
            sentinel: sentinelPda,
            tokenAnalysis: tokenAnalysisPda,
            sentinelVote: votePda,
            authority: sentinelUser.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .signers([sentinelUser])
            .rpc();
        const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
        chai_1.assert.ok(analysis.safeVotes.toNumber() === 1);
    });
    it('Finalizes consensus', async () => {
        // Wait for window to close (5s)
        await new Promise((resolve) => setTimeout(resolve, 6000));
        await program.methods
            .finalizeConsensus()
            .accounts({
            protocol: protocolPda,
            tokenAnalysis: tokenAnalysisPda,
        })
            .rpc();
        const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
        chai_1.assert.ok(analysis.isFinalized);
        chai_1.assert.deepEqual(analysis.finalVerdict, { safe: {} });
    });
    it('Reports a rug (Admin only)', async () => {
        const evidenceHash = Array(32).fill(0);
        await program.methods
            .reportRug(evidenceHash)
            .accounts({
            protocol: protocolPda,
            tokenAnalysis: tokenAnalysisPda,
            reporter: admin.publicKey, // Must be admin
        })
            .rpc();
        const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
        chai_1.assert.ok(analysis.isRugged);
    });
});
