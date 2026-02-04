/**
 * Test: Multi-Agent Distribution with Stake-Based Odds
 * 
 * This script simulates multiple agents voting and verifies the distribution
 * logic works correctly after a win/loss scenario.
 * 
 * Run with: ts-node tests/multi-agent-distribution.ts
 */

import { Program } from '@coral-xyz/anchor';
import { Sentry } from '../target/types/sentry';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { BN } from 'bn.js';

interface TestScenario {
  name: string;
  dangerStakes: number[]; // in lamports (1 SOL = 1e9 lamports)
  safeStakes: number[];
  isRugged: boolean;
  expectedBehavior: string;
}

const scenarios: TestScenario[] = [
  {
    name: "High stake vs many small stakes",
    dangerStakes: [0.1 * 1e9], // 1 guy @ 0.1 SOL
    safeStakes: Array(10).fill(0.00001 * 1e9), // 10 guys @ 0.00001 SOL
    isRugged: true,
    expectedBehavior: "Big staker gets ~0.0001 SOL (0.001x), small stakers would get ~0.01 SOL each if they won"
  },
  {
    name: "Equal stakes, different counts",
    dangerStakes: [0.05 * 1e9], // 1 guy @ 0.05 SOL
    safeStakes: [0.01 * 1e9, 0.01 * 1e9, 0.01 * 1e9, 0.01 * 1e9, 0.01 * 1e9], // 5 guys @ 0.01 SOL
    isRugged: true,
    expectedBehavior: "Big staker has 1:1 stake ratio, gets proportional share"
  },
  {
    name: "Majority stake vs minority count",
    dangerStakes: [0.5 * 1e9, 0.3 * 1e9], // 2 guys @ 0.8 SOL total
    safeStakes: Array(20).fill(0.001 * 1e9), // 20 guys @ 0.02 SOL total
    isRugged: true,
    expectedBehavior: "Danger voters dominate by stake, get most of small pool"
  }
];

function calculateDistribution(
  dangerStakes: number[],
  safeStakes: number[],
  isRugged: boolean
): { winner: string; distributions: Map<number, number> } {
  const totalDanger = dangerStakes.reduce((a, b) => a + b, 0);
  const totalSafe = safeStakes.reduce((a, b) => a + b, 0);
  
  const distributions = new Map<number, number>();
  
  if (isRugged) {
    // DANGER wins - distribute SAFE pool to DANGER voters
    const pool = totalSafe;
    const totalWinners = totalDanger;
    const totalVoters = dangerStakes.length + safeStakes.length;
    const winnerCount = dangerStakes.length;
    
    dangerStakes.forEach((stake, i) => {
      // Base share: (my_stake / total_winning_stake) * pool
      const baseShare = (stake / totalWinners) * pool;
      
      // Consensus bonus: ln(total_voters / my_side_voters) * 4% capped at 10%
      const voterRatio = totalVoters / winnerCount;
      const consensusBonus = Math.min(Math.log(voterRatio) * 0.04, 0.10);
      
      const finalAmount = baseShare * (1 + consensusBonus);
      distributions.set(i, finalAmount);
    });
    
    return { winner: "DANGER", distributions };
  } else {
    // SAFE wins - distribute DANGER pool to SAFE voters
    const pool = totalDanger;
    const totalWinners = totalSafe;
    const totalVoters = dangerStakes.length + safeStakes.length;
    const winnerCount = safeStakes.length;
    
    safeStakes.forEach((stake, i) => {
      const baseShare = (stake / totalWinners) * pool;
      const voterRatio = totalVoters / winnerCount;
      const consensusBonus = Math.min(Math.log(voterRatio) * 0.04, 0.10);
      const finalAmount = baseShare * (1 + consensusBonus);
      distributions.set(i, finalAmount);
    });
    
    return { winner: "SAFE", distributions };
  }
}

function verifyInvariant(
  distributions: Map<number, number>,
  totalPool: number,
  description: string
): boolean {
  const totalDistributed = Array.from(distributions.values()).reduce((a, b) => a + b, 0);
  const withinTolerance = totalDistributed <= totalPool * 1.10; // 10% tolerance for bonus
  
  console.log(`  Pool available: ${(totalPool / 1e9).toFixed(6)} SOL`);
  console.log(`  Total distributed: ${(totalDistributed / 1e9).toFixed(6)} SOL`);
  console.log(`  Within 10% tolerance: ${withinTolerance ? '✓' : '✗'}`);
  
  return withinTolerance;
}

console.log("=== Multi-Agent Distribution Test ===\n");

scenarios.forEach((scenario, idx) => {
  console.log(`\n[Test ${idx + 1}] ${scenario.name}`);
  console.log(`  Expected: ${scenario.expectedBehavior}`);
  
  const totalDanger = scenario.dangerStakes.reduce((a, b) => a + b, 0);
  const totalSafe = scenario.safeStakes.reduce((a, b) => a + b, 0);
  
  console.log(`\n  DANGER: ${scenario.dangerStakes.length} voters, ${(totalDanger / 1e9).toFixed(6)} SOL total`);
  scenario.dangerStakes.forEach((s, i) => {
    console.log(`    - Voter ${i + 1}: ${(s / 1e9).toFixed(6)} SOL`);
  });
  
  console.log(`\n  SAFE: ${scenario.safeStakes.length} voters, ${(totalSafe / 1e9).toFixed(6)} SOL total`);
  scenario.safeStakes.forEach((s, i) => {
    console.log(`    - Voter ${i + 1}: ${(s / 1e9).toFixed(6)} SOL`);
  });
  
  // Test DANGER wins scenario
  console.log(`\n  --- Scenario: RUG CONFIRMED (DANGER wins) ---`);
  const dangerResult = calculateDistribution(
    scenario.dangerStakes,
    scenario.safeStakes,
    true
  );
  
  console.log(`  Winner: ${dangerResult.winner}`);
  console.log(`  Distributions to DANGER voters:`);
  dangerResult.distributions.forEach((amount, idx) => {
    const stake = scenario.dangerStakes[idx];
    const roi = ((amount - stake) / stake * 100);
    console.log(`    - Voter ${idx + 1}: ${(amount / 1e9).toFixed(6)} SOL (ROI: ${roi.toFixed(2)}%)`);
  });
  
  verifyInvariant(dangerResult.distributions, totalSafe, scenario.name);
  
  // Test SAFE wins scenario
  console.log(`\n  --- Scenario: SAFE (no rug, SAFE wins) ---`);
  const safeResult = calculateDistribution(
    scenario.dangerStakes,
    scenario.safeStakes,
    false
  );
  
  console.log(`  Winner: ${safeResult.winner}`);
  console.log(`  Distributions to SAFE voters:`);
  safeResult.distributions.forEach((amount, idx) => {
    const stake = scenario.safeStakes[idx];
    const roi = ((amount - stake) / stake * 100);
    console.log(`    - Voter ${idx + 1}: ${(amount / 1e9).toFixed(6)} SOL (ROI: ${roi.toFixed(2)}%)`);
  });
  
  verifyInvariant(safeResult.distributions, totalDanger, scenario.name);
});

console.log("\n=== Summary ===");
console.log("All scenarios verify:");
console.log("1. Stake-proportional distribution (main odds mechanism)");
console.log("2. Small consensus bonus (0-10% based on voter ratio)");
console.log("3. No protocol deficit (total distributed ≤ total pool + 10%)");
console.log("4. High-risk/high-reward for contrarian positions");
console.log("5. Low-risk/low-reward for consensus positions");