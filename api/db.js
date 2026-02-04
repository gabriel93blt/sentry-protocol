const { supabase } = require('./supabase');

// ==================== AGENTS ====================

async function createAgent(agentData) {
    const { data, error } = await supabase
        .from('agents')
        .insert([agentData])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getAgentBySentryId(sentry_id) {
    const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('sentry_id', sentry_id)
        .single();
    
    if (error) return null;
    return data;
}

async function getAgentByMoltbookSaid(moltbook_said) {
    const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('moltbook_said', moltbook_said)
        .single();
    
    if (error) return null;
    return data;
}

async function updateAgent(sentry_id, updates) {
    // Convert camelCase to snake_case for Supabase
    const snakeCaseUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snakeCaseUpdates[snakeKey] = value;
    }
    
    const { data, error } = await supabase
        .from('agents')
        .update(snakeCaseUpdates)
        .eq('sentry_id', sentry_id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getAllAgents() {
    const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('trust_score', { ascending: false });
    
    if (error) throw error;
    return data || [];
}

async function getAgentCount() {
    const { count, error } = await supabase
        .from('agents')
        .select('*', { count: 'exact', head: true });
    
    if (error) return 0;
    return count;
}

async function getTotalStaked() {
    const { data, error } = await supabase
        .from('agents')
        .select('stake');
    
    if (error) return 0;
    return data.reduce((sum, agent) => sum + parseFloat(agent.stake || 0), 0);
}

// ==================== VERDICTS ====================

async function createVerdict(verdictData) {
    const { data, error } = await supabase
        .from('verdicts')
        .insert([verdictData])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getVerdictById(verdict_id) {
    const { data, error } = await supabase
        .from('verdicts')
        .select('*')
        .eq('verdict_id', verdict_id)
        .single();
    
    if (error) return null;
    return data;
}

async function getVerdicts(filters = {}) {
    let query = supabase
        .from('verdicts')
        .select('*')
        .order('submitted_at', { ascending: false });
    
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    
    if (filters.token) {
        query = query.eq('token_mint', filters.token);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
}

async function updateVerdict(verdict_id, updates) {
    const { data, error } = await supabase
        .from('verdicts')
        .update(updates)
        .eq('verdict_id', verdict_id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getVerdictCount() {
    const { count, error } = await supabase
        .from('verdicts')
        .select('*', { count: 'exact', head: true });
    
    if (error) return 0;
    return count;
}

async function getRugsDetectedCount() {
    const { count, error } = await supabase
        .from('verdicts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finalized')
        .eq('final_verdict', 'rug');
    
    if (error) return 0;
    return count;
}

// ==================== REWARDS ====================

async function getRewardsByAgent(sentry_id) {
    const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .eq('sentry_id', sentry_id)
        .eq('claimed', false);
    
    if (error) throw error;
    return data || [];
}

async function createReward(rewardData) {
    const { data, error } = await supabase
        .from('rewards')
        .insert([rewardData])
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function markRewardAsClaimed(reward_id) {
    const { data, error } = await supabase
        .from('rewards')
        .update({ claimed: true, claimed_at: new Date().toISOString() })
        .eq('id', reward_id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

// ==================== PROTOCOL STATS ====================

async function updateProtocolStats() {
    const [agentCount, totalStaked, verdictCount, rugsCount] = await Promise.all([
        getAgentCount(),
        getTotalStaked(),
        getVerdictCount(),
        getRugsDetectedCount()
    ]);
    
    const { data, error } = await supabase
        .from('protocol_stats')
        .update({
            tvl: totalStaked,
            agent_count: agentCount,
            rugs_detected: rugsCount,
            total_verdicts: verdictCount,
            updated_at: new Date().toISOString()
        })
        .eq('id', (await supabase.from('protocol_stats').select('id').single()).data.id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getProtocolStats() {
    const { data, error } = await supabase
        .from('protocol_stats')
        .select('*')
        .single();
    
    if (error) return {
        tvl: 0,
        agent_count: 0,
        rugs_detected: 0,
        total_verdicts: 0
    };
    
    return data;
}

module.exports = {
    // Agents
    createAgent,
    getAgentBySentryId,
    getAgentByMoltbookSaid,
    updateAgent,
    getAllAgents,
    getAgentCount,
    getTotalStaked,
    
    // Verdicts
    createVerdict,
    getVerdictById,
    getVerdicts,
    updateVerdict,
    getVerdictCount,
    getRugsDetectedCount,
    
    // Rewards
    getRewardsByAgent,
    createReward,
    markRewardAsClaimed,
    
    // Stats
    updateProtocolStats,
    getProtocolStats
};
