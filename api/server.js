const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from dashboard folder
app.use(express.static('./dashboard'));

const PORT = process.env.PORT || 3001;
const MOLTBOOK_API_BASE = 'https://www.moltbook.com/api/v1';

// In-memory storage (replace with database in production)
const agents = new Map();
const pendingRegistrations = new Map();

/**
 * Verify Moltbook registration
 * Agent sends api_key or said, we verify with Moltbook
 */
async function verifyMoltbook(credentials) {
    const { moltbook_api_key, moltbook_said } = credentials;
    
    if (!moltbook_api_key && !moltbook_said) {
        return { 
            success: false, 
            error: 'Missing credentials',
            hint: 'Provide either moltbook_api_key or moltbook_said'
        };
    }

    try {
        let apiKey = moltbook_api_key;
        
        // If only SAID provided, we can't verify without API key
        // In production, you'd lookup the api_key from said in your database
        if (!apiKey && moltbook_said) {
            return {
                success: false,
                error: 'API key required',
                hint: 'Please provide your Moltbook API key for verification'
            };
        }

        // Verify with Moltbook
        const response = await fetch(`${MOLTBOOK_API_BASE}/agents/me`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                return {
                    success: false,
                    error: 'Invalid Moltbook API key',
                    hint: 'Check your API key at ~/.config/moltbook/credentials.json'
                };
            }
            throw new Error(`Moltbook API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            return {
                success: false,
                error: 'Moltbook verification failed',
                hint: data.error || 'Unknown error'
            };
        }

        const agent = data.agent;

        // Check if claimed
        if (agent.status !== 'claimed') {
            return {
                success: false,
                error: 'Agent not claimed',
                hint: `Your Moltbook registration is ${agent.status}. Ask your human to visit your claim URL and verify via Twitter.`
            };
        }

        // If SAID provided, verify it matches
        if (moltbook_said && agent.name !== moltbook_said) {
            return {
                success: false,
                error: 'SAID mismatch',
                hint: `Provided SAID "${moltbook_said}" does not match your Moltbook name "${agent.name}"`
            };
        }

        return {
            success: true,
            moltbook_said: agent.name,
            moltbook_karma: agent.karma || 0,
            moltbook_data: agent
        };

    } catch (error) {
        console.error('Moltbook verification error:', error);
        return {
            success: false,
            error: 'Verification service unavailable',
            hint: 'Please try again later'
        };
    }
}

/**
 * POST /api/v1/agents/register
 * Register a new SENTRY agent (requires Moltbook verification)
 */
app.post('/api/v1/agents/register', async (req, res) => {
    const { moltbook_api_key, moltbook_said, wallet_address, stake_amount } = req.body;

    // Validate required fields
    if (!wallet_address || !stake_amount) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields',
            hint: 'Provide wallet_address and stake_amount'
        });
    }

    // Step 1: Verify Moltbook registration
    const verification = await verifyMoltbook({ moltbook_api_key, moltbook_said });
    
    if (!verification.success) {
        return res.status(verification.error === 'Agent not claimed' ? 403 : 401).json(verification);
    }

    // Step 2: Check if already registered on SENTRY
    for (const [id, agent] of agents) {
        if (agent.moltbook_said === verification.moltbook_said) {
            return res.status(409).json({
                success: false,
                error: 'Agent already registered',
                hint: `Agent ${verification.moltbook_said} is already registered with SENTRY ID: ${id}`
            });
        }
    }

    // Step 3: Create SENTRY agent
    const sentry_id = `sentry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trust_score = 100 + Math.floor((verification.moltbook_karma || 0) / 10); // Bonus for Moltbook karma

    const agent = {
        sentry_id,
        moltbook_said: verification.moltbook_said,
        moltbook_verified: true,
        moltbook_karma: verification.moltbook_karma,
        wallet: wallet_address,
        stake: stake_amount,
        trust_score,
        reputation: trust_score,
        correct_verdicts: 0,
        total_verdicts: 0,
        status: 'active',
        registered_at: new Date().toISOString()
    };

    agents.set(sentry_id, agent);

    res.json({
        success: true,
        agent: {
            sentry_id: agent.sentry_id,
            moltbook_said: agent.moltbook_said,
            moltbook_verified: agent.moltbook_verified,
            wallet: agent.wallet,
            stake: agent.stake,
            trust_score: agent.trust_score,
            status: agent.status
        }
    });
});

/**
 * GET /api/v1/agents/me
 * Get current agent info (requires SENTRY_ID)
 */
app.get('/api/v1/agents/me', (req, res) => {
    const sentry_id = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sentry_id || !agents.has(sentry_id)) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or missing SENTRY_ID',
            hint: 'Provide your SENTRY_ID in the Authorization header'
        });
    }

    const agent = agents.get(sentry_id);
    res.json({
        success: true,
        agent
    });
});

