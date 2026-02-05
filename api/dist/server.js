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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
const db_1 = require("./db");
dotenv.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
const PORT = process.env.PORT || 3001;
const NETWORK = process.env.NETWORK || 'devnet';
const RPC_URL = NETWORK === 'mainnet'
    ? process.env.MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com';
const MOLTBOOK_API = process.env.MOLTBOOK_API || 'https://api.moltbook.com';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const PROGRAM_ID = new web3_js_1.PublicKey('EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm');
// Load admin wallet from file or env
function loadAdminWallet() {
    const walletPath = process.env.ADMIN_WALLET_PATH || './wallet.json';
    if (fs.existsSync(walletPath)) {
        const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        return web3_js_1.Keypair.fromSecretKey(new Uint8Array(secretKey));
    }
    if (process.env.ADMIN_PRIVATE_KEY) {
        const secretKey = JSON.parse(process.env.ADMIN_PRIVATE_KEY);
        return web3_js_1.Keypair.fromSecretKey(new Uint8Array(secretKey));
    }
    throw new Error('Admin wallet not found. Set ADMIN_WALLET_PATH or ADMIN_PRIVATE_KEY');
}
const adminWallet = loadAdminWallet();
console.log(`🔐 Admin wallet loaded: ${adminWallet.publicKey.toBase58()}`);
const connection = new web3_js_1.Connection(RPC_URL, 'confirmed');
const wallet = new anchor.Wallet(adminWallet);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
const idl = JSON.parse(fs.readFileSync('../target/idl/sentry.json', 'utf8'));
const program = new anchor.Program(idl, provider);
// In-memory cache for performance
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds
function getCache(key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    return null;
}
function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}
// Middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
// Rate limiting middleware
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests per minute
function rateLimit(req, res, next) {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    const clientData = requestCounts.get(ip);
    if (!clientData || clientData.resetTime < windowStart) {
        requestCounts.set(ip, { count: 1, resetTime: now });
        return next();
    }
    if (clientData.count >= RATE_LIMIT) {
        return res.status(429).json({ error: 'Rate limit exceeded. Max 100 requests per minute.' });
    }
    clientData.count++;
    next();
}
app.use(rateLimit);
// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});
// ============ HEALTH & INFO ============
app.get('/health', (req, res) => {
    res.json({
        status: 'operational',
        version: '2.0.0',
        network: NETWORK,
        program: PROGRAM_ID.toBase58(),
        admin: adminWallet.publicKey.toBase58()
    });
});
app.get('/api/v1/protocol/stats', asyncHandler(async (req, res) => {
    const cached = getCache('protocol_stats');
    if (cached)
        return res.json(cached);
    try {
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
        const protocol = await program.account.protocol.fetch(protocolPda);
        const result = {
            success: true,
            stats: {
                tvl: 0, // TODO: fetch vault balance
                agentCount: protocol.totalAgents.toNumber(),
                rugsDetected: 0, // TODO: fetch from all analyses
                accuracy: null,
                quorumCurrent: protocol.totalAgents.toNumber(),
                quorumRequired: protocol.quorum,
                minStake: protocol.minStake.toNumber() / 1e9,
                slashPercent: protocol.slashPercent,
                verdictWindow: protocol.verdictWindow
            }
        };
        setCache('protocol_stats', result);
        res.json(result);
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}));
// ============ AGENT REGISTRATION ============
app.post('/api/v1/agents/register', asyncHandler(async (req, res) => {
    const { wallet: agentWallet, stakeAmount, moltbookApiKey } = req.body;
    if (!agentWallet || !stakeAmount) {
        return res.status(400).json({ success: false, error: 'Missing required fields: wallet, stakeAmount' });
    }
    try {
        // Verify Moltbook if API key provided
        let moltbookVerified = false;
        let moltbookData = null;
        if (moltbookApiKey && MOLTBOOK_API_KEY) {
            try {
                const moltResponse = await axios_1.default.get(`${MOLTBOOK_API}/api/v1/agents/me`, {
                    headers: { 'Authorization': `Bearer ${moltbookApiKey}` },
                    timeout: 5000
                });
                if (moltResponse.data?.claimed) {
                    moltbookVerified = true;
                    moltbookData = moltResponse.data;
                }
            }
            catch (e) {
                console.log('Moltbook verification failed:', e);
            }
        }
        const authority = new web3_js_1.PublicKey(agentWallet);
        // Get PDAs
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
        const [vaultPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID);
        const [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), authority.toBuffer()], PROGRAM_ID);
        // Check if already registered
        try {
            await program.account.sentinel.fetch(sentinelPda);
            return res.status(409).json({ success: false, error: 'Agent already registered' });
        }
        catch {
            // Not registered, continue
        }
        // Register on-chain
        const stakeLamports = Math.floor(stakeAmount * 1e9);
        const tx = await program.methods
            .registerSentinel(new anchor.BN(stakeLamports))
            .accounts({
            protocol: protocolPda,
            vault: vaultPda,
            sentinel: sentinelPda,
            authority: authority,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
            .rpc();
        // Save to Supabase database
        const agentRecord = {
            id: sentinelPda.toBase58(),
            sentry_id: sentinelPda.toBase58(),
            moltbook_said: moltbookData?.name || null,
            wallet_address: agentWallet,
            stake_amount: stakeAmount,
            reputation: 100,
            correct_verdicts: 0,
            total_verdicts: 0,
            is_active: true,
            registered_at: new Date().toISOString()
        };
        const dbResult = await (0, db_1.upsertAgent)(agentRecord);
        if (!dbResult.success) {
            console.warn('⚠️ Agent registered on-chain but DB save failed:', dbResult.error);
        }
        else {
            console.log('✅ Agent saved to database:', sentinelPda.toBase58());
        }
        res.json({
            success: true,
            agentId: sentinelPda.toBase58(),
            wallet: agentWallet,
            stakeAmount,
            moltbookVerified,
            transaction: tx,
            status: 'active'
        });
    }
    catch (e) {
        console.error('Registration error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
}));
app.get('/api/v1/agents/:id', asyncHandler(async (req, res) => {
    try {
        const sentinelPda = new web3_js_1.PublicKey(req.params.id);
        const sentinel = await program.account.sentinel.fetch(sentinelPda);
        res.json({
            success: true,
            agent: {
                id: sentinelPda.toBase58(),
                authority: sentinel.authority.toBase58(),
                stake: sentinel.stake.toNumber() / 1e9,
                reputation: sentinel.reputation,
                correctVerdicts: sentinel.correctVerdicts.toNumber(),
                totalVerdicts: sentinel.totalVerdicts.toNumber(),
                isActive: sentinel.isActive,
                registeredAt: sentinel.registeredAt.toNumber() * 1000
            }
        });
    }
    catch (e) {
        res.status(404).json({ success: false, error: 'Agent not found' });
    }
}));
app.get('/api/v1/agents', asyncHandler(async (req, res) => {
    try {
        // Fetch from Supabase database
        const dbResult = await (0, db_1.getAllAgents)();
        if (dbResult.success && dbResult.agents && dbResult.agents.length > 0) {
            res.json({
                success: true,
                agents: dbResult.agents.map((a) => ({
                    id: a.sentry_id,
                    authority: a.wallet_address,
                    stake: a.stake_amount,
                    reputation: a.reputation,
                    correctVerdicts: a.correct_verdicts,
                    totalVerdicts: a.total_verdicts,
                    isActive: a.is_active,
                    moltbookSaid: a.moltbook_said,
                    accuracy: a.total_verdicts > 0
                        ? Math.round((a.correct_verdicts / a.total_verdicts) * 100)
                        : 0
                }))
            });
        }
        else {
            // Fallback to on-chain data if DB is empty
            const sentinels = await program.account.sentinel.all();
            res.json({
                success: true,
                agents: sentinels.map((s) => ({
                    id: s.publicKey.toBase58(),
                    authority: s.account.authority.toBase58(),
                    stake: s.account.stake.toNumber() / 1e9,
                    reputation: s.account.reputation,
                    correctVerdicts: s.account.correctVerdicts.toNumber(),
                    totalVerdicts: s.account.totalVerdicts.toNumber(),
                    isActive: s.account.isActive,
                    accuracy: s.account.totalVerdicts.toNumber() > 0
                        ? Math.round((s.account.correctVerdicts.toNumber() / s.account.totalVerdicts.toNumber()) * 100)
                        : 0
                }))
            });
        }
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}));
// ============ VERDICTS ============
app.post('/api/v1/verdicts', asyncHandler(async (req, res) => {
    const { tokenMint, verdict, confidence, wallet: agentWallet } = req.body;
    if (!tokenMint || !verdict || confidence === undefined || !agentWallet) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: tokenMint, verdict, confidence, wallet'
        });
    }
    try {
        const authority = new web3_js_1.PublicKey(agentWallet);
        const tokenMintKey = new web3_js_1.PublicKey(tokenMint);
        // Get PDAs
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
        const [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), authority.toBuffer()], PROGRAM_ID);
        const [tokenAnalysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMintKey.toBuffer()], PROGRAM_ID);
        const [votePda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vote'), tokenMintKey.toBuffer(), authority.toBuffer()], PROGRAM_ID);
        // Convert verdict
        const verdictVariant = verdict.toLowerCase() === 'safe' ? { safe: {} } : { danger: {} };
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
        res.json({
            success: true,
            verdictId: votePda.toBase58(),
            tokenMint,
            verdict,
            confidence,
            transaction: tx
        });
    }
    catch (e) {
        console.error('Verdict submission error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
}));
app.get('/api/v1/verdicts', asyncHandler(async (req, res) => {
    try {
        const analyses = await program.account.tokenAnalysis.all();
        const votes = await program.account.sentinelVote.all();
        const verdicts = analyses.map((a) => {
            const tokenVotes = votes.filter((v) => v.account.tokenMint.toBase58() === a.publicKey.toBase58());
            return {
                id: a.publicKey.toBase58(),
                tokenMint: a.account.tokenMint.toBase58(),
                status: a.account.isFinalized ? 'finalized' : 'pending',
                finalVerdict: Object.keys(a.account.finalVerdict || {})[0] || null,
                safeVotes: a.account.safeVotes.toNumber(),
                dangerVotes: a.account.dangerVotes.toNumber(),
                safeStake: a.account.safeStake.toNumber() / 1e9,
                dangerStake: a.account.dangerStake.toNumber() / 1e9,
                isRugged: a.account.isRugged,
                createdAt: a.account.createdAt.toNumber() * 1000,
                finalizedAt: a.account.finalizedAt.toNumber() > 0
                    ? a.account.finalizedAt.toNumber() * 1000
                    : null
            };
        });
        res.json({ success: true, verdicts });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}));
app.get('/api/v1/verdicts/:mint', asyncHandler(async (req, res) => {
    try {
        const tokenMint = new web3_js_1.PublicKey(req.params.mint);
        const [tokenAnalysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMint.toBuffer()], PROGRAM_ID);
        const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
        res.json({
            success: true,
            verdict: {
                tokenMint: req.params.mint,
                status: analysis.isFinalized ? 'finalized' : 'pending',
                finalVerdict: Object.keys(analysis.finalVerdict || {})[0] || null,
                safeVotes: analysis.safeVotes.toNumber(),
                dangerVotes: analysis.dangerVotes.toNumber(),
                safeStake: analysis.safeStake.toNumber() / 1e9,
                dangerStake: analysis.dangerStake.toNumber() / 1e9,
                consensusConfidence: analysis.consensusConfidence,
                isRugged: analysis.isRugged,
                slashPool: analysis.slashPool.toNumber() / 1e9
            }
        });
    }
    catch (e) {
        res.status(404).json({ success: false, error: 'Verdict not found' });
    }
}));
// ============ FINALIZE & CLAIMS ============
app.post('/api/v1/verdicts/:mint/finalize', asyncHandler(async (req, res) => {
    try {
        const tokenMint = new web3_js_1.PublicKey(req.params.mint);
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
        const [tokenAnalysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMint.toBuffer()], PROGRAM_ID);
        const tx = await program.methods
            .finalizeConsensus()
            .accounts({
            protocol: protocolPda,
            tokenAnalysis: tokenAnalysisPda,
        })
            .rpc();
        res.json({
            success: true,
            message: 'Consensus finalized',
            transaction: tx
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}));
app.post('/api/v1/claims', asyncHandler(async (req, res) => {
    const { tokenMint, wallet: agentWallet } = req.body;
    if (!tokenMint || !agentWallet) {
        return res.status(400).json({ success: false, error: 'Missing tokenMint or wallet' });
    }
    try {
        const authority = new web3_js_1.PublicKey(agentWallet);
        const tokenMintKey = new web3_js_1.PublicKey(tokenMint);
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
        const [vaultPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID);
        const [sentinelPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), authority.toBuffer()], PROGRAM_ID);
        const [votePda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vote'), tokenMintKey.toBuffer(), authority.toBuffer()], PROGRAM_ID);
        const [tokenAnalysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMintKey.toBuffer()], PROGRAM_ID);
        const tx = await program.methods
            .rewardSentinel()
            .accounts({
            protocol: protocolPda,
            vault: vaultPda,
            sentinel: sentinelPda,
            sentinelVote: votePda,
            tokenAnalysis: tokenAnalysisPda,
            authority: authority,
        })
            .rpc();
        res.json({
            success: true,
            message: 'Rewards claimed successfully',
            transaction: tx
        });
    }
    catch (e) {
        console.error('Claim error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
}));
// ============ ADMIN ENDPOINTS ============
app.post('/api/v1/admin/report-rug', asyncHandler(async (req, res) => {
    const { tokenMint, evidenceHash } = req.body;
    if (!tokenMint) {
        return res.status(400).json({ success: false, error: 'Missing tokenMint' });
    }
    try {
        const tokenMintKey = new web3_js_1.PublicKey(tokenMint);
        const evidence = evidenceHash
            ? Buffer.from(evidenceHash, 'hex')
            : Buffer.alloc(32);
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
        const [tokenAnalysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMintKey.toBuffer()], PROGRAM_ID);
        const tx = await program.methods
            .reportRug([...evidence])
            .accounts({
            protocol: protocolPda,
            tokenAnalysis: tokenAnalysisPda,
            reporter: adminWallet.publicKey,
        })
            .signers([adminWallet])
            .rpc();
        res.json({
            success: true,
            message: 'Rug reported successfully',
            transaction: tx
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}));
// ============ MOLTBOOK INTEGRATION ============
app.get('/api/v1/verify-moltbook/:said', asyncHandler(async (req, res) => {
    if (!MOLTBOOK_API_KEY) {
        return res.status(500).json({ success: false, error: 'Moltbook API not configured' });
    }
    try {
        const moltResponse = await axios_1.default.get(`${MOLTBOOK_API}/api/v1/agents/${req.params.said}`, {
            headers: { 'Authorization': `Bearer ${MOLTBOOK_API_KEY}` },
            timeout: 5000
        });
        res.json({
            success: true,
            verified: moltResponse.data?.claimed || false,
            data: moltResponse.data
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: 'Verification failed' });
    }
}));
// ============ SHIELD ENDPOINT ============
app.get('/shield/:mint', asyncHandler(async (req, res) => {
    try {
        const tokenMint = new web3_js_1.PublicKey(req.params.mint);
        const [tokenAnalysisPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMint.toBuffer()], PROGRAM_ID);
        const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
        // SECURITY: Only allow if finalized and explicitly safe
        const isSafe = analysis.isFinalized && analysis.finalVerdict.safe !== undefined;
        res.json({
            mint: req.params.mint,
            action: isSafe ? 'ALLOW' : 'VETO',
            finalized: analysis.isFinalized,
            verdict: Object.keys(analysis.finalVerdict || {})[0] || null,
            confidence: analysis.consensusConfidence
        });
    }
    catch (e) {
        res.json({
            mint: req.params.mint,
            action: 'VETO',
            reason: 'Token not analyzed',
            finalized: false
        });
    }
}));
// ============ ADMIN ENDPOINTS ============
app.get('/api/v1/admin/status', asyncHandler(async (req, res) => {
    try {
        // Check if program is deployed
        const programInfo = await connection.getAccountInfo(PROGRAM_ID);
        const isDeployed = programInfo !== null;
        // Check if protocol is initialized
        let isInitialized = false;
        let protocolData = null;
        try {
            const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
            protocolData = await program.account.protocol.fetch(protocolPda);
            isInitialized = true;
        }
        catch {
            isInitialized = false;
        }
        // Check wallet balance
        const balance = await connection.getBalance(adminWallet.publicKey);
        res.json({
            success: true,
            status: {
                programDeployed: isDeployed,
                programId: PROGRAM_ID.toBase58(),
                programSize: programInfo?.data?.length || 0,
                protocolInitialized: isInitialized,
                walletBalance: balance / 1e9,
                adminWallet: adminWallet.publicKey.toBase58()
            }
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
}));
app.post('/api/v1/admin/initialize', asyncHandler(async (req, res) => {
    try {
        const [protocolPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('v2')], PROGRAM_ID);
        const [vaultPda] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID);
        const tx = await program.methods
            .initialize({
            min_stake: new anchor.BN(0.1 * 1e9), // 0.1 SOL
            verdict_window: 120, // 2 minutes
            grace_period: 18000, // 5 hours
            quorum: 1,
            slash_percent: 50
        })
            .accounts({
            protocol: protocolPda,
            vault: vaultPda,
            admin: adminWallet.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId
        })
            .signers([adminWallet])
            .rpc();
        res.json({
            success: true,
            message: 'Protocol initialized successfully',
            transaction: tx
        });
    }
    catch (e) {
        console.error('Initialization error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
}));
// ============ STATIC FILES ============
app.use(express_1.default.static('../dashboard'));
app.use('/skills.md', express_1.default.static('../docs/skills.md'));
// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
app.listen(PORT, () => {
    console.log(`🛡️ SENTRY API v2.0.0 running on port ${PORT}`);
    console.log(`   Network: ${NETWORK}`);
    console.log(`   Program: ${PROGRAM_ID.toBase58()}`);
    console.log(`   Admin: ${adminWallet.publicKey.toBase58()}`);
});
//# sourceMappingURL=server.js.map