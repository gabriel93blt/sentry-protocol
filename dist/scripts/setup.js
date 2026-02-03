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
    const connection = new anchor.web3.Connection('https://api.devnet.solana.com');
    const homeDir = os.homedir();
    const keypairPath = `${homeDir}/.config/solana/sentry-dev.json`;
    const wallet = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))));
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
    anchor.setProvider(provider);
    const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8'));
    // The program ID from the IDL's metadata will be used by the constructor.
    const program = new anchor_1.Program(idl, provider);
    const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], program.programId);
    console.log('Checking protocol initialization...');
    console.log('Using program:', program.programId.toBase58());
    console.log('Admin wallet:', wallet.publicKey.toBase58());
    try {
        const account = await program.account.protocol.fetch(protocolPda);
        console.log('Protocol already initialized by:', account.admin.toBase58());
        console.log('Minimum Stake:', account.minStake.toString());
        console.log('Verdict Window:', account.verdictWindow);
    }
    catch (e) {
        console.log('Protocol not found. Initializing...');
        const tx = await program.methods
            .initialize({
            minStake: new anchor.BN(0.1 * web3_js_1.LAMPORTS_PER_SOL), // 0.1 SOL for devnet
            verdictWindow: 120, // 2 minutes
            quorum: 1,
            slashPercent: 50,
        })
            .accounts({
            protocol: protocolPda,
            admin: wallet.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        console.log('Protocol initialized! Tx:', tx);
        await provider.connection.confirmTransaction(tx);
        const account = await program.account.protocol.fetch(protocolPda);
        console.log('Initialization complete. Details:');
        console.log(' - Admin:', account.admin.toBase58());
        console.log(' - Min Stake:', account.minStake.toString());
    }
}
main().catch(console.error);
