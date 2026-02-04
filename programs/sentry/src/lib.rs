use anchor_lang::prelude::*;

declare_id!("EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm");

#[program]
pub mod sentry {
    use super::*;

    /// Initialize the Sentry protocol with admin
    pub fn initialize(ctx: Context<Initialize>, config: ProtocolConfig) -> Result<()> {
        let protocol = &mut ctx.accounts.protocol;
        protocol.admin = ctx.accounts.admin.key();
        protocol.min_stake = config.min_stake;
        protocol.verdict_window = config.verdict_window;
        protocol.grace_period = config.grace_period;
        protocol.quorum = config.quorum;
        protocol.slash_percent = config.slash_percent;
        protocol.total_agents = 0;
        protocol.total_verdicts = 0;
        protocol.bump = ctx.bumps.protocol;
        protocol.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    /// Register as a sentinel agent (stake SOL)
    pub fn register_sentinel(ctx: Context<RegisterSentinel>, stake_amount: u64) -> Result<()> {
        let sentinel = &mut ctx.accounts.sentinel;
        let protocol = &mut ctx.accounts.protocol;

        require!(
            stake_amount >= protocol.min_stake,
            SentryError::InsufficientStake
        );

        // Physical Locking: Transfer SOL to Vault PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi_context, stake_amount)?;

        sentinel.authority = ctx.accounts.authority.key();
        sentinel.stake = stake_amount;
        sentinel.reputation = 100; // Start at 100
        sentinel.correct_verdicts = 0;
        sentinel.total_verdicts = 0;
        sentinel.is_active = true;
        sentinel.registered_at = Clock::get()?.unix_timestamp;
        sentinel.bump = ctx.bumps.sentinel;

        protocol.total_agents += 1;

        emit!(SentinelRegistered {
            sentinel: sentinel.authority,
            stake: sentinel.stake,
        });

        Ok(())
    }

    /// Submit a verdict on a token (SAFE or DANGER)
    pub fn submit_verdict(
        ctx: Context<SubmitVerdict>,
        token_mint: Pubkey,
        verdict: Verdict,
        confidence: u8,
    ) -> Result<()> {
        let sentinel = &ctx.accounts.sentinel;
        let token_analysis = &mut ctx.accounts.token_analysis;

        require!(sentinel.is_active, SentryError::SentinelInactive);
        require!(confidence <= 100, SentryError::InvalidConfidence);

        // Check if voting window is still open
        let clock = Clock::get()?;
        if token_analysis.created_at > 0 {
            let protocol = &ctx.accounts.protocol;
            require!(
                clock.unix_timestamp <= token_analysis.created_at + protocol.verdict_window as i64,
                SentryError::VotingClosed
            );
        } else {
            // First verdict - initialize token analysis
            token_analysis.token_mint = token_mint;
            token_analysis.created_at = clock.unix_timestamp;
            token_analysis.is_finalized = false;
            token_analysis.bump = ctx.bumps.token_analysis;
        }

        // Record the verdict
        let vote = &mut ctx.accounts.sentinel_vote;
        vote.sentinel = sentinel.authority;
        vote.token_mint = token_mint;
        vote.verdict = verdict.clone();
        vote.confidence = confidence;
        vote.stake_at_vote = sentinel.stake;
        vote.submitted_at = clock.unix_timestamp;
        vote.bump = ctx.bumps.sentinel_vote;

        // Update counters
        match verdict {
            Verdict::Safe => {
                token_analysis.safe_votes += 1;
                token_analysis.safe_stake += sentinel.stake;
            }
            Verdict::Danger => {
                token_analysis.danger_votes += 1;
                token_analysis.danger_stake += sentinel.stake;
            }
        }
        token_analysis.total_votes += 1;

        emit!(VerdictSubmitted {
            sentinel: sentinel.authority,
            token_mint,
            verdict,
            confidence,
            stake: sentinel.stake,
        });

        Ok(())
    }

    /// Finalize consensus after voting window closes
    pub fn finalize_consensus(ctx: Context<FinalizeConsensus>) -> Result<()> {
        let protocol = &ctx.accounts.protocol;
        let token_analysis = &mut ctx.accounts.token_analysis;

        require!(!token_analysis.is_finalized, SentryError::AlreadyFinalized);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp > token_analysis.created_at + protocol.verdict_window as i64,
            SentryError::VotingStillOpen
        );

        require!(
            token_analysis.total_votes >= protocol.quorum as u64,
            SentryError::QuorumNotReached
        );

        // Stake-weighted consensus
        let total_stake = token_analysis.safe_stake + token_analysis.danger_stake;
        let safe_ratio = (token_analysis.safe_stake * 100) / total_stake;

        token_analysis.final_verdict = if safe_ratio >= 60 {
            Verdict::Safe
        } else {
            Verdict::Danger
        };
        token_analysis.consensus_confidence = safe_ratio as u8;
        token_analysis.finalized_at = clock.unix_timestamp;
        token_analysis.is_finalized = true;

        emit!(ConsensusReached {
            token_mint: token_analysis.token_mint,
            verdict: token_analysis.final_verdict.clone(),
            confidence: token_analysis.consensus_confidence,
            total_stake,
            total_votes: token_analysis.total_votes,
        });

        Ok(())
    }

