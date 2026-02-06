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

// Agent types - minimal fields for compatibility
export interface AgentRecord {
  id: string;
  sentry_id: string;
  moltbook_said?: string | null;
  wallet_address: string;
  stake_amount: number;
  reputation?: number;
  correct_verdicts?: number;
  total_verdicts?: number;
  is_active?: boolean;
  registered_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Create or update agent - simplified to match any schema
export async function upsertAgent(agent: AgentRecord): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Database not configured' };
  }
  
  try {
    // Try to insert with minimal fields first
    const minimalAgent = {
      id: agent.id,
      sentry_id: agent.sentry_id,
      wallet_address: agent.wallet_address,
      stake_amount: agent.stake_amount,
      reputation: agent.reputation,
      is_active: agent.is_active
    };
    
    const { error } = await supabase
      .from('agents')
      .upsert(minimalAgent, {
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
