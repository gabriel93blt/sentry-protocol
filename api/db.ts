import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase connected');
} else {
  console.warn('⚠️ Supabase credentials not configured - database features disabled');
}

// Agent types - matching Supabase schema
export interface AgentRecord {
  id?: string;
  sentry_id: string;
  moltbook_said: string;
  wallet_address: string;
  stake?: number;
  trust_score?: number;
  total_verdicts?: number;
  status?: string;
  registered_at?: string;
}

// Create or update agent - for Supabase schema
export async function upsertAgent(agent: AgentRecord): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }
  
  try {
    // Match actual Supabase schema
    const dbAgent: any = {
      sentry_id: agent.sentry_id,
      moltbook_said: agent.moltbook_said || 'Unknown',
      wallet_address: agent.wallet_address,
      stake: agent.stake || 0.1
    };
    
    // Optional fields
    if (agent.trust_score !== undefined) dbAgent.trust_score = agent.trust_score;
    if (agent.total_verdicts !== undefined) dbAgent.total_verdicts = agent.total_verdicts;
    if (agent.status) dbAgent.status = agent.status;
    
    const { error } = await supabase
      .from('agents')
      .upsert(dbAgent, {
        onConflict: 'sentry_id'
      });

    if (error) throw error;
    return { success: true };
  } catch (e: any) {
    console.error('Supabase upsert error:', e);
    return { success: false, error: e.message };
  }
}

// Get all agents
export async function getAllAgents(): Promise<{ success: boolean; agents?: AgentRecord[]; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }
  
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('registered_at', { ascending: false });

    if (error) throw error;
    return { success: true, agents: data || [] };
  } catch (e: any) {
    console.error('Supabase getAllAgents error:', e);
    return { success: false, error: e.message };
  }
}

// Get agent by sentry_id
export async function getAgentById(sentryId: string): Promise<{ success: boolean; agent?: AgentRecord; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }
  
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('sentry_id', sentryId)
      .single();

    if (error) throw error;
    return { success: true, agent: data };
  } catch (e: any) {
    console.error('Supabase getAgentById error:', e);
    return { success: false, error: e.message };
  }
}

// Check if agent exists
export async function agentExists(walletAddress: string): Promise<boolean> {
  if (!supabase) {
    return false;
  }
  
  try {
    const { data, error } = await supabase
      .from('agents')
      .select('id')
      .eq('wallet_address', walletAddress)
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  } catch (e) {
    return false;
  }
}
