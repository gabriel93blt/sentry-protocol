import { Program, AnchorProvider, web3, BN, Idl } from '@coral-xyz/anchor';
import { PublicKey, Connection, Keypair, SystemProgram } from '@solana/web3.js';

// IDL will be generated after anchor build
// For now, define types manually

export enum Verdict {
  Safe = 'safe',
  Danger = 'danger',
}

export interface ProtocolConfig {
  minStake: BN;
  verdictWindow: number;
  quorum: number;
  slashPercent: number;
}

export interface Sentinel {
  authority: PublicKey;
  stake: BN;
  reputation: number;
  correctVerdicts: BN;
  totalVerdicts: BN;
  isActive: boolean;
  registeredAt: BN;
}

export interface TokenAnalysis {
  tokenMint: PublicKey;
  createdAt: BN;
  finalizedAt: BN;
  totalVotes: BN;
  safeVotes: BN;
  dangerVotes: BN;
  safeStake: BN;
  dangerStake: BN;
  finalVerdict: Verdict;
  consensusConfidence: number;
  isFinalized: boolean;
  isRugged: boolean;
  rugEvidence: number[];
  rugReportedAt: BN;
  slashPool: BN;
}

export interface SentinelVote {
  sentinel: PublicKey;
  tokenMint: PublicKey;
  verdict: Verdict;
  confidence: number;
  stakeAtVote: BN;
  submittedAt: BN;
  isSlashed: boolean;
  isRewarded: boolean;
}

