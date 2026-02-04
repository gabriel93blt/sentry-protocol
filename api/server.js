const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from dashboard folder
app.use(express.static('./dashboard'));

const PORT = process.env.PORT || 3001;
const MOLTBOOK_API_BASE = 'https://www.moltbook.com/api/v1';

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
        
        if (!apiKey && moltbook_said) {
            return {
                success: false,
                error: 'API key required',
                hint: 'Please provide your Moltbook API key for verification'
            };
        }

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

        if (!agent.is_claimed) {
            return {
                success: false,
                error: 'Agent not claimed',
                hint: `Your Moltbook registration is pending. Ask your human to visit your claim URL and verify via Twitter.`
            };
        }

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

    // Step 2: Check if already registered
    try {
        const existingAgent = await db.getAgentByMoltbookSaid(verification.moltbook_said);
        if (existingAgent) {
            return res.status(409).json({
                success: false,
                error: 'Agent already registered',
                hint: `Agent ${verification.moltbook_said} is already registered with SENTRY ID: ${existingAgent.sentry_id}`
            });
        }
    } catch (error) {
        console.error('Error checking existing agent:', error);
    }

    // Step 3: Create SENTRY agent
    const sentry_id = `sentry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const trust_score = 100 + Math.floor((verification.moltbook_karma || 0) / 10);

    const agentData = {
        sentry_id,
        moltbook_said: verification.moltbook_said,
        moltbook_verified: true,
        moltbook_karma: verification.moltbook_karma,
        wallet_address,
        stake: stake_amount,
        trust_score,
        reputation: trust_score,
        status: 'active'
    };

    try {
        const newAgent = await db.createAgent(agentData);
        
        res.json({
            success: true,
            agent: {
                sentry_id: newAgent.sentry_id,
                moltbook_said: newAgent.moltbook_said,
                moltbook_verified: newAgent.moltbook_verified,
                wallet: newAgent.wallet_address,
                stake: newAgent.stake,
                trust_score: newAgent.trust_score,
                status: newAgent.status
            }
        });
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create agent',
            hint: error.message
        });
    }
});

/**
 * GET /api/v1/agents/me
 * Get current agent info
 */
app.get('/api/v1/agents/me', async (req, res) => {
    const sentry_id = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sentry_id) {
        return res.status(401).json({
            success: false,
            error: 'Missing SENTRY_ID',
            hint: 'Provide your SENTRY_ID in the Authorization header'
        });
    }

    try {
        const agent = await db.getAgentBySentryId(sentry_id);
        
        if (!agent) {
            return res.status(401).json({
                success: false,
                error: 'Invalid SENTRY_ID',
                hint: 'Agent not found'
            });
        }

        res.json({ success: true, agent });
    } catch (error) {
        console.error('Error fetching agent:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch agent'
        });
    }
});

/**
 * GET /api/v1/agents/:id/rewards
 * Get claimable rewards for an agent
 */
app.get('/api/v1/agents/:id/rewards', async (req, res) => {
    const { id } = req.params;
    
    try {
        const agent = await db.getAgentBySentryId(id);
        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'Agent not found'
            });
        }

        const rewards = await db.getRewardsByAgent(id);
        const total_claimable = rewards.reduce((sum, r) => sum + parseFloat(r.amount), 0);

        res.json({
            success: true,
            rewards,
            total_claimable
        });
    } catch (error) {
        console.error('Error fetching rewards:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch rewards'
        });
    }
});

/**
 * GET /api/v1/verdicts
 * Get verdicts
 */
app.get('/api/v1/verdicts', async (req, res) => {
    const { status } = req.query;
    
    try {
        const verdicts = await db.getVerdicts({ status });
        res.json({ success: true, verdicts });
    } catch (error) {
        console.error('Error fetching verdicts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch verdicts'
        });
    }
});

/**
 * POST /api/v1/verdicts
 * Submit a verdict
 */
app.post('/api/v1/verdicts', async (req, res) => {
    const sentry_id = req.headers.authorization?.replace('Bearer ', '');
    const { token_mint, verdict, confidence, stake } = req.body;

    if (!sentry_id) {
        return res.status(401).json({
            success: false,
            error: 'Missing SENTRY_ID'
        });
    }

    if (!token_mint || !verdict || !['safe', 'rug'].includes(verdict)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid verdict',
            hint: 'verdict must be "safe" or "rug"'
        });
    }

    try {
        const agent = await db.getAgentBySentryId(sentry_id);
        if (!agent) {
            return res.status(401).json({
                success: false,
                error: 'Invalid SENTRY_ID'
            });
        }

        const verdict_id = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        
        const verdictData = {
            verdict_id,
            token_mint,
            token: token_mint.substring(0, 8) + '...',
            verdict,
            confidence: confidence || 50,
            stake: stake || 0.1,
            sentry_id,
            agent_name: agent.moltbook_said,
            status: 'pending',
            safe_votes: verdict === 'safe' ? 1 : 0,
            rug_votes: verdict === 'rug' ? 1 : 0,
            safe_stake: verdict === 'safe' ? (stake || 0.1) : 0,
            rug_stake: verdict === 'rug' ? (stake || 0.1) : 0,
            total_votes: 1
        };
        
        const newVerdict = await db.createVerdict(verdictData);
        
        // Update agent stats
        await db.updateAgent(sentry_id, {
            total_verdicts: agent.total_verdicts + 1,
            last_prediction: `${verdict.toUpperCase()} on ${verdictData.token}`
        });

        res.json({
            success: true,
            message: 'Verdict submitted',
            verdict: {
                id: newVerdict.verdict_id,
                token: newVerdict.token,
                verdict: newVerdict.verdict,
                confidence: newVerdict.confidence,
                stake: newVerdict.stake,
                submitted_at: newVerdict.submitted_at
            }
        });
    } catch (error) {
        console.error('Error submitting verdict:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit verdict'
        });
    }
});

/**
 * POST /api/v1/claims
 * Claim rewards
 */
app.post('/api/v1/claims', async (req, res) => {
    const sentry_id = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sentry_id) {
        return res.status(401).json({
            success: false,
            error: 'Missing SENTRY_ID'
        });
    }

    res.json({
        success: true,
        message: 'Rewards claimed (mock - Solana integration pending)'
    });
});

/**
 * GET /api/v1/tokens/:mint
 * Get token analysis
 */
app.get('/api/v1/tokens/:mint', async (req, res) => {
    const { mint } = req.params;

    res.json({
        success: true,
        token: {
            mint,
            status: 'analyzing',
            created_at: new Date().toISOString()
        }
    });
});

/**
 * GET /api/v1/protocol/stats
 * Get protocol statistics
 */
app.get('/api/v1/protocol/stats', async (req, res) => {
    try {
        const agents = await db.getAllAgents();
        const verdicts = await db.getVerdicts();
        
        const totalStaked = agents.reduce((sum, a) => sum + parseFloat(a.stake || 0), 0);
        const rugsDetected = verdicts.filter(v => v.status === 'finalized' && v.final_verdict === 'rug').length;

        res.json({
            success: true,
            stats: {
                tvl: agents.length > 0 ? totalStaked : null,
                agentCount: agents.length > 0 ? agents.length : null,
                rugsDetected: rugsDetected > 0 ? rugsDetected : null,
                accuracy: null,
                quorumCurrent: agents.length > 0 ? Math.min(agents.length, 3) : null,
                quorumRequired: 3,
                totalVerdicts: verdicts.length > 0 ? verdicts.length : null
            },
            agents: agents.map(a => ({
                id: a.moltbook_said,
                name: a.moltbook_said,
                trust: a.trust_score,
                stake: a.stake,
                predictions: a.total_verdicts,
                correct: a.correct_verdicts,
                accuracy: a.total_verdicts > 0 ? Math.round((a.correct_verdicts / a.total_verdicts) * 100) : 0,
                lastPrediction: a.last_prediction || null
            }))
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

// Root route - serve dashboard
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: './dashboard' });
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const agentCount = await db.getAgentCount();
        res.json({ status: 'ok', agents: agentCount, database: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});

app.listen(PORT, () => {
    console.log(`SENTRY API running on port ${PORT}`);
    console.log(`Supabase: CONNECTED`);
    console.log(`Moltbook: ENABLED`);
});
