import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SentrySDK, Verdict } from '../src/index';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BN } from '@coral-xyz/anchor';

async function main() {
  // Load keypair
  const home = os.homedir();
  const keypairPath = path.join(home, '.config/solana/sentry-dev.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(new Uint8Array(keypairData));

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const sdk = new SentrySDK(connection);

  console.log('Initializing Protocol...');
  console.log('Admin:', admin.publicKey.toBase58());

  try {
    const ix = sdk.buildInitializeIx(admin.publicKey, {
      minStake: new BN(1_000_000_000), // 1 SOL
      verdictWindow: 300, // 5 min
      quorum: 1, // 1 for dev/testing
      slashPercent: 50
    });

    const tx = new web3.Transaction().add(ix);
    const sig = await web3.sendAndConfirmTransaction(connection, tx, [admin]);
    
    console.log('Protocol initialized!');
    console.log('Signature:', sig);
  } catch (e) {
    console.error('Error initializing protocol:', e);
  }
}

// We need web3 globally or imported
import { web3 } from '@coral-xyz/anchor';

main().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
