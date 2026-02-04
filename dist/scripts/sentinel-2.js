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
const sentinel_1 = require("../src/sentinel");
async function main() {
    const connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/sentinel-2.json`;
    const walletArr = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(walletArr));
    const wallet = new anchor.Wallet(keypair);
    const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8'));
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    const program = new anchor_1.Program(idl, provider);
    const engine = new sentinel_1.SentinelEngine(program, wallet, connection);
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
        }
        catch (e) {
            console.log('Airdrop failed (rate limit?), trying to proceed or wait.');
        }
    }
    // 2. Register
    if (!(await engine.isRegistered())) {
        console.log('Sentinel-2 not registered. Registering...');
        try {
            await engine.register(0.1);
            console.log('Sentinel-2 Registered.');
        }
        catch (e) {
            console.error("Registration failed:", e);
            // If registration fails (e.g. insufficient funds), we can't vote.
            return;
        }
    }
    else {
        console.log('Sentinel-2 is active.');
    }
    // 3. Monitor (Same Logic as Sentinel 1)
    engine.startMonitoring(async (mint) => {
        console.log(`[SENTINEL-2] New Token: ${mint.toBase58()}`);
        // Add some "personality" delay
        await new Promise(r => setTimeout(r, 2000));
        const analysis = await engine.analyzeToken(mint);
        // Sentinel-2 is slightly more paranoid (higher confidence on danger)
        if (analysis.verdict === sentinel_1.Verdict.Danger) {
            analysis.confidence = Math.min(100, analysis.confidence + 1);
        }
        console.log(`[SENTINEL-2] Verdict: ${analysis.verdict} (${analysis.confidence}%)`);
        try {
            const tx = await engine.submitVerdict(mint, analysis);
            console.log(`[SENTINEL-2] Voted! Tx: ${tx}`);
        }
        catch (e) {
            console.log(`[SENTINEL-2] Failed to vote: ${e}`);
        }
    });
    console.log('Sentinel-2 Listening... (Ctrl+C to stop)');
}
main().catch(console.error);
