import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { Sentry } from '../target/types/sentry';

// Config
const DASHBOARD_PATH = './dashboard/index.html';
const PROGRAM_ID = new PublicKey('EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm');
const UPDATE_INTERVAL_MS = 30000;

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  // Read Only Wallet
  const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  
  const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8')) as Sentry;
  const program = new Program<Sentry>(idl, provider);

  console.log('--- DASHBOARD UPDATER ---');

  while (true) {
    try {
      console.log('Fetching On-Chain Data...');
      
      // 1. Fetch Protocol State
      const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
      const protocol = await program.account.protocol.fetch(protocolPda);
      
      // 2. Fetch All Sentinels
      const sentinels = await program.account.sentinel.all();
      const totalStaked = sentinels.reduce((acc, s) => acc + s.account.stake.toNumber(), 0) / LAMPORTS_PER_SOL;
      const activeSentinels = sentinels.filter(s => s.account.isActive).length;

      // 3. Fetch Recent Analysis (Verdicts) and Votes
      const [analyses, allVotes] = await Promise.all([
          program.account.tokenAnalysis.all(),
          program.account.sentinelVote.all()
      ]);
      const totalVerdicts = analyses.length;
      
      // Sort by creation time desc
      analyses.sort((a, b) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber());
      const recent = analyses.slice(0, 10); // Top 10

      // 4. Update HTML
      let html = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

      // Update Metrics
      html = html.replace(/<div class="text-3xl font-bold text-white tracking-tight">[0-9.]* <span class="text-sm text-slate-500 font-normal">SOL<\/span><\/div>/, 
          `<div class="text-3xl font-bold text-white tracking-tight">${totalStaked.toFixed(2)} <span class="text-sm text-slate-500 font-normal">SOL</span></div>`);
      
      // Update Quorum / Total Agents
      html = html.replace(/<div class="text-3xl font-bold text-white tracking-tight">[0-9%]*<\/div>\s*<div class="text-\[10px\] text-slate-500 mt-2 mono uppercase tracking-wider">.* Required for Finality<\/div>/,
          `<div class="text-3xl font-bold text-white tracking-tight">${activeSentinels}</div><div class="text-[10px] text-slate-500 mt-2 mono uppercase tracking-wider">${activeSentinels} / 3 Required for Finality</div>`);

      // Update Live Verdicts Count
      html = html.replace(/<div class="text-3xl font-bold text-white tracking-tight">[0-9]*<\/div>\s*<div class="text-\[10px\] text-green-400 mt-2 mono uppercase tracking-wider">100% On-Chain Accuracy<\/div>/,
          `<div class="text-3xl font-bold text-white tracking-tight">${totalVerdicts}</div><div class="text-[10px] text-green-400 mt-2 mono uppercase tracking-wider">100% On-Chain Accuracy</div>`);

      // Update Table
      let tableRows = '';
      for (const item of recent) {
          const a = item.account;
          const date = new Date(a.createdAt.toNumber() * 1000);
          const time = date.toISOString().split('T')[1].substring(0, 8);
          const mintShort = item.account.tokenMint.toBase58().substring(0, 4) + '...' + item.account.tokenMint.toBase58().substring(40);
          
          // Get votes for this mint
          const votes = allVotes.filter(v => v.account.tokenMint.equals(item.account.tokenMint));
          const safeVotes = votes.filter(v => (v.account.verdict as any).safe).length;
          const dangerVotes = votes.filter(v => (v.account.verdict as any).danger).length;

          // Determine Verdict
          let verdict = 'PENDING';
          let badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
          
          if (a.isFinalized) {
              const v = a.finalVerdict as any;
              if (v.safe) { verdict = 'FINAL: SAFE'; badgeClass = 'bg-green-500/10 text-green-400 border-green-500/20'; }
              if (v.danger) { verdict = 'FINAL: DANGER'; badgeClass = 'bg-red-500/10 text-red-400 border-red-500/20'; }
          } else {
              if (safeVotes > dangerVotes) { verdict = 'LEANING SAFE'; badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20'; }
              else if (dangerVotes > 0) { verdict = 'LEANING DANGER'; badgeClass = 'bg-orange-500/10 text-orange-400 border-orange-500/20'; }
          }

          // Slashing check
          let statusLabel = '';
          if (a.isRugged) {
              statusLabel = '<br><span class="text-[9px] text-red-500 animate-pulse font-bold">⚠️ RUG DETECTED - SLASHING ACTIVE</span>';
          }

          const weight = (a.safeStake.add(a.dangerStake).toNumber() / LAMPORTS_PER_SOL).toFixed(2);

          // Build Agents Column
          let agentsHtml = '<div class="flex flex-col gap-1 items-center">';
          for (const vote of votes) {
              const sentinelKey = vote.account.sentinel.toBase58().substring(0, 4);
              const v = vote.account.verdict as any;
              const isSafe = v.safe;
              const colorClass = isSafe ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20';
              const icon = isSafe ? '🛡️' : '⚠️';
              const stake = (vote.account.stakeAtVote.toNumber() / LAMPORTS_PER_SOL).toFixed(2);
              
              agentsHtml += `
                <div class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border ${colorClass} w-max">
                    <span class="opacity-70">${icon}</span>
                    <span class="font-mono font-bold">${sentinelKey}</span>
                    <span class="opacity-50 text-[8px]">| ${stake} SOL</span>
                </div>`;
          }
          if (votes.length === 0) agentsHtml += '<span class="text-[9px] text-slate-600 italic">Scanning...</span>';
          agentsHtml += '</div>';

          tableRows += `
                <tr class="hover:bg-slate-800/30 transition-colors">
                    <td class="px-6 py-4 text-slate-500">${time}</td>
                    <td class="px-6 py-4 font-bold text-slate-200 font-mono">${mintShort}${statusLabel}</td>
                    <td class="px-6 py-4 text-center">${agentsHtml}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="px-2 py-1 rounded text-[10px] font-bold border ${badgeClass}">${verdict}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex justify-center gap-1">
                            <span class="w-4 h-4 rounded bg-green-500/20 text-green-500 text-[10px] flex items-center justify-center border border-green-500/20">${safeVotes}</span>
                            <span class="text-slate-600 text-[10px] self-center">vs</span>
                            <span class="w-4 h-4 rounded bg-red-500/20 text-red-500 text-[10px] flex items-center justify-center border border-red-500/20">${dangerVotes}</span>
                        </div>
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

    } catch (e) {
      console.error('[DASHBOARD] Update failed:', e);
    }
    
    await new Promise(r => setTimeout(r, UPDATE_INTERVAL_MS));
  }
}

main().catch(console.error);
