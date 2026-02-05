-- Create agents table for SENTRY
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  sentry_id TEXT UNIQUE NOT NULL,
  moltbook_said TEXT,
  wallet_address TEXT NOT NULL,
  stake_amount NUMERIC NOT NULL DEFAULT 0,
  reputation INTEGER NOT NULL DEFAULT 100,
  correct_verdicts INTEGER NOT NULL DEFAULT 0,
  total_verdicts INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON agents
  FOR SELECT USING (true);

-- Allow insert/update from authenticated (API key)
CREATE POLICY "Allow API write" ON agents
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_agents_wallet ON agents(wallet_address);
CREATE INDEX IF NOT EXISTS idx_agents_said ON agents(moltbook_said);
