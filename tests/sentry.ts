import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Sentry } from '../target/types/sentry';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { assert } from 'chai';

describe('sentry', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Sentry as Program<Sentry>;

  let protocolPda: PublicKey;
  let sentinelPda: PublicKey;
  let tokenAnalysisPda: PublicKey;
  let votePda: PublicKey;

  const admin = provider.wallet;
  const sentinelUser = anchor.web3.Keypair.generate();
  const tokenMint = anchor.web3.Keypair.generate().publicKey;

  it('Is initialized!', async () => {
    [protocolPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('protocol')],
      program.programId
    );

    await (program.methods as any)
      .initialize({
        minStake: new anchor.BN(1 * LAMPORTS_PER_SOL),
        verdictWindow: 5, // 5 seconds for test
        quorum: 1,
        slashPercent: 50,
      })
      .accounts({
        protocol: protocolPda,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.protocol.fetch(protocolPda);
    assert.ok(account.admin.equals(admin.publicKey));
  });

  it('Registers a sentinel', async () => {
    // Airdrop to sentinel
    const signature = await provider.connection.requestAirdrop(
      sentinelUser.publicKey,
      5 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    [sentinelPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('sentinel'), sentinelUser.publicKey.toBuffer()],
      program.programId
    );

    await (program.methods as any)
      .registerSentinel()
      .accounts({
        protocol: protocolPda,
        sentinel: sentinelPda,
        stake: sentinelUser.publicKey, // Staking from own wallet
        authority: sentinelUser.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sentinelUser])
      .rpc();

    const account = await program.account.sentinel.fetch(sentinelPda);
    assert.ok(account.stake.gte(new anchor.BN(1 * LAMPORTS_PER_SOL)));
    assert.ok(account.isActive);
  });

  it('Submits a verdict', async () => {
    [tokenAnalysisPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('analysis'), tokenMint.toBuffer()],
      program.programId
    );

    [votePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), tokenMint.toBuffer(), sentinelUser.publicKey.toBuffer()],
      program.programId
    );

    await (program.methods as any)
      .submitVerdict(tokenMint, { safe: {} }, 90)
      .accounts({
        protocol: protocolPda,
        sentinel: sentinelPda,
        tokenAnalysis: tokenAnalysisPda,
        sentinelVote: votePda,
        authority: sentinelUser.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sentinelUser])
      .rpc();

    const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
    assert.ok(analysis.safeVotes.toNumber() === 1);
  });

  it('Finalizes consensus', async () => {
    // Wait for window to close (5s)
    await new Promise((resolve) => setTimeout(resolve, 6000));

    await (program.methods as any)
      .finalizeConsensus()
      .accounts({
        protocol: protocolPda,
        tokenAnalysis: tokenAnalysisPda,
      })
      .rpc();

    const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
    assert.ok(analysis.isFinalized);
    assert.deepEqual(analysis.finalVerdict, { safe: {} });
  });

  it('Reports a rug (Admin only)', async () => {
    const evidenceHash = Array(32).fill(0);
    
    await (program.methods as any)
      .reportRug(evidenceHash)
      .accounts({
        protocol: protocolPda,
        tokenAnalysis: tokenAnalysisPda,
        reporter: admin.publicKey, // Must be admin
      })
      .rpc();

    const analysis = await program.account.tokenAnalysis.fetch(tokenAnalysisPda);
    assert.ok(analysis.isRugged);
  });
});