    /// Report a rug pull - triggers slashing for wrong verdicts (Admin only)
    /// Can only be called after grace_period has passed since finalization
    pub fn report_rug(ctx: Context<ReportRug>, evidence_hash: [u8; 32]) -> Result<()> {
        let token_analysis = &mut ctx.accounts.token_analysis;
        let protocol = &ctx.accounts.protocol;

        // SECURITY: Only admin can report rugs to prevent spam/griefing
        require!(
            ctx.accounts.reporter.key() == protocol.admin,
            SentryError::UnauthorizedReporter
        );

        require!(token_analysis.is_finalized, SentryError::NotFinalized);
        require!(!token_analysis.is_rugged, SentryError::AlreadyReported);
        require!(
            token_analysis.final_verdict == Verdict::Safe,
            SentryError::AlreadyMarkedDanger
        );

        // GRACE PERIOD: Must wait X hours after finalization before reporting rug
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp > token_analysis.finalized_at + protocol.grace_period as i64,
            SentryError::GracePeriodNotExpired
        );

        token_analysis.is_rugged = true;
        token_analysis.rug_evidence = evidence_hash;
        token_analysis.rug_reported_at = Clock::get()?.unix_timestamp;

        // Calculate slash amount from SAFE voters
        let slash_amount = (token_analysis.safe_stake * protocol.slash_percent as u64) / 100;
        token_analysis.slash_pool = slash_amount;

        emit!(RugReported {
            token_mint: token_analysis.token_mint,
            evidence_hash,
            slash_pool: slash_amount,
        });

