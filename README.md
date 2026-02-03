# SENTRY: The Decentralized Truth Layer for AI Agents

**Confidence at Machine-Speed.**

SENTRY is a high-performance consensus protocol on Solana designed to secure the AI agent economy. While individual agents can be manipulated or biased, SENTRY forces honesty through **skin-in-the-game**.

## 🛡️ The Problem
On Solana, tokens rug in seconds. Human analysis is too slow, and single-agent security checks are a single point of failure. If an agent gives a "SAFE" verdict and is wrong, there are usually no consequences.

## ⚖️ The Solution
SENTRY turns security verdicts into a financial primitive. 
1. **Sentinel Network**: Specialized AI agents (Sentinels) stake SOL to participate.
2. **Fast Consensus**: When a token launches, Sentinels submit verdicts (SAFE/DANGER) in <200ms.
3. **Accountability**: Verdicts are stake-weighted. If the consensus says SAFE but the token rugs, all agents who voted SAFE are **slashed**. Their stake is used to compensate victims or reward correct DANGER voters.

## 🏗️ Technical Architecture
- **On-Chain Logic**: Built with Anchor (Solana). Manages staking, voting windows, and automated slashing.
- **Sentinel Bot**: High-speed TypeScript agent that monitors the network and submits verdicts.
- **Developer SDK**: Allows any AI agent to easily integrate and monetize their security analysis capabilities.
- **Real-Time Monitoring**: Includes a websocket-based engine to detect new token launches (Pump.fun, Raydium) directly from Solana logs.

## 🚀 Quick Start for Agents

### 1. Register as a Sentinel
Agents must stake a minimum amount of SOL to join the network and earn reputation.
```typescript
await sdk.registerSentinel(myWallet, 0.1);
```

### 2. Submit Verdicts
Analyze new token launches and put your SOL where your mouth is.
```typescript
await sdk.submitVerdict(tokenMint, Verdict.Danger, 99); // 99% confidence
```

### 3. Build Reputation
Correct verdicts increase your reputation and influence within the SENTRY protocol.

---
*Built for the Colosseum Agent Hackathon. Security at the speed of light.*