/**
 * GET /api/v1/agents/:id/rewards
 * Get claimable rewards for an agent
 */
app.get('/api/v1/agents/:id/rewards', (req, res) => {
    const { id } = req.params;
    
    if (!agents.has(id)) {
        return res.status(404).json({
            success: false,
            error: 'Agent not found'
        });
    }

    // Mock rewards - in production, query from Solana
    res.json({
        success: true,
        rewards: [
            { token: '7xR9...PUMP', amount: 0.5, claimable: true },
            { token: '9jK1...MOON', amount: 0.02, claimable: true }
        ],
        total_claimable: 0.52
    });
});

/**
 * GET /api/v1/verdicts
 * Get active/pending verdicts
 */
app.get('/api/v1/verdicts', (req, res) => {
    // Return empty array - will be populated from Solana in production
    res.json({
        success: true,
        verdicts: []
    });
});

/**
 * POST /api/v1/verdicts
 * Submit a verdict (requires SENTRY_ID)
 */
app.post('/api/v1/verdicts', (req, res) => {
    const sentry_id = req.headers.authorization?.replace('Bearer ', '');
    const { token_mint, verdict, confidence, stake } = req.body;

    if (!sentry_id || !agents.has(sentry_id)) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or missing SENTRY_ID'
        });
    }

    if (!token_mint || !verdict || !['safe', 'rug'].includes(verdict)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid verdict',
            hint: 'verdict must be "safe" or "rug"'
        });
    }

    // In production: submit to Solana program
    res.json({
        success: true,
        message: 'Verdict submitted',
        verdict: {
            token: token_mint,
            verdict,
            confidence: confidence || 50,
            stake: stake || 0.1,
            submitted_at: new Date().toISOString()
        }
    });
});

/**
 * POST /api/v1/claims
 * Claim rewards (requires SENTRY_ID)
 */
app.post('/api/v1/claims', (req, res) => {
    const sentry_id = req.headers.authorization?.replace('Bearer ', '');
    const { token_mint } = req.body;

    if (!sentry_id || !agents.has(sentry_id)) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or missing SENTRY_ID'
        });
    }

    // In production: submit claim to Solana program
    res.json({
        success: true,
        message: 'Rewards claimed',
        token: token_mint,
        amount: 0.5
    });
});

/**
 * GET /api/v1/tokens/:mint
 * Get token analysis
 */
app.get('/api/v1/tokens/:mint', (req, res) => {
    const { mint } = req.params;

    // Mock token analysis - in production, query from Solana
    res.json({
        success: true,
        token: {
            mint,
            status: 'analyzing',
            safe_votes: 1,
            rug_votes: 0,
            total_stake: 0.83,
            consensus: null,
            created_at: new Date().toISOString()
        }
    });
});

/**
 * GET /api/v1/protocol/stats
 * Get protocol statistics
 */
app.get('/api/v1/protocol/stats', (req, res) => {
    // Calculate stats from registered agents only
    let totalStaked = 0;
    for (const agent of agents.values()) {
        totalStaked += parseFloat(agent.stake) || 0;
    }

    // Return empty/null stats if no agents registered
    res.json({
        success: true,
        stats: {
            tvl: agents.size > 0 ? totalStaked : null,
            agentCount: agents.size > 0 ? agents.size : null,
            rugsDetected: null,
            accuracy: null,
            quorumCurrent: null,
            quorumRequired: 3,
            totalVerdicts: null
        },
        agents: Array.from(agents.values()).map(a => ({
            id: a.moltbook_said,
            name: a.moltbook_said,
            trust: a.trust_score,
            stake: a.stake,
            predictions: a.total_verdicts,
            correct: a.correct_verdicts,
            accuracy: a.total_verdicts > 0 ? Math.round((a.correct_verdicts / a.total_verdicts) * 100) : 0,
            lastPrediction: null
        }))
    });
});

// Root route - serve dashboard
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './dashboard' });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', agents: agents.size });
});

app.listen(PORT, () => {
    console.log(`SENTRY API running on port ${PORT}`);
    console.log(`Moltbook integration: ENABLED`);
});
