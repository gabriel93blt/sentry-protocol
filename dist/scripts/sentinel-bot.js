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
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
async function main() {
    const connection = new anchor.web3.Connection('https://api.devnet.solana.com', 'confirmed');
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/sentry-dev.json`;
    const wallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))));
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
    anchor.setProvider(provider);
    const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8'));
    // Use Program<Sentry>(idl, provider) to avoid type/argument ambiguity
    const program = new anchor_1.Program(idl, provider);
    const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], program.programId);
    const [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), wallet.publicKey.toBuffer()], program.programId);
    console.log('--- SENTRY SENTINEL BOT ---');
    console.log('Sentinel Wallet:', wallet.publicKey.toBase58());
    // 1. Check/Register Sentinel
    try {
        const sentinelAccount = await program.account.sentinel.fetch(sentinelPda);
        console.log('Status: Registered');
        console.log('Stake:', sentinelAccount.stake.toNumber() / web3_js_1.LAMPORTS_PER_SOL, 'SOL');
        console.log('Reputation:', sentinelAccount.reputation);
    }
    catch (e) {
        console.log('Status: Not Registered. Registering with 0.1 SOL stake...');
        try {
            const tx = await program.methods
                .registerSentinel()
                .accounts({
                protocol: protocolPda,
                sentinel: sentinelPda,
                stake: wallet.publicKey,
                authority: wallet.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .rpc();
            console.log('Registration successful! Tx:', tx);
            await connection.confirmTransaction(tx);
        }
        catch (regError) {
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
        const [analysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), token.mint.toBuffer()], program.programId);
        const [votePda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vote'), token.mint.toBuffer(), wallet.publicKey.toBuffer()], program.programId);
        try {
            const tx = await program.methods
                .submitVerdict(token.mint, verdict, confidence)
                .accounts({
                protocol: protocolPda,
                sentinel: sentinelPda,
                tokenAnalysis: analysisPda,
                sentinelVote: votePda,
                authority: wallet.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .rpc();
            console.log(`Verdict Submitted! Tx: ${tx}`);
        }
        catch (err) {
            console.error('Failed to submit verdict:', err);
        }
    }
    console.log('\nSentinel operations completed for this cycle.');
}
main().catch(console.error);
