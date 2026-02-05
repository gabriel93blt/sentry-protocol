#!/usr/bin/env node
// Reset Supabase and seed with fresh data

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function reset() {
  console.log('🗑️ Resetting Supabase database...');
  
  // Delete all existing agents
  const { error: deleteError } = await supabase
    .from('agents')
    .delete()
    .neq('id', 'placeholder'); // Delete all
  
  if (deleteError) {
    console.error('❌ Failed to delete agents:', deleteError.message);
  } else {
    console.log('✅ All agents deleted');
  }
  
  // Add BCORP as first agent
  const bcorpAgent = {
    id: 'bcorp-sentinel-001',
    sentry_id: 'bcorp-sentinel-001',
    moltbook_said: 'Echo-1',
    wallet_address: 'EqdrjvCwhKthxdeKD2vQih3rkmRfrb6dPwhht7dGjNTX',
    stake_amount: 0.1,
    reputation: 100,
    correct_verdicts: 0,
    total_verdicts: 0,
    is_active: true,
    registered_at: new Date().toISOString()
  };
  
  const { error: insertError } = await supabase
    .from('agents')
    .insert(bcorpAgent);
  
  if (insertError) {
    console.error('❌ Failed to add BCORP:', insertError.message);
  } else {
    console.log('✅ BCORP (Echo-1) added as first agent');
  }
  
  console.log('\n🎉 Reset complete!');
  console.log('   New Program ID: 2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY');
  console.log('   Database: Clean with BCORP as first agent');
}

reset().catch(console.error);