export class SentrySDK {
  private connection: Connection;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    programId: PublicKey = new PublicKey('2f438Z16QoVnArKRhN3P6oJysen1aimVnnr7vS5nTPaY')
  ) {
    this.connection = connection;
    this.programId = programId;
  }

  // === PDA Derivations ===

  getProtocolPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('protocol')],
      this.programId
    );
  }

  getSentinelPDA(authority: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('sentinel'), authority.toBuffer()],
      this.programId
    );
  }

  getTokenAnalysisPDA(tokenMint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('analysis'), tokenMint.toBuffer()],
      this.programId
    );
  }

  getSentinelVotePDA(tokenMint: PublicKey, sentinel: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vote'), tokenMint.toBuffer(), sentinel.toBuffer()],
      this.programId
    );
  }

  // === Account Fetchers ===

  async getProtocol(): Promise<any> {
    const [pda] = this.getProtocolPDA();
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;
    // Deserialize based on IDL structure
    return this.deserializeProtocol(accountInfo.data);
  }

  async getSentinel(authority: PublicKey): Promise<Sentinel | null> {
    const [pda] = this.getSentinelPDA(authority);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;
    return this.deserializeSentinel(accountInfo.data);
  }

  async getTokenAnalysis(tokenMint: PublicKey): Promise<TokenAnalysis | null> {
    const [pda] = this.getTokenAnalysisPDA(tokenMint);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;
    return this.deserializeTokenAnalysis(accountInfo.data);
  }

  async getSentinelVote(tokenMint: PublicKey, sentinel: PublicKey): Promise<SentinelVote | null> {
    const [pda] = this.getSentinelVotePDA(tokenMint, sentinel);
    const accountInfo = await this.connection.getAccountInfo(pda);
    if (!accountInfo) return null;
    return this.deserializeSentinelVote(accountInfo.data);
  }

  // === Instruction Builders ===

  buildInitializeIx(
    admin: PublicKey,
    config: ProtocolConfig
  ): web3.TransactionInstruction {
    const [protocolPDA] = this.getProtocolPDA();
    
    // Anchor instruction discriminator for 'initialize'
    const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
    
    const data = Buffer.concat([
      discriminator,
      config.minStake.toArrayLike(Buffer, 'le', 8),
      Buffer.from(new Uint32Array([config.verdictWindow]).buffer),
      Buffer.from(new Uint16Array([config.quorum]).buffer),
      Buffer.from([config.slashPercent]),
    ]);

    return new web3.TransactionInstruction({
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: true },
        { pubkey: admin, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });
  }

  buildRegisterSentinelIx(
    authority: PublicKey,
    stakeAccount: PublicKey
  ): web3.TransactionInstruction {
    const [protocolPDA] = this.getProtocolPDA();
    const [sentinelPDA] = this.getSentinelPDA(authority);

    const discriminator = Buffer.from([39, 166, 167, 127, 95, 106, 173, 89]);

    return new web3.TransactionInstruction({
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: true },
        { pubkey: sentinelPDA, isSigner: false, isWritable: true },
        { pubkey: stakeAccount, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: discriminator,
    });
  }

  buildSubmitVerdictIx(
    authority: PublicKey,
    tokenMint: PublicKey,
    verdict: Verdict,
    confidence: number
  ): web3.TransactionInstruction {
    const [protocolPDA] = this.getProtocolPDA();
    const [sentinelPDA] = this.getSentinelPDA(authority);
    const [tokenAnalysisPDA] = this.getTokenAnalysisPDA(tokenMint);
    const [votePDA] = this.getSentinelVotePDA(tokenMint, authority);

    const discriminator = Buffer.from([227, 110, 155, 23, 136, 126, 172, 25]);
    
    const verdictByte = verdict === Verdict.Safe ? 0 : 1;
    const data = Buffer.concat([
      discriminator,
      tokenMint.toBuffer(),
      Buffer.from([verdictByte]),
      Buffer.from([confidence]),
    ]);

    return new web3.TransactionInstruction({
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: false },
        { pubkey: sentinelPDA, isSigner: false, isWritable: true },
        { pubkey: tokenAnalysisPDA, isSigner: false, isWritable: true },
        { pubkey: votePDA, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });
  }

  buildFinalizeConsensusIx(tokenMint: PublicKey): web3.TransactionInstruction {
    const [protocolPDA] = this.getProtocolPDA();
    const [tokenAnalysisPDA] = this.getTokenAnalysisPDA(tokenMint);

    const discriminator = Buffer.from([51, 241, 199, 62, 87, 253, 9, 163]);

    return new web3.TransactionInstruction({
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: false },
        { pubkey: tokenAnalysisPDA, isSigner: false, isWritable: true },
      ],
      programId: this.programId,
      data: discriminator,
    });
  }

  buildReportRugIx(
    reporter: PublicKey,
    tokenMint: PublicKey,
    evidenceHash: Buffer
  ): web3.TransactionInstruction {
    const [protocolPDA] = this.getProtocolPDA();
    const [tokenAnalysisPDA] = this.getTokenAnalysisPDA(tokenMint);

    const discriminator = Buffer.from([154, 43, 92, 186, 67, 21, 199, 88]);
    const data = Buffer.concat([discriminator, evidenceHash]);

    return new web3.TransactionInstruction({
      keys: [
        { pubkey: protocolPDA, isSigner: false, isWritable: false },
        { pubkey: tokenAnalysisPDA, isSigner: false, isWritable: true },
        { pubkey: reporter, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data,
    });
  }

  // === Helpers ===

  private deserializeProtocol(data: Buffer): any {
    // Skip 8-byte discriminator
    const offset = 8;
    return {
      admin: new PublicKey(data.subarray(offset, offset + 32)),
      minStake: new BN(data.subarray(offset + 32, offset + 40), 'le'),
      verdictWindow: data.readUInt32LE(offset + 40),
      quorum: data.readUInt16LE(offset + 44),
      slashPercent: data[offset + 46],
      totalAgents: new BN(data.subarray(offset + 47, offset + 55), 'le'),
      totalVerdicts: new BN(data.subarray(offset + 55, offset + 63), 'le'),
    };
  }

  private deserializeSentinel(data: Buffer): Sentinel {
    const offset = 8;
    return {
      authority: new PublicKey(data.subarray(offset, offset + 32)),
      stake: new BN(data.subarray(offset + 32, offset + 40), 'le'),
      reputation: data.readUInt16LE(offset + 40),
      correctVerdicts: new BN(data.subarray(offset + 42, offset + 50), 'le'),
      totalVerdicts: new BN(data.subarray(offset + 50, offset + 58), 'le'),
      isActive: data[offset + 58] === 1,
      registeredAt: new BN(data.subarray(offset + 59, offset + 67), 'le'),
    };
  }

  private deserializeTokenAnalysis(data: Buffer): TokenAnalysis {
    const offset = 8;
    return {
      tokenMint: new PublicKey(data.subarray(offset, offset + 32)),
      createdAt: new BN(data.subarray(offset + 32, offset + 40), 'le'),
      finalizedAt: new BN(data.subarray(offset + 40, offset + 48), 'le'),
      totalVotes: new BN(data.subarray(offset + 48, offset + 56), 'le'),
      safeVotes: new BN(data.subarray(offset + 56, offset + 64), 'le'),
      dangerVotes: new BN(data.subarray(offset + 64, offset + 72), 'le'),
      safeStake: new BN(data.subarray(offset + 72, offset + 80), 'le'),
      dangerStake: new BN(data.subarray(offset + 80, offset + 88), 'le'),
      finalVerdict: data[offset + 88] === 0 ? Verdict.Safe : Verdict.Danger,
      consensusConfidence: data[offset + 89],
      isFinalized: data[offset + 90] === 1,
      isRugged: data[offset + 91] === 1,
      rugEvidence: Array.from(data.subarray(offset + 92, offset + 124)),
      rugReportedAt: new BN(data.subarray(offset + 124, offset + 132), 'le'),
      slashPool: new BN(data.subarray(offset + 132, offset + 140), 'le'),
    };
  }

  private deserializeSentinelVote(data: Buffer): SentinelVote {
    const offset = 8;
    return {
      sentinel: new PublicKey(data.subarray(offset, offset + 32)),
      tokenMint: new PublicKey(data.subarray(offset + 32, offset + 64)),
      verdict: data[offset + 64] === 0 ? Verdict.Safe : Verdict.Danger,
      confidence: data[offset + 65],
      stakeAtVote: new BN(data.subarray(offset + 66, offset + 74), 'le'),
      submittedAt: new BN(data.subarray(offset + 74, offset + 82), 'le'),
      isSlashed: data[offset + 82] === 1,
      isRewarded: data[offset + 83] === 1,
    };
  }
}

export default SentrySDK;
