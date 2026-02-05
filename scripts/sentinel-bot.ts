import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import axios from 'axios';

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey('2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY');

// Configuration du bot
const CONFIG = {
  minConfidence: 70,        // Confiance minimum pour soumettre (0-100)
  checkInterval: 30000,     // 30 secondes entre les checks
  pumpFunApi: 'https://frontend-api.pump.fun/coins/for-you',
  jupiterApi: 'https://token.jup.ag/all',
  riskKeywords: ['mint', 'owner', 'freeze', 'authority'],
  safeIndicators: ['verified', 'audit', 'liquidity_locked']
};

// Load wallet
function loadWallet(): Keypair {
  const walletPath = './sentinel-wallet.json';
  if (fs.existsSync(walletPath)) {
    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  }
  throw new Error('Sentinel wallet not found. Create one first with: solana-keygen new -o sentinel-wallet.json');
}

const sentinelWallet = loadWallet();
console.log(`🤖 Sentinel Bot Starting...`);
console.log(`   Wallet: ${sentinelWallet.publicKey.toBase58()}`);
console.log(`   Network: ${NETWORK}`);

const connection = new Connection(RPC_URL, 'confirmed');
const wallet = new anchor.Wallet(sentinelWallet);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
const idl = JSON.parse(fs.readFileSync('../target/idl/sentry.json', 'utf8'));
const program = new anchor.Program(idl, provider) as any;

// État du bot
interface TokenAnalysis {
  mint: string;
  name: string;
  symbol: string;
  marketCap?: number;
  liquidity?: number;
  holders?: number;
  createdAt: number;
  riskScore: number;
  verdict?: 'safe' | 'danger';
  confidence?: number;
  submitted: boolean;
}

const analyzedTokens = new Map<string, TokenAnalysis>();
const submittedVerdicts = new Set<string>();

// ============ ANALYSIS FUNCTIONS ============

async function fetchNewTokens(): Promise<TokenAnalysis[]> {
  const tokens: TokenAnalysis[] = [];
  
  try {
    // Fetch from Pump.fun API
    const pumpResponse = await axios.get(CONFIG.pumpFunApi, {
      timeout: 10000,
      headers: { 'Accept': 'application/json' }
    });
    
    if (pumpResponse.data && Array.isArray(pumpResponse.data)) {
      for (const coin of pumpResponse.data.slice(0, 20)) {
        if (!coin.mint) continue;
        
        tokens.push({
          mint: coin.mint,
          name: coin.name || 'Unknown',
          symbol: coin.symbol || '???',
          marketCap: coin.market_cap || coin.usd_market_cap || 0,
          createdAt: coin.created_timestamp || Date.now(),
          riskScore: 0,
          submitted: false
        });
      }
    }
  } catch (e) {
    console.log('⚠️ Pump.fun API error:', (e as Error).message);
  }
  
  try {
    // Also check Jupiter for trending tokens
    const jupiterResponse = await axios.get(CONFIG.jupiterApi, { timeout: 10000 });
    if (jupiterResponse.data) {
      const tokenList = Object.values(jupiterResponse.data).slice(0, 10);
      for (const token of tokenList as any[]) {
        if (token.address && !tokens.find(t => t.mint === token.address)) {
          tokens.push({
            mint: token.address,
            name: token.name || 'Unknown',
            symbol: token.symbol || '???',
            createdAt: Date.now(),
            riskScore: 0,
            submitted: false
          });
        }
      }
    }
  } catch (e) {
    console.log('⚠️ Jupiter API error:', (e as Error).message);
  }
  
  return tokens;
}

function analyzeTokenRisk(token: TokenAnalysis): { verdict: 'safe' | 'danger'; confidence: number; reasons: string[] } {
  const reasons: string[] = [];
  let riskScore = 0;
  let safetyScore = 0;
  
  // 1. Market cap analysis
  if (token.marketCap) {
    if (token.marketCap < 10000) {
      riskScore += 30;
      reasons.push('Very low market cap (<$10k)');
    } else if (token.marketCap > 1000000) {
      safetyScore += 20;
      reasons.push('Higher market cap (>$1M)');
    }
  } else {
    riskScore += 10;
    reasons.push('Unknown market cap');
  }
  
  // 2. Name/symbol analysis
  const nameLower = (token.name + ' ' + token.symbol).toLowerCase();
  
  // Suspicious keywords
  const suspiciousTerms = ['scam', 'rug', 'pump', 'dump', 'elon', 'musk', 'trump', 'moon', '1000x'];
  for (const term of suspiciousTerms) {
    if (nameLower.includes(term)) {
      riskScore += 15;
      reasons.push(`Suspicious term: "${term}"`);
    }
  }
  
  // 3. Age analysis
  const age = Date.now() - token.createdAt;
  const ageHours = age / (1000 * 60 * 60);
  
  if (ageHours < 1) {
    riskScore += 25;
    reasons.push('Token created less than 1 hour ago');
  } else if (ageHours > 24) {
    safetyScore += 15;
    reasons.push('Token has survived 24h+');
  }
  
  // 4. Metadata checks (simulated - in production, check on-chain)
  if (nameLower.includes('verified') || nameLower.includes('v1')) {
    safetyScore += 10;
    reasons.push('Potentially verified token');
  }
  
  // Calculate final verdict
  const totalScore = safetyScore - riskScore;
  
  let verdict: 'safe' | 'danger';
  let confidence: number;
  
  if (totalScore > 20) {
    verdict = 'safe';
    confidence = Math.min(50 + totalScore, 95);
  } else if (totalScore < -20) {
    verdict = 'danger';
    confidence = Math.min(50 + Math.abs(totalScore), 95);
  } else {
    // Borderline - lean danger for safety
    verdict = totalScore < 0 ? 'danger' : 'safe';
    confidence = 50 + Math.abs(totalScore);
  }
  
  return { verdict, confidence, reasons };
}

