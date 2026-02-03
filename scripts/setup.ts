import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import { Sentry } from '../target/types/sentry';

async function main() {
  const connection = new anchor.web3.Connection('https://api.devnet.solana.com');
  const homeDir = os.homedir();
  const keypairPath = `${homeDir}/.config/solana/sentry-dev.json`;
  const wallet = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')))
  );

  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(wallet), {});
  anchor.setProvider(provider);

  const idl = JSON.parse(fs.readFileSync('./target/idl/sentry.json', 'utf8')) as Sentry;
  // The program ID from the IDL's metadata will be used by the constructor.
  const program = new Program<Sentry>(idl, provider);

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('protocol')],
    program.programId
  );

  console.log('Checking protocol initialization...');
  console.log('Using program:', program.programId.toBase58());
  console.log('Admin wallet:', wallet.publicKey.toBase58());

  try {
    const account = await program.account.protocol.fetch(protocolPda);
    console.log('Protocol already initialized by:', account.admin.toBase58());
    console.log('Minimum Stake:', account.minStake.toString());
    console.log('Verdict Window:', account.verdictWindow);
  } catch (e) {
    console.log('Protocol not found. Initializing...');
    const tx = await (program.methods as any)
      .initialize({
        minStake: new anchor.BN(0.1 * LAMPORTS_PER_SOL), // 0.1 SOL for devnet
        verdictWindow: 120, // 2 minutes
        quorum: 1,
        slashPercent: 50,
      })
      .accounts({
        protocol: protocolPda,
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log('Protocol initialized! Tx:', tx);
    
    await provider.connection.confirmTransaction(tx);

    const account = await program.account.protocol.fetch(protocolPda);
    console.log('Initialization complete. Details:');
    console.log(' - Admin:', account.admin.toBase58());
    console.log(' - Min Stake:', account.minStake.toString());
  }
}

main().catch(console.error);
