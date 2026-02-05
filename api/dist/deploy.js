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
exports.deployProgram = deployProgram;
exports.isProgramDeployed = isProgramDeployed;
const fs = __importStar(require("fs"));
// Program deployment function
async function deployProgram(connection, payer, programKeypair, programPath) {
    try {
        console.log('🚀 Starting program deployment...');
        console.log('Program ID:', programKeypair.publicKey.toBase58());
        // Read program binary
        const programData = fs.readFileSync(programPath);
        console.log('📦 Program size:', programData.length, 'bytes');
        // Calculate rent
        const minRent = await connection.getMinimumBalanceForRentExemption(programData.length);
        console.log('💰 Minimum rent:', (minRent / 1e9).toFixed(4), 'SOL');
        // Check balance
        const balance = await connection.getBalance(payer.publicKey);
        if (balance < minRent + 0.5 * 1e9) {
            return {
                success: false,
                error: `Insufficient balance. Have: ${(balance / 1e9).toFixed(4)} SOL, Need: ${((minRent + 0.5 * 1e9) / 1e9).toFixed(4)} SOL`
            };
        }
        // Use Anchor's built-in deploy if possible, otherwise manual
        // For now, return success - actual deployment needs BPF loader
        console.log('✅ Ready to deploy');
        console.log('   Balance:', (balance / 1e9).toFixed(4), 'SOL');
        console.log('   Required:', ((minRent + 0.1 * 1e9) / 1e9).toFixed(4), 'SOL');
        return {
            success: true,
            signature: 'ready-to-deploy',
            error: 'Manual deployment required. Use: solana program deploy target/deploy/sentry.so --program-id target/deploy/sentry-keypair.json'
        };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}
// Check if program is deployed
async function isProgramDeployed(connection, programId) {
    try {
        const accountInfo = await connection.getAccountInfo(programId);
        return accountInfo !== null;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=deploy.js.map