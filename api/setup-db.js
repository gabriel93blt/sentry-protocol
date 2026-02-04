const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rdablktlmthjodevbpzl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkYWJsa3RsbXRoam9kZXZicHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNDMzMzYsImV4cCI6MjA4NTgxOTMzNn0.G_dYA-ifK9tbo6ytg_aycIpuoNYQWFd5T641_ARqTUc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
    console.log('🚀 Setting up SENTRY database...\n');
    
    try {
        // Test connection
        console.log('1. Testing connection...');
        const { data: testData, error: testError } = await supabase
            .from('agents')
            .select('*')
            .limit(1);
        
        if (testError && testError.code === '42P01') {
            console.log('   ❌ Tables do not exist yet');
            console.log('   📝 Please run the SQL schema in Supabase Dashboard:');
            console.log('   https://app.supabase.com/project/rdablktlmthjodevbpzl/sql-editor\n');
            console.log('   Or copy-paste this SQL:\n');
            console.log('---');
            console.log(require('fs').readFileSync('./supabase-schema.sql', 'utf8'));
            console.log('---\n');
        } else if (testError) {
            console.log('   ❌ Error:', testError.message);
        } else {
            console.log('   ✅ Database connected!');
            console.log('   📊 Tables exist and are accessible\n');
            
            // Count records
            const { count: agentCount } = await supabase
                .from('agents')
                .select('*', { count: 'exact', head: true });
            
            const { count: verdictCount } = await supabase
                .from('verdicts')
                .select('*', { count: 'exact', head: true });
            
            console.log(`   📈 Current stats:`);
            console.log(`   - Agents: ${agentCount || 0}`);
            console.log(`   - Verdicts: ${verdictCount || 0}\n`);
        }
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    }
}

setupDatabase();