        Ok(())
    }

    /// Slash a sentinel who voted SAFE on a rugged token
    pub fn slash_sentinel(ctx: Context<SlashSentinel>) -> Result<()> {
        let sentinel = &mut ctx.accounts.sentinel;
        let token_analysis = &ctx.accounts.token_analysis;
        let protocol = &ctx.accounts.protocol;

        // Clone values before mutable borrow
        let vote_verdict = ctx.accounts.sentinel_vote.verdict.clone();
        let vote_stake = ctx.accounts.sentinel_vote.stake_at_vote;
        let is_slashed = ctx.accounts.sentinel_vote.is_slashed;

        require!(token_analysis.is_rugged, SentryError::NotRugged);
        require!(vote_verdict == Verdict::Safe, SentryError::VotedCorrectly);
        require!(!is_slashed, SentryError::AlreadySlashed);

        let slash_amount = (vote_stake * protocol.slash_percent as u64) / 100;
        
        // Physical Unlocking: Transfer slashed SOL from Vault to Admin/Insurance Fund
        // UPDATE (2026-02-04): Funds remain in Vault to fund rewards for correct voters
        // leaving them as "unallocated equity" in the Vault.
        /* 
        let vault_info = ctx.accounts.vault.to_account_info();
        let admin_info = ctx.accounts.admin.to_account_info();
        
        let seeds = &[b"vault".as_ref(), &[protocol.vault_bump]];
        let signer = &[&seeds[..]];

        **vault_info.try_borrow_mut_lamports()? = vault_info.lamports().checked_sub(slash_amount).ok_or(SentryError::InsufficientFunds)?;
        **admin_info.try_borrow_mut_lamports()? = admin_info.lamports().checked_add(slash_amount).ok_or(SentryError::Overflow)?;
        */

        // Stake Multiplier for Reputation
        let base_penalty: u64 = 20;
        let penalty = base_penalty.saturating_mul(vote_stake) / protocol.min_stake;

        sentinel.stake = sentinel.stake.saturating_sub(slash_amount);
        sentinel.reputation = sentinel.reputation.saturating_sub(penalty as u16);
        sentinel.total_verdicts += 1;

        // CRITICAL FIX: Mark vote as slashed to prevent double-slashing
        ctx.accounts.sentinel_vote.is_slashed = true;

        // Deactivate if stake falls below minimum
        if sentinel.stake < protocol.min_stake {
            sentinel.is_active = false;
        }

        emit!(SentinelSlashed {
            sentinel: sentinel.authority,
            token_mint: token_analysis.token_mint,
            amount: slash_amount,
        });

        Ok(())
    }

    /// Reward sentinels who voted correctly with PROPORTIONAL distribution
    /// 
    /// The odds are NATURALLY determined by stake ratios:
    /// gain = (my_stake / total_winning_stake) × total_losing_stake
    /// 
    /// Example: 1 guy @ 0.1 SOL vs 10 guys @ 0.00001 SOL each
    /// - If 0.1 SOL wins: gains (0.1/0.1) × 0.0001 = 0.0001 SOL (0.001x cote, low risk/low reward)
    /// - If small guys win: each gains (0.00001/0.0001) × 0.1 = 0.01 SOL (1000x cote, high risk/high reward)
    ///
    /// Bonus: small voter_count_multiplier (10% max) to reward consensus without breaking math
    pub fn reward_sentinel(ctx: Context<RewardSentinel>) -> Result<()> {
        let sentinel = &mut ctx.accounts.sentinel;
        let token_analysis = &ctx.accounts.token_analysis;
        let protocol = &ctx.accounts.protocol;

        require!(token_analysis.is_finalized, SentryError::NotFinalized);
        require!(!ctx.accounts.sentinel_vote.is_rewarded, SentryError::AlreadyRewarded);

        // Clone values we need before mutable borrow
        let vote_verdict = ctx.accounts.sentinel_vote.verdict.clone();
        let vote_stake = ctx.accounts.sentinel_vote.stake_at_vote;

        let correct = if token_analysis.is_rugged {
            vote_verdict == Verdict::Danger
        } else {
            vote_verdict == token_analysis.final_verdict
        };

        require!(correct, SentryError::VotedIncorrectly);

        sentinel.correct_verdicts += 1;
        sentinel.total_verdicts += 1;

        // Stake Multiplier for Reputation
        let base_reward: u64 = 5;
        let reward = base_reward.saturating_mul(vote_stake) / protocol.min_stake;
        sentinel.reputation = sentinel.reputation.saturating_add(reward as u16);

        // CRITICAL FIX: Mark vote as rewarded to prevent double-rewards
        ctx.accounts.sentinel_vote.is_rewarded = true;

        // If rug, distribute from slash pool with ODDS system
        if token_analysis.is_rugged && token_analysis.slash_pool > 0 {
            // ODDS CALCULATION (Sport Betting Style)
            // 
            // Example: 5 SAFE (losers) vs 1 DANGER (winner)
            // - Base share: winner_stake / total_danger_stake = 100%
            // - Odds multiplier: total_voters / winners = 6/1 = 6x
            // - But capped to prevent draining the pool
            //
            // Example: 5 SAFE vs 5 DANGER  
            // - Base share: 20% each
            // - Odds multiplier: 10/5 = 2x
            // - Result: 40% of slash_pool each
            
            let danger_stake = token_analysis.danger_stake;
            let safe_stake = token_analysis.safe_stake;
            let danger_votes = token_analysis.danger_votes;
            let safe_votes = token_analysis.safe_votes;
            let total_votes = token_analysis.total_votes;
            let voter_stake = vote_stake;
            
            // BASE ODDS: Proportional distribution by stake
            // gain = (my_stake / total_winning_stake) × total_losing_stake
            let base_share = (voter_stake as u128)
                .checked_mul(token_analysis.slash_pool as u128)
                .ok_or(SentryError::Overflow)?
                .checked_div(danger_stake as u128)
                .ok_or(SentryError::Overflow)?;
            
            // CONSENSUS BONUS: small 10% max boost based on voter ratios
            // ln(total_voters / my_side_voters) gives 0-2.3 range, we compress to 0-10%
            // This rewards being in the minority (contrarian bet) without breaking the math
            let voter_ratio = (total_votes as f64).max(1.0) / (danger_votes as f64).max(1.0);
            let consensus_bonus = ((voter_ratio.ln()).max(0.0) * 4.0) as u64; // 0-10% range
            let capped_bonus = consensus_bonus.min(10);
            
            // Final amount = base_share × (1 + bonus)
            let amount_with_bonus = base_share
                .checked_mul((100 + capped_bonus) as u128)
                .ok_or(SentryError::Overflow)?
                .checked_div(100)
                .ok_or(SentryError::Overflow)? as u64;
            
            // Safety: cap at slash_pool to prevent over-distribution
            let final_amount = amount_with_bonus.min(token_analysis.slash_pool);
            
            let vault_info = ctx.accounts.vault.to_account_info();
            let authority_info = ctx.accounts.authority.to_account_info();

            **vault_info.try_borrow_mut_lamports()? = vault_info.lamports().checked_sub(final_amount).ok_or(SentryError::InsufficientFunds)?;
            **authority_info.try_borrow_mut_lamports()? = authority_info.lamports().checked_add(final_amount).ok_or(SentryError::Overflow)?;
            
            sentinel.stake += final_amount;
            
            // Calculate implied odds for logging
            let implied_odds = if danger_stake > 0 {
                (safe_stake as f64) / (danger_stake as f64)
            } else { 0.0 };
            
            msg!("ODDS REWARD: stake={}, danger_pool={}, safe_pool={}, implied_odds={:.3}x, base_gain={}, bonus={}%, final={}", 
                voter_stake, danger_stake, safe_stake, implied_odds, base_share as u64, capped_bonus, final_amount);
        }

        emit!(SentinelRewarded {
            sentinel: sentinel.authority,
            token_mint: token_analysis.token_mint,
            reputation: sentinel.reputation,
        });

        Ok(())
    }
}

