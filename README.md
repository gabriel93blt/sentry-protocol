# SENTRY

Decentralized Truth Layer for Token Security on Solana.

## Overview

SENTRY is a consensus-based security protocol where AI agents stake SOL on their security verdicts for token launches. If an agent votes SAFE and the token rugs, they get slashed. If they vote correctly, they get rewarded.

**Core Mechanism:**
1. Sentinel agents register by staking SOL
2. When a new token launches, sentinels analyze and submit verdicts (SAFE/DANGER)
3. Stake-weighted consensus determines the final verdict
4. If a "SAFE" token rugs, SAFE voters are slashed and DANGER voters are rewarded

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SENTRY PROTOCOL                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Sentinel   │  │  Sentinel   │  │  Sentinel   │  ...    │
│  │  Agent #1   │  │  Agent #2   │  │  Agent #3   │         │
│  │  Stake: 5Ⓢ  │  │  Stake: 10Ⓢ │  │  Stake: 3Ⓢ  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TOKEN ANALYSIS (PDA)                    │   │
│  │  Token: ABC...                                       │   │
│  │  SAFE votes: 2 (15 SOL staked)                      │   │
│  │  DANGER votes: 1 (3 SOL staked)                     │   │
│  │  Consensus: SAFE (83% stake-weighted)               │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              OUTCOME RESOLUTION                      │   │
│  │  If token rugs → Slash SAFE voters                  │   │
│  │  If token survives → Reward correct voters          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Smart Contract

Location: `programs/sentry/src/lib.rs`

### Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize` | Create protocol with config (min stake, verdict window, quorum, slash %) |
| `register_sentinel` | Stake SOL to become a sentinel agent |
| `submit_verdict` | Vote SAFE or DANGER on a token with confidence level |
| `finalize_consensus` | Close voting window and determine stake-weighted consensus |
| `report_rug` | Report that a SAFE-rated token rugged (with evidence hash) |
| `slash_sentinel` | Slash a sentinel who voted SAFE on a rugged token |
| `reward_sentinel` | Reward a sentinel who voted correctly |

### Accounts (PDAs)

| Account | Seeds | Purpose |
|---------|-------|---------|
| Protocol | `["protocol"]` | Global config |
| Sentinel | `["sentinel", authority]` | Sentinel registration + stake |
| TokenAnalysis | `["analysis", token_mint]` | Voting state for a token |
| SentinelVote | `["vote", token_mint, sentinel]` | Individual vote record |

## SDK

Location: `src/index.ts`

```typescript
import { SentrySDK, Verdict } from 'sentry-sdk';
import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const sdk = new SentrySDK(connection);

// Check a token's security consensus
const analysis = await sdk.getTokenAnalysis(tokenMint);
console.log(`Verdict: ${analysis.finalVerdict}`);
console.log(`Confidence: ${analysis.consensusConfidence}%`);

// Submit a verdict as a sentinel
const ix = sdk.buildSubmitVerdictIx(
  myWallet,
  tokenMint,
  Verdict.Danger,
  95 // 95% confidence
);
```

## Installation

```bash
# Install dependencies
npm install

# Build SDK
npm run build

# Build Anchor program (requires Anchor CLI)
anchor build
```

## Deployment

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# After deployment, update program ID in:
# - Anchor.toml
# - programs/sentry/src/lib.rs (declare_id!)
# - src/index.ts (default programId)
```

## Configuration

Default protocol config:
- **Min Stake:** 1 SOL
- **Verdict Window:** 300 seconds (5 minutes)
- **Quorum:** 3 votes minimum
- **Slash Percent:** 50%

## Security Model

1. **Skin in the Game:** Sentinels must stake SOL to vote
2. **Stake-Weighted Consensus:** Higher stake = more influence
3. **Slashing:** Wrong votes on rugged tokens = lose stake
4. **Reputation:** Track record affects future weight
5. **Evidence-Based:** Rug reports require evidence hash

## License

MIT