async function checkSentinelStatus(): Promise<{ registered: boolean; stake: number; isActive: boolean }> {
  try {
    const [sentinelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sentinel'), sentinelWallet.publicKey.toBuffer()],
      PROGRAM_ID
    );
    
    const sentinel = await program.account.sentinel.fetch(sentinelPda);
    return {
      registered: true,
      stake: sentinel.stake.toNumber() / 1e9,
      isActive: sentinel.isActive
    };
  } catch {
    return { registered: false, stake: 0, isActive: false };
  }
}

async function submitVerdict(tokenMint: string, verdict: 'safe' | 'danger', confidence: number): Promise<string | null> {
  try {
    const authority = sentinelWallet.publicKey;
    const tokenMintKey = new PublicKey(tokenMint);
    
    const [protocolPda] = PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
    const [sentinelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sentinel'), authority.toBuffer()],
      PROGRAM_ID
    );
    const [tokenAnalysisPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('analysis'), tokenMintKey.toBuffer()],
      PROGRAM_ID
    );
    const [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), tokenMintKey.toBuffer(), authority.toBuffer()],
      PROGRAM_ID
    );
    
    const verdictVariant = verdict === 'safe' ? { safe: {} } : { danger: {} };
    
    const tx = await program.methods
      .submitVerdict(tokenMintKey, verdictVariant, confidence)
      .accounts({
        protocol: protocolPda,
        sentinel: sentinelPda,
        tokenAnalysis: tokenAnalysisPda,
        sentinelVote: votePda,
        authority: authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    return tx;
  } catch (e: any) {
    console.error(`❌ Failed to submit verdict for ${tokenMint}:`, e.message);
    return null;
  }
}

// ============ MAIN BOT LOOP ============

async function botLoop() {
  console.log(`\n🔍 Scanning for new tokens...`);
  
  // Check sentinel status
  const status = await checkSentinelStatus();
  if (!status.registered) {
    console.log('❌ Sentinel not registered! Register first with stake.');
    console.log('   Run: anchor run register-sentinel -- --stake 0.1');
    return;
  }
  
  if (!status.isActive) {
    console.log('❌ Sentinel is inactive (stake too low or slashed)');
    return;
  }
  
  console.log(`✅ Sentinel active | Stake: ${status.stake.toFixed(2)} SOL`);
  
  // Fetch and analyze tokens
  const tokens = await fetchNewTokens();
  console.log(`📊 Found ${tokens.length} tokens to analyze`);
  
  let submitted = 0;
  let skipped = 0;
  
  for (const token of tokens) {
    // Skip if already submitted
    if (submittedVerdicts.has(token.mint)) {
      skipped++;
      continue;
    }
    
    // Skip if already analyzed recently
    if (analyzedTokens.has(token.mint)) {
      const existing = analyzedTokens.get(token.mint)!;
      if (existing.submitted) {
        skipped++;
        continue;
      }
    }
    
    // Analyze
    const analysis = analyzeTokenRisk(token);
    token.riskScore = analysis.verdict === 'danger' ? -analysis.confidence : analysis.confidence;
    token.verdict = analysis.verdict;
    token.confidence = analysis.confidence;
    
    console.log(`\n📝 ${token.symbol} (${token.name})`);
    console.log(`   Verdict: ${analysis.verdict.toUpperCase()} (${analysis.confidence}%)`);
    console.log(`   Reasons: ${analysis.reasons.join(', ')}`);
    
    // Submit if confidence is high enough
    if (analysis.confidence >= CONFIG.minConfidence) {
      const tx = await submitVerdict(token.mint, analysis.verdict, analysis.confidence);
      if (tx) {
        console.log(`   ✅ Submitted! TX: ${tx.slice(0, 20)}...`);
        token.submitted = true;
        submittedVerdicts.add(token.mint);
        submitted++;
      }
    } else {
      console.log(`   ⏭️ Skipped (confidence too low)`);
    }
    
    analyzedTokens.set(token.mint, token);
    
    // Small delay between submissions
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`\n📈 Loop complete: ${submitted} submitted, ${skipped} skipped`);
}

// ============ STARTUP ============

async function main() {
  console.log('='.repeat(50));
  console.log('🛡️ SENTRY SENTINEL BOT v2.0');
  console.log('='.repeat(50));
  
  // Check balance
  const balance = await connection.getBalance(sentinelWallet.publicKey);
  console.log(`💰 Wallet balance: ${(balance / 1e9).toFixed(4)} SOL`);
  
  // Check sentinel status
  const status = await checkSentinelStatus();
  if (status.registered) {
    console.log(`🔒 Sentinel registered | Stake: ${status.stake.toFixed(2)} SOL | Active: ${status.isActive}`);
  } else {
    console.log('⚠️ Sentinel NOT registered');
    console.log('   To register: anchor run register-sentinel -- --stake 0.1');
  }
  
  console.log('='.repeat(50));
  
  // Start loop
  await botLoop();
  
  // Schedule next loop
  setInterval(botLoop, CONFIG.checkInterval);
  
  console.log(`\n🤖 Bot running (checking every ${CONFIG.checkInterval / 1000}s)`);
  console.log('Press Ctrl+C to stop\n');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Sentinel Bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Sentinel Bot...');
  process.exit(0);
});

main().catch(console.error);