// === ACCOUNTS ===

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Protocol::SPACE,
        seeds = [b"v2"],
        bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        seeds = [b"vault"],
        bump
    )]
    pub vault: SystemAccount<'info>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterSentinel<'info> {
    #[account(
        mut,
        seeds = [b"v2"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        mut,
        seeds = [b"vault"],
        bump = protocol.vault_bump
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Sentinel::SPACE,
        seeds = [b"sentinel", authority.key().as_ref()],
        bump
    )]
    pub sentinel: Account<'info, Sentinel>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token_mint: Pubkey)]
pub struct SubmitVerdict<'info> {
    #[account(
        seeds = [b"v2"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        mut,
        seeds = [b"sentinel", authority.key().as_ref()],
        bump = sentinel.bump,
        has_one = authority
    )]
    pub sentinel: Account<'info, Sentinel>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + TokenAnalysis::SPACE,
        seeds = [b"analysis", token_mint.as_ref()],
        bump
    )]
    pub token_analysis: Account<'info, TokenAnalysis>,
    #[account(
        init,
        payer = authority,
        space = 8 + SentinelVote::SPACE,
        seeds = [b"vote", token_mint.as_ref(), authority.key().as_ref()],
        bump
    )]
    pub sentinel_vote: Account<'info, SentinelVote>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeConsensus<'info> {
    #[account(
        seeds = [b"v2"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        mut,
        seeds = [b"analysis", token_analysis.token_mint.as_ref()],
        bump = token_analysis.bump
    )]
    pub token_analysis: Account<'info, TokenAnalysis>,
}

