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
        protocol.quorum = config.quorum;
        protocol.slash_percent = config.slash_percent;
        protocol.total_agents = 0;
        protocol.total_verdicts = 0;
        protocol.bump = ctx.bumps.protocol;
        Ok(())
    }

    /// Register as a sentinel agent (stake SOL)
    pub fn register_sentinel(ctx: Context<RegisterSentinel>) -> Result<()> {
        let sentinel = &mut ctx.accounts.sentinel;
        let protocol = &mut ctx.accounts.protocol;

        require!(
            ctx.accounts.stake.lamports() >= protocol.min_stake,
            SentryError::InsufficientStake
        );

        sentinel.authority = ctx.accounts.authority.key();
        sentinel.stake = ctx.accounts.stake.lamports();
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

    /// Report a rug pull - triggers slashing for wrong verdicts
    pub fn report_rug(ctx: Context<ReportRug>, evidence_hash: [u8; 32]) -> Result<()> {
        let token_analysis = &mut ctx.accounts.token_analysis;
        let protocol = &ctx.accounts.protocol;

        require!(token_analysis.is_finalized, SentryError::NotFinalized);
        require!(!token_analysis.is_rugged, SentryError::AlreadyReported);
        require!(
            token_analysis.final_verdict == Verdict::Safe,
            SentryError::AlreadyMarkedDanger
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
        let sentinel_vote = &ctx.accounts.sentinel_vote;
        let token_analysis = &ctx.accounts.token_analysis;
        let protocol = &ctx.accounts.protocol;

        require!(token_analysis.is_rugged, SentryError::NotRugged);
        require!(sentinel_vote.verdict == Verdict::Safe, SentryError::VotedCorrectly);
        require!(!sentinel_vote.is_slashed, SentryError::AlreadySlashed);

        let slash_amount = (sentinel_vote.stake_at_vote * protocol.slash_percent as u64) / 100;
        
        sentinel.stake = sentinel.stake.saturating_sub(slash_amount);
        sentinel.reputation = sentinel.reputation.saturating_sub(20);
        sentinel.total_verdicts += 1;

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

    /// Reward sentinels who voted correctly (DANGER on rugged, or SAFE on verified safe)
    pub fn reward_sentinel(ctx: Context<RewardSentinel>) -> Result<()> {
        let sentinel = &mut ctx.accounts.sentinel;
        let sentinel_vote = &ctx.accounts.sentinel_vote;
        let token_analysis = &ctx.accounts.token_analysis;

        require!(token_analysis.is_finalized, SentryError::NotFinalized);
        require!(!sentinel_vote.is_rewarded, SentryError::AlreadyRewarded);

        let correct = if token_analysis.is_rugged {
            sentinel_vote.verdict == Verdict::Danger
        } else {
            sentinel_vote.verdict == token_analysis.final_verdict
        };

        require!(correct, SentryError::VotedIncorrectly);

        sentinel.correct_verdicts += 1;
        sentinel.total_verdicts += 1;
        sentinel.reputation = std::cmp::min(sentinel.reputation + 5, 200);

        // If rug, distribute from slash pool
        if token_analysis.is_rugged && token_analysis.slash_pool > 0 {
            let reward = token_analysis.slash_pool / token_analysis.danger_votes;
            sentinel.stake += reward;
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
        seeds = [b"protocol"],
        bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterSentinel<'info> {
    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
    #[account(
        init,
        payer = authority,
        space = 8 + Sentinel::SPACE,
        seeds = [b"sentinel", authority.key().as_ref()],
        bump
    )]
    pub sentinel: Account<'info, Sentinel>,
    /// CHECK: Stake account holding SOL
    #[account(mut)]
    pub stake: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token_mint: Pubkey)]
pub struct SubmitVerdict<'info> {
    #[account(
        seeds = [b"protocol"],
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
        seeds = [b"protocol"],
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
        seeds = [b"protocol"],
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
        seeds = [b"protocol"],
        bump = protocol.bump
    )]
    pub protocol: Account<'info, Protocol>,
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
}

#[derive(Accounts)]
pub struct RewardSentinel<'info> {
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
}

// === STATE ===

#[account]
pub struct Protocol {
    pub admin: Pubkey,
    pub min_stake: u64,        // Minimum SOL to stake (lamports)
    pub verdict_window: u32,   // Seconds to submit verdicts
    pub quorum: u16,           // Minimum votes for consensus
    pub slash_percent: u8,     // % to slash on wrong verdict
    pub total_agents: u64,
    pub total_verdicts: u64,
    pub bump: u8,
}

impl Protocol {
    pub const SPACE: usize = 32 + 8 + 4 + 2 + 1 + 8 + 8 + 1;
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
    pub verdict_window: u32,
    pub quorum: u16,
    pub slash_percent: u8,
}

// === ERRORS ===

#[error_code]
pub enum SentryError {
    #[msg("Insufficient stake amount")]
    InsufficientStake,
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
