#!/usr/bin/env node
// Script to seed Supabase with existing on-chain agents

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Existing agents on-chain (manual sync)
const agents = [
  {
    id: 'CFjkzZNACVWb3xgGexY8X9JePLoVcE5jkT3RxQiEs8hk',
    sentry_id: 'CFjkzZNACVWb3xgGexY8X9JePLoVcE5jkT3RxQiEs8hk',
    moltbook_said: 'Echo-1',
    wallet_address: 'EqdrjvCwhKthxdeKD2vQih3rkmRfrb6dPwhht7dGjNTX',
    stake_amount: 0.19857516,
    reputation: 100,
    correct_verdicts: 0,
    total_verdicts: 0,
    is_active: true,
    registered_at: new Date(1770142689000).toISOString()
  },
  {
    id: '5qrcLAt8N6fiVqQiPU9VDshqzQzHFeGYpZTcjvzkgBq',
    sentry_id: '5qrcLAt8N6fiVqQiPU9VDshqzQzHFeGYpZTcjvzkgBq',
    moltbook_said: null,
    wallet_address: '3zvtcDRtfDV4MxA7B4huiWVVnBKzs7UcV2L8Q9hnUpSx',
    stake_amount: 0.83281212,
    reputation: 100,
    correct_verdicts: 0,
    total_verdicts: 0,
    is_active: true,
    registered_at: new Date().toISOString()
  }
];

async function seed() {
  console.log('🌱 Seeding Supabase with existing agents...');
  
  for (const agent of agents) {
    const { error } = await supabase
      .from('agents')
      .upsert(agent, { onConflict: 'sentry_id' });
    
    if (error) {
      console.error(`❌ Failed to add ${agent.sentry_id.slice(0, 10)}:`, error.message);
    } else {
      console.log(`✅ Added ${agent.sentry_id.slice(0, 10)}... (${agent.moltbook_said || 'no SAID'})`);
    }
  }
  
  console.log('\n🎉 Done!');
}

seed().catch(console.error);