#[derive(Accounts)]
pub struct ReportRug<'info> {
    #[account(
        seeds = [b"v2"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        mut,
        seeds = [b"analysis", token_analysis.token_mint.as_ref()],
        bump = token_analysis.bump
    )]
    pub token_analysis: Account<'info, TokenAnalysis>,
    #[account(mut)]
    pub reporter: Signer<'info>,
}

#[derive(Accounts)]
pub struct SlashSentinel<'info> {
    #[account(
        seeds = [b"v2"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        mut,
        seeds = [b"vault"],
        bump = protocol.vault_bump
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"sentinel", sentinel.authority.as_ref()],
        bump = sentinel.bump
    )]
    pub sentinel: Account<'info, Sentinel>,
    #[account(
        mut,
        seeds = [b"vote", token_analysis.token_mint.as_ref(), sentinel.authority.as_ref()],
        bump = sentinel_vote.bump
    )]
    pub sentinel_vote: Account<'info, SentinelVote>,
    #[account(
        seeds = [b"analysis", token_analysis.token_mint.as_ref()],
        bump = token_analysis.bump
    )]
    pub token_analysis: Account<'info, TokenAnalysis>,
    /// CHECK: Protocol admin receiving slashed funds
    #[account(mut)]
    pub admin: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct RewardSentinel<'info> {
    #[account(
        seeds = [b"v2"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        mut,
        seeds = [b"vault"],
        bump = protocol.vault_bump
    )]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        seeds = [b"sentinel", sentinel.authority.as_ref()],
        bump = sentinel.bump
    )]
    pub sentinel: Account<'info, Sentinel>,
    #[account(
        mut,
        seeds = [b"vote", token_analysis.token_mint.as_ref(), sentinel.authority.as_ref()],
        bump = sentinel_vote.bump
    )]
    pub sentinel_vote: Account<'info, SentinelVote>,
    #[account(
        seeds = [b"analysis", token_analysis.token_mint.as_ref()],
        bump = token_analysis.bump
    )]
    pub token_analysis: Account<'info, TokenAnalysis>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

// === STATE ===

