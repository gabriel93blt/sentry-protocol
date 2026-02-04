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
// Config
const DASHBOARD_PATH = './dashboard/index.html';
const PROGRAM_ID = new web3_js_1.PublicKey('EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm');
const UPDATE_INTERVAL_MS = 30000;
async function main() {
    const connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
    // Read Only Wallet
    const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8'));
    const program = new anchor_1.Program(idl, provider);
    console.log('--- DASHBOARD UPDATER ---');
    while (true) {
        try {
            console.log('Fetching On-Chain Data...');
            // 1. Fetch Protocol State
            const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], PROGRAM_ID);
            const protocol = await program.account.protocol.fetch(protocolPda);
            // 2. Fetch All Sentinels
            const sentinels = await program.account.sentinel.all();
            const totalStaked = sentinels.reduce((acc, s) => acc + s.account.stake.toNumber(), 0) / web3_js_1.LAMPORTS_PER_SOL;
            const activeSentinels = sentinels.filter(s => s.account.isActive).length;
            // 3. Fetch Recent Analysis (Verdicts)
            const analyses = await program.account.tokenAnalysis.all();
            const totalVerdicts = analyses.length;
            // Sort by creation time desc
            analyses.sort((a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber());
            const recent = analyses.slice(0, 5); // Top 5
            // 4. Update HTML
            let html = fs.readFileSync(DASHBOARD_PATH, 'utf-8');
            // Update Metrics
            html = html.replace(/<div class="text-3xl font-bold text-white tracking-tight">[0-9.]* <span class="text-sm text-slate-500 font-normal">SOL<\/span><\/div>/, `<div class="text-3xl font-bold text-white tracking-tight">${totalStaked.toFixed(2)} <span class="text-sm text-slate-500 font-normal">SOL</span></div>`);
            html = html.replace(/<div class="text-3xl font-bold text-white tracking-tight">[0-9]*<\/div>/g, (match, offset, string) => {
                // Heuristic based on context is hard with regex replace global.
                // Let's rely on specific unique IDs or just replace them sequentially if we knew the order.
                // Better: Use placeholders in the template next time. For now, specific text search.
                return match;
            });
            // Brute force replacements for specific unique strings I wrote in the HTML
            html = html.replace(/>[0-9]*<\/div>\s*<div class="text-\[10px\] text-slate-500 mt-1">Targeting Quorum<\/div>/, `>${activeSentinels}</div><div class="text-[10px] text-slate-500 mt-1">Targeting Quorum</div>`);
            html = html.replace(/>[0-9]*<\/div>\s*<div class="text-\[10px\] text-green-400 mt-1 mono uppercase tracking-wider">100% On-Chain Accuracy<\/div>/, `>${totalVerdicts}</div><div class="text-[10px] text-green-400 mt-1 mono uppercase tracking-wider">100% On-Chain Accuracy</div>`);
            // Update Table
            let tableRows = '';
            for (const item of recent) {
                const a = item.account;
                const date = new Date(a.createdAt.toNumber() * 1000);
                const time = date.toISOString().split('T')[1].substring(0, 8);
                const mintShort = item.account.tokenMint.toBase58().substring(0, 4) + '...' + item.account.tokenMint.toBase58().substring(40);
                // Determine Verdict
                let verdict = 'PENDING';
                let badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                if (a.isFinalized) {
                    const v = a.finalVerdict;
                    if (v.safe) {
                        verdict = 'SAFE';
                        badgeClass = 'bg-green-500/10 text-green-400 border-green-500/20';
                    }
                    if (v.danger) {
                        verdict = 'DANGER';
                        badgeClass = 'bg-red-500/10 text-red-400 border-red-500/20';
                    }
                }
                else {
                    // Check preliminary votes
                    if (a.safeVotes.toNumber() > a.dangerVotes.toNumber()) {
                        verdict = 'LEANING SAFE';
                        badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                    }
                    else if (a.dangerVotes.toNumber() > 0) {
                        verdict = 'LEANING DANGER';
                        badgeClass = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                    }
                }
                const weight = (a.safeStake.add(a.dangerStake).toNumber() / web3_js_1.LAMPORTS_PER_SOL).toFixed(2);
                tableRows += `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-6 py-4 text-slate-500">${time}</td>
                    <td class="px-6 py-4 font-bold text-slate-200 font-mono">${mintShort}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="px-2 py-1 rounded text-[10px] font-bold border ${badgeClass}">${verdict}</span>
                    </td>
                    <td class="px-6 py-4 text-right text-slate-400"><span class="text-blue-400">${weight} SOL</span></td>
                </tr>`;
            }
            // Replace tbody content
            const startTag = '<tbody class="divide-y divide-slate-800/50" id="verdict-body">';
            const endTag = '</tbody>';
            const startIndex = html.indexOf(startTag) + startTag.length;
            const endIndex = html.indexOf(endTag, startIndex);
            const newHtml = html.substring(0, startIndex) + tableRows + html.substring(endIndex);
            fs.writeFileSync(DASHBOARD_PATH, newHtml);
            console.log('[DASHBOARD] Local HTML updated.');
            // 5. Git Push (Optional - user asked for local access but git push updates the public link)
            // We will skip auto-push to avoid rate limits and spamming commits. 
            // The user can see it on the Tailscale link: http://100.83.127.34:8080/
        }
        catch (e) {
            console.error('[DASHBOARD] Update failed:', e);
        }
        await new Promise(r => setTimeout(r, UPDATE_INTERVAL_MS));
    }
}
main().catch(console.error);
