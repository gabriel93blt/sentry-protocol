"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SentrySDK = exports.Verdict = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
// IDL will be generated after anchor build
// For now, define types manually
var Verdict;
(function (Verdict) {
    Verdict["Safe"] = "safe";
    Verdict["Danger"] = "danger";
})(Verdict || (exports.Verdict = Verdict = {}));
class SentrySDK {
    constructor(connection, programId = new web3_js_1.PublicKey('EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm')) {
        this.connection = connection;
        this.programId = programId;
    }
    // === PDA Derivations ===
    getProtocolPDA() {
        return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('protocol')], this.programId);
    }
    getSentinelPDA(authority) {
        return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('sentinel'), authority.toBuffer()], this.programId);
    }
    getTokenAnalysisPDA(tokenMint) {
        return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('analysis'), tokenMint.toBuffer()], this.programId);
    }
    getSentinelVotePDA(tokenMint, sentinel) {
        return web3_js_1.PublicKey.findProgramAddressSync([Buffer.from('vote'), tokenMint.toBuffer(), sentinel.toBuffer()], this.programId);
    }
    // === Account Fetchers ===
    async getProtocol() {
        const [pda] = this.getProtocolPDA();
        const accountInfo = await this.connection.getAccountInfo(pda);
        if (!accountInfo)
            return null;
        // Deserialize based on IDL structure
        return this.deserializeProtocol(accountInfo.data);
    }
    async getSentinel(authority) {
        const [pda] = this.getSentinelPDA(authority);
        const accountInfo = await this.connection.getAccountInfo(pda);
        if (!accountInfo)
            return null;
        return this.deserializeSentinel(accountInfo.data);
    }
    async getTokenAnalysis(tokenMint) {
        const [pda] = this.getTokenAnalysisPDA(tokenMint);
        const accountInfo = await this.connection.getAccountInfo(pda);
        if (!accountInfo)
            return null;
        return this.deserializeTokenAnalysis(accountInfo.data);
    }
    async getSentinelVote(tokenMint, sentinel) {
        const [pda] = this.getSentinelVotePDA(tokenMint, sentinel);
        const accountInfo = await this.connection.getAccountInfo(pda);
        if (!accountInfo)
            return null;
        return this.deserializeSentinelVote(accountInfo.data);
    }
    // === Instruction Builders ===
    buildInitializeIx(admin, config) {
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
        return new anchor_1.web3.TransactionInstruction({
            keys: [
                { pubkey: protocolPDA, isSigner: false, isWritable: true },
                { pubkey: admin, isSigner: true, isWritable: true },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data,
        });
    }
    buildRegisterSentinelIx(authority, stakeAccount) {
        const [protocolPDA] = this.getProtocolPDA();
        const [sentinelPDA] = this.getSentinelPDA(authority);
        const discriminator = Buffer.from([39, 166, 167, 127, 95, 106, 173, 89]);
        return new anchor_1.web3.TransactionInstruction({
            keys: [
                { pubkey: protocolPDA, isSigner: false, isWritable: true },
                { pubkey: sentinelPDA, isSigner: false, isWritable: true },
                { pubkey: stakeAccount, isSigner: false, isWritable: true },
                { pubkey: authority, isSigner: true, isWritable: true },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: discriminator,
        });
    }
    buildSubmitVerdictIx(authority, tokenMint, verdict, confidence) {
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
        return new anchor_1.web3.TransactionInstruction({
            keys: [
                { pubkey: protocolPDA, isSigner: false, isWritable: false },
                { pubkey: sentinelPDA, isSigner: false, isWritable: true },
                { pubkey: tokenAnalysisPDA, isSigner: false, isWritable: true },
                { pubkey: votePDA, isSigner: false, isWritable: true },
                { pubkey: authority, isSigner: true, isWritable: true },
                { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data,
        });
    }
    buildFinalizeConsensusIx(tokenMint) {
        const [protocolPDA] = this.getProtocolPDA();
        const [tokenAnalysisPDA] = this.getTokenAnalysisPDA(tokenMint);
        const discriminator = Buffer.from([51, 241, 199, 62, 87, 253, 9, 163]);
        return new anchor_1.web3.TransactionInstruction({
            keys: [
                { pubkey: protocolPDA, isSigner: false, isWritable: false },
                { pubkey: tokenAnalysisPDA, isSigner: false, isWritable: true },
            ],
            programId: this.programId,
            data: discriminator,
        });
    }
    buildReportRugIx(reporter, tokenMint, evidenceHash) {
        const [protocolPDA] = this.getProtocolPDA();
        const [tokenAnalysisPDA] = this.getTokenAnalysisPDA(tokenMint);
        const discriminator = Buffer.from([154, 43, 92, 186, 67, 21, 199, 88]);
        const data = Buffer.concat([discriminator, evidenceHash]);
        return new anchor_1.web3.TransactionInstruction({
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
    deserializeProtocol(data) {
        // Skip 8-byte discriminator
        const offset = 8;
        return {
            admin: new web3_js_1.PublicKey(data.subarray(offset, offset + 32)),
            minStake: new anchor_1.BN(data.subarray(offset + 32, offset + 40), 'le'),
            verdictWindow: data.readUInt32LE(offset + 40),
            quorum: data.readUInt16LE(offset + 44),
            slashPercent: data[offset + 46],
            totalAgents: new anchor_1.BN(data.subarray(offset + 47, offset + 55), 'le'),
            totalVerdicts: new anchor_1.BN(data.subarray(offset + 55, offset + 63), 'le'),
        };
    }
    deserializeSentinel(data) {
        const offset = 8;
        return {
            authority: new web3_js_1.PublicKey(data.subarray(offset, offset + 32)),
            stake: new anchor_1.BN(data.subarray(offset + 32, offset + 40), 'le'),
            reputation: data.readUInt16LE(offset + 40),
            correctVerdicts: new anchor_1.BN(data.subarray(offset + 42, offset + 50), 'le'),
            totalVerdicts: new anchor_1.BN(data.subarray(offset + 50, offset + 58), 'le'),
            isActive: data[offset + 58] === 1,
            registeredAt: new anchor_1.BN(data.subarray(offset + 59, offset + 67), 'le'),
        };
    }
    deserializeTokenAnalysis(data) {
        const offset = 8;
        return {
            tokenMint: new web3_js_1.PublicKey(data.subarray(offset, offset + 32)),
            createdAt: new anchor_1.BN(data.subarray(offset + 32, offset + 40), 'le'),
            finalizedAt: new anchor_1.BN(data.subarray(offset + 40, offset + 48), 'le'),
            totalVotes: new anchor_1.BN(data.subarray(offset + 48, offset + 56), 'le'),
            safeVotes: new anchor_1.BN(data.subarray(offset + 56, offset + 64), 'le'),
            dangerVotes: new anchor_1.BN(data.subarray(offset + 64, offset + 72), 'le'),
            safeStake: new anchor_1.BN(data.subarray(offset + 72, offset + 80), 'le'),
            dangerStake: new anchor_1.BN(data.subarray(offset + 80, offset + 88), 'le'),
            finalVerdict: data[offset + 88] === 0 ? Verdict.Safe : Verdict.Danger,
            consensusConfidence: data[offset + 89],
            isFinalized: data[offset + 90] === 1,
            isRugged: data[offset + 91] === 1,
            rugEvidence: Array.from(data.subarray(offset + 92, offset + 124)),
            rugReportedAt: new anchor_1.BN(data.subarray(offset + 124, offset + 132), 'le'),
            slashPool: new anchor_1.BN(data.subarray(offset + 132, offset + 140), 'le'),
        };
    }
    deserializeSentinelVote(data) {
        const offset = 8;
        return {
            sentinel: new web3_js_1.PublicKey(data.subarray(offset, offset + 32)),
            tokenMint: new web3_js_1.PublicKey(data.subarray(offset + 32, offset + 64)),
            verdict: data[offset + 64] === 0 ? Verdict.Safe : Verdict.Danger,
            confidence: data[offset + 65],
            stakeAtVote: new anchor_1.BN(data.subarray(offset + 66, offset + 74), 'le'),
            submittedAt: new anchor_1.BN(data.subarray(offset + 74, offset + 82), 'le'),
            isSlashed: data[offset + 82] === 1,
            isRewarded: data[offset + 83] === 1,
        };
    }
}
exports.SentrySDK = SentrySDK;
exports.default = SentrySDK;
