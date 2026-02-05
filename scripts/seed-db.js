#!/usr/bin/env node
// Reset Supabase and seed with BCORP

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://ziujnkshswldphdkoiqf.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InppdWpua3Noc3dsZHBoZGtvaXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNDkxMzksImV4cCI6MjA4NTgyNTEzOX0.c2flHQt0ST9o3i4B03UHFrTj6l65XfNs8KwR3vMz3Xo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetAndSeed() {
  console.log('🗑️ Resetting Supabase database...');
  
  // Delete all existing agents
  const { error: deleteError } = await supabase
    .from('agents')
    .delete()
    .neq('id', 'placeholder');
  
  if (deleteError) {
    console.error('❌ Delete error:', deleteError.message);
  } else {
    console.log('✅ Database cleared');
  }
  
  // Add BCORP as first agent
  const bcorp = {
    id: 'sentry_bcorp_001',
    sentry_id: 'CFjkzZNACVWb3xgGexY8X9JePLoVcE5jkT3RxQiEs8hk',
    moltbook_said: 'Echo-1',
    wallet_address: 'EqdrjvCwhKthxdeKD2vQih3rkmRfrb6dPwhht7dGjNTX',
    stake_amount: 0.19857516,
    reputation: 100,
    correct_verdicts: 0,
    total_verdicts: 0,
    is_active: true,
    registered_at: new Date().toISOString()
  };
  
  const { error: insertError } = await supabase
    .from('agents')
    .insert(bcorp);
  
  if (insertError) {
    console.error('❌ Insert error:', insertError.message);
  } else {
    console.log('✅ BCORP (Echo-1) added to database');
  }
  
  // Add Admin wallet as second agent
  const admin = {
    id: 'sentry_admin_001',
    sentry_id: '5qrcLAt8N6fiVqQiPU9VDshqzQzHFeGYpZTcjvzkgBq',
    moltbook_said: null,
    wallet_address: '3zvtcDRtfDV4MxA7B4huiWVVnBKzs7UcV2L8Q9hnUpSx',
    stake_amount: 0.83281212,
    reputation: 100,
    correct_verdicts: 0,
    total_verdicts: 0,
    is_active: true,
    registered_at: new Date().toISOString()
  };
  
  const { error: adminError } = await supabase
    .from('agents')
    .insert(admin);
  
  if (adminError) {
    console.error('❌ Admin insert error:', adminError.message);
  } else {
    console.log('✅ Admin added to database');
  }
  
  console.log('\n🎉 Database reset complete!');
  console.log('   2 agents synced from on-chain data');
}

resetAndSeed().catch(console.error);
