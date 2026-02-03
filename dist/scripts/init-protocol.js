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
const web3_js_1 = require("@solana/web3.js");
const index_1 = require("../src/index");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const anchor_1 = require("@coral-xyz/anchor");
async function main() {
    // Load keypair
    const home = os.homedir();
    const keypairPath = path.join(home, '.config/solana/sentry-dev.json');
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    const admin = web3_js_1.Keypair.fromSecretKey(new Uint8Array(keypairData));
    // Connect to devnet
    const connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
    const sdk = new index_1.SentrySDK(connection);
    console.log('Initializing Protocol...');
    console.log('Admin:', admin.publicKey.toBase58());
    try {
        const ix = sdk.buildInitializeIx(admin.publicKey, {
            minStake: new anchor_1.BN(1000000000), // 1 SOL
            verdictWindow: 300, // 5 min
            quorum: 1, // 1 for dev/testing
            slashPercent: 50
        });
        const tx = new anchor_2.web3.Transaction().add(ix);
        const sig = await anchor_2.web3.sendAndConfirmTransaction(connection, tx, [admin]);
        console.log('Protocol initialized!');
        console.log('Signature:', sig);
    }
    catch (e) {
        console.error('Error initializing protocol:', e);
    }
}
// We need web3 globally or imported
const anchor_2 = require("@coral-xyz/anchor");
main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
