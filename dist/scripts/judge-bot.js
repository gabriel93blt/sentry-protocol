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
    const connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
    const homeDir = os.homedir();
    // Judge uses the Admin Wallet (required for reportRug in current implementation)
    const keypairPath = `${homeDir}/.config/solana/sentry-dev.json`;
    const wallet = new anchor.Wallet(web3_js_1.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))));
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(provider);
    const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8'));
    const program = new anchor_1.Program(idl, provider);
    console.log('--- ⚖️ SENTRY JUDGE BOT (Ground Truth Oracle) ---');
    console.log('Judge Wallet:', wallet.publicKey.toBase58());
    while (true) {
        try {
            // 1. Fetch all Token Analysis accounts
            // Note: In prod, we would filter using getProgramAccounts with memcmp
            const allAnalysis = await program.account.tokenAnalysis.all();
            const now = Math.floor(Date.now() / 1000);
            // Get Protocol Config to know the window (fetching PDAs...)
            const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], program.programId);
            const protocol = await program.account.protocol.fetch(protocolPda);
            const windowSeconds = protocol.verdictWindow;
            console.log(`[JUDGE] Scanning ${allAnalysis.length} analyses... (Time: ${now})`);
            for (const record of allAnalysis) {
                const analysis = record.account;
                const pda = record.publicKey;
                const mint = analysis.tokenMint;
                // CHECK 1: Needs Finalization?
                // If window passed AND not finalized
                if (!analysis.isFinalized && now > (analysis.createdAt.toNumber() + windowSeconds)) {
                    console.log(`[JUDGE] ⏳ Time's up for ${mint.toBase58()}. Finalizing Consensus...`);
                    try {
                        const tx = await program.methods
                            .finalizeConsensus()
                            .accounts({
                            protocol: protocolPda,
                            tokenAnalysis: pda,
                        })
                            .rpc();
                        console.log(`[JUDGE] 🔨 Consensus Finalized! Tx: ${tx}`);
                        // Refresh account state
                        const updatedAnalysis = await program.account.tokenAnalysis.fetch(pda);
                        console.log(`[JUDGE] 🏁 Verdict is: ${JSON.stringify(updatedAnalysis.finalVerdict)}`);
                    }
                    catch (e) {
                        console.error(`[JUDGE] Failed to finalize ${mint.toBase58()}:`, e);
                    }
                }
                // CHECK 2: Needs Rug Report (Slashing)?
                // If Finalized = SAFE, but it was actually a RUG (Ground Truth)
                // For Hackathon Demo: We simulate "Ground Truth" by checking if the mint address starts with "Rug" (simulated) 
                // OR we rely on our simulation script's naming convention if stored, but here we'll assume 
                // the Judge has an external "God View". 
                // SIMULATION: If safe_votes > danger_votes (Verdict=Safe), but we want to demo slashing,
                // we can trigger it manually or logic-based.
                // Let's implement a "God Mode" check:
                // If the token *actually* has 'freezeAuthority' enabled, it's a rug risk we missed.
                if (analysis.isFinalized && !analysis.isRugged) {
                    // Fetch actual on-chain info for the mint
                    const mintInfo = await connection.getParsedAccountInfo(mint);
                    if (mintInfo.value && 'parsed' in mintInfo.value.data) {
                        const info = mintInfo.value.data.parsed.info;
                        const hasFreezeAuth = info.freezeAuthority !== null;
                        const hasMintAuth = info.mintAuthority !== null;
                        // CRITERIA FOR TRUTH: If Freeze Auth exists, it IS a danger/rug vector.
                        const isActuallyDangerous = hasFreezeAuth;
                        // If Consensus said SAFE but it is DANGEROUS -> SLASH
                        // JSON.stringify(analysis.finalVerdict) -> {"safe":{}}
                        const verdictIsSafe = Object.keys(analysis.finalVerdict)[0] === 'safe';
                        if (verdictIsSafe && isActuallyDangerous) {
                            console.log(`[JUDGE] 🚨 ALARM! Consensus was SAFE, but Token has Freeze Authority! TRIGGERING SLASHING.`);
                            // Evidence is usually a hash of the proof. We use a dummy hash for devnet.
                            const evidenceHash = new Array(32).fill(1);
                            try {
                                const tx = await program.methods
                                    .reportRug(evidenceHash)
                                    .accounts({
                                    protocol: protocolPda,
                                    tokenAnalysis: pda,
                                    reporter: wallet.publicKey
                                })
                                    .rpc();
                                console.log(`[JUDGE] 🔪 SLASHING EXECUTED! Justice served. Tx: ${tx}`);
                            }
                            catch (e) {
                                console.error(`[JUDGE] Failed to slash:`, e);
                            }
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error('[JUDGE] Cycle Error:', err);
        }
        // Wait 10s
        await new Promise(r => setTimeout(r, 10000));
    }
}
main().catch(console.error);