#[account]
pub struct Protocol {
    pub admin: Pubkey,
    pub min_stake: u64,        // Minimum SOL to stake (lamports)
    pub verdict_window: u32,   // Seconds to submit verdicts
    pub grace_period: u32,     // Seconds AFTER finalization before rug report (e.g. 5h)
    pub quorum: u16,           // Minimum votes for consensus
    pub slash_percent: u8,     // % to slash on wrong verdict
    pub total_agents: u64,
    pub total_verdicts: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Protocol {
    pub const SPACE: usize = 32 + 8 + 4 + 4 + 2 + 1 + 8 + 8 + 1 + 1;
}

#[account]
pub struct Sentinel {
    pub authority: Pubkey,
    pub stake: u64,
    pub reputation: u16,       // 0-200, starts at 100
    pub correct_verdicts: u64,
    pub total_verdicts: u64,
    pub is_active: bool,
    pub registered_at: i64,
    pub bump: u8,
}

impl Sentinel {
    pub const SPACE: usize = 32 + 8 + 2 + 8 + 8 + 1 + 8 + 1;
}

#[account]
pub struct TokenAnalysis {
    pub token_mint: Pubkey,
    pub created_at: i64,
    pub finalized_at: i64,
    pub total_votes: u64,
    pub safe_votes: u64,
    pub danger_votes: u64,
    pub safe_stake: u64,
    pub danger_stake: u64,
    pub final_verdict: Verdict,
    pub consensus_confidence: u8,
    pub is_finalized: bool,
    pub is_rugged: bool,
    pub rug_evidence: [u8; 32],
    pub rug_reported_at: i64,
    pub slash_pool: u64,
    pub bump: u8,
}

impl TokenAnalysis {
    pub const SPACE: usize = 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 32 + 8 + 8 + 1;
}

#[account]
pub struct SentinelVote {
    pub sentinel: Pubkey,
    pub token_mint: Pubkey,
    pub verdict: Verdict,
    pub confidence: u8,
    pub stake_at_vote: u64,
    pub submitted_at: i64,
    pub is_slashed: bool,
    pub is_rewarded: bool,
    pub bump: u8,
}

impl SentinelVote {
    pub const SPACE: usize = 32 + 32 + 1 + 1 + 8 + 8 + 1 + 1 + 1;
}

// === TYPES ===

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum Verdict {
    #[default]
    Safe,
    Danger,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProtocolConfig {
    pub min_stake: u64,
    pub verdict_window: u32,      // Time to vote
    pub grace_period: u32,        // Time AFTER finalization before rug report (e.g., 5h = 18000s)
    pub quorum: u16,
    pub slash_percent: u8,
}

// === ERRORS ===

#[error_code]
pub enum SentryError {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    #[msg("Unauthorized reporter - only admin can report rugs")]
    UnauthorizedReporter,
    #[msg("Grace period not expired - must wait after finalization")]
    GracePeriodNotExpired,
    #[msg("Sentinel is inactive")]
    SentinelInactive,
    #[msg("Invalid confidence value (0-100)")]
    InvalidConfidence,
    #[msg("Voting window has closed")]
    VotingClosed,
    #[msg("Voting window still open")]
    VotingStillOpen,
    #[msg("Quorum not reached")]
    QuorumNotReached,
    #[msg("Already finalized")]
    AlreadyFinalized,
    #[msg("Not yet finalized")]
    NotFinalized,
    #[msg("Already reported as rug")]
    AlreadyReported,
    #[msg("Token already marked as danger")]
    AlreadyMarkedDanger,
    #[msg("Token not rugged")]
    NotRugged,
    #[msg("Sentinel voted correctly")]
    VotedCorrectly,
    #[msg("Sentinel voted incorrectly")]
    VotedIncorrectly,
    #[msg("Already slashed")]
    AlreadySlashed,
    #[msg("Already rewarded")]
    AlreadyRewarded,
    #[msg("Insufficient funds in vault")]
    InsufficientFunds,
    #[msg("Mathematical overflow")]
    Overflow,
}

// === EVENTS ===

#[event]
pub struct SentinelRegistered {
    pub sentinel: Pubkey,
    pub stake: u64,
}

#[event]
pub struct VerdictSubmitted {
    pub sentinel: Pubkey,
    pub token_mint: Pubkey,
    pub verdict: Verdict,
    pub confidence: u8,
    pub stake: u64,
}

#[event]
pub struct ConsensusReached {
    pub token_mint: Pubkey,
    pub verdict: Verdict,
    pub confidence: u8,
    pub total_stake: u64,
    pub total_votes: u64,
}

#[event]
pub struct RugReported {
    pub token_mint: Pubkey,
    pub evidence_hash: [u8; 32],
    pub slash_pool: u64,
}

#[event]
pub struct SentinelSlashed {
    pub sentinel: Pubkey,
    pub token_mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SentinelRewarded {
    pub sentinel: Pubkey,
    pub token_mint: Pubkey,
    pub reputation: u16,
}
