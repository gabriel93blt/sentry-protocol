import express from 'express';
import axios from 'axios';
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MOLTBOOK_API = process.env.MOLTBOOK_API || 'https://api.moltbook.com';
const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const PROGRAM_ID = new PublicKey('EPccz8vhrRpLK6w4WwPQn5aMC2Hh6onsD24qmtUVK1sm');

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new anchor.Wallet(anchor.web3.Keypair.generate());
const provider = new anchor.AnchorProvider(connection, wallet, {});
const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8'));
const program = new anchor.Program(idl, provider) as any;

// Middleware for error handling
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/health', (req, res) => {
    res.json({ status: 'operational', version: '1.2.0-fixed' });
});

app.get('/verify-agent/:wallet', asyncHandler(async (req: any, res: any) => {
    if (!MOLTBOOK_API_KEY) {
        return res.status(500).json({ error: 'API configuration missing' });
    }
    
    try {
        const moltResponse = await axios.get(`${MOLTBOOK_API}/agents/${req.params.wallet}`, {
            headers: { 'x-api-key': MOLTBOOK_API_KEY },
            timeout: 5000
        });
        res.json({ verified: !!moltResponse.data?.is_claimed });
    } catch (e: any) {
        if (e.code === 'ECONNABORTED') {
            return res.status(503).json({ error: 'Moltbook timeout' });
        }
        res.status(500).json({ error: 'Verification error', details: e.message });
    }
}));

app.get('/shield/:mint', asyncHandler(async (req: any, res: any) => {
    try {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('analysis'), new PublicKey(req.params.mint).toBuffer()], 
            PROGRAM_ID
        );
        const analysis = await program.account.tokenAnalysis.fetch(pda);
        
        // SECURITY: Only allow if finalized and explicitly safe
        const isSafe = analysis.isFinalized && analysis.finalVerdict.safe;
        res.json({ 
            mint: req.params.mint, 
            action: isSafe ? 'ALLOW' : 'VETO',
            finalized: analysis.isFinalized,
            verdict: analysis.finalVerdict
        });
    } catch (e) {
        // SECURITY FIX: Default to VETO if token not analyzed or any error
        res.json({ 
            mint: req.params.mint, 
            action: 'VETO',
            reason: 'Token not analyzed or error occurred'
        });
    }
}));

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`🛡️ SENTRY API v1.2.0 (BUGFIXED) running on port ${PORT}`);
});
