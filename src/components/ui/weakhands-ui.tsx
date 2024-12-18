import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from './ui-components';
import { Loader2, XCircle, CheckCircle2, ExternalLink } from 'lucide-react';

const PROGRAM_ID = new PublicKey('DR85urM1zGQhEA5b9MorTjC3FyTacXEgPY9jfmnMt9JX');

const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

const WITHDRAW_DISCRIMINATOR = Buffer.from([183, 18, 70, 156, 148, 109, 161, 34]);

type TransactionStatus = {
  signature?: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  error?: string;
  action: string;
};

const findLockAccountPDA = async (userPubkey: PublicKey): Promise<[PublicKey, number]> => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lock_account"), userPubkey.toBuffer()],
    PROGRAM_ID
  );
};

const createDepositInstruction = async (
  amount: number,
  userPubkey: PublicKey,
): Promise<TransactionInstruction> => {
  const [lockAccountPDA] = await findLockAccountPDA(userPubkey);
  
  const data = Buffer.concat([
    DEPOSIT_DISCRIMINATOR,
    new anchor.BN(amount).toArrayLike(Buffer, 'le', 8)
  ]);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: lockAccountPDA, isSigner: false, isWritable: true }, // lock_account
      { pubkey: userPubkey, isSigner: true, isWritable: true }, // user
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: PROGRAM_ID,
    data,
  });
};

const createWithdrawInstruction = async (
  amount: number,
  userPubkey: PublicKey,
): Promise<TransactionInstruction> => {
  const [lockAccountPDA] = await findLockAccountPDA(userPubkey);

  const data = Buffer.concat([
    WITHDRAW_DISCRIMINATOR,
    new anchor.BN(amount).toArrayLike(Buffer, 'le', 8)
  ]);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: lockAccountPDA, isSigner: false, isWritable: true }, // lock_account
      { pubkey: userPubkey, isSigner: true, isWritable: true }, // user
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: PROGRAM_ID,
    data,
  });
};

export default function WeakHandsInterface(): JSX.Element {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  
  const [depositAmount, setDepositAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [txStatus, setTxStatus] = useState<TransactionStatus>({
    status: 'idle',
    action: ''
  });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [weakHandsBalance, setWeakHandsBalance] = useState(0);

  useEffect(() => {
    async function getBalance() {
      if (!publicKey) return;
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    }

    getBalance();
  }, [publicKey, connection]);

  async function handleDeposit() {
    if (!publicKey || !signTransaction) return;
    
    try {
      setTxStatus({ status: 'pending', action: 'deposit' });
      
      const transaction = new Transaction();
      const lamports = Math.floor(parseFloat(depositAmount) * LAMPORTS_PER_SOL);

      const depositIx = await createDepositInstruction(
        lamports,
        publicKey,
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      transaction.add(depositIx);
      
      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      await connection.confirmTransaction(signature);
      
      setDepositAmount('');
      const newBalance = await connection.getBalance(publicKey);
      setBalance(newBalance / LAMPORTS_PER_SOL);
      
      setTxStatus({
        status: 'success',
        signature,
        action: 'deposit'
      });
      
    } catch (err) {
      setTxStatus({
        status: 'error',
        error: err instanceof Error ? err.message : 'An unknown error occurred',
        action: 'deposit'
      });
    }
  }

  async function handleWithdraw() {
    if (!publicKey || !signTransaction) return;
    
    try {
      setTxStatus({ status: 'pending', action: 'withdraw' });
      
      const transaction = new Transaction();
      const lamports = Math.floor(parseFloat(withdrawAmount) * LAMPORTS_PER_SOL);
      
      const withdrawIx = await createWithdrawInstruction(
        lamports,
        publicKey,
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      
      transaction.add(withdrawIx);
      
      const signedTx = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());
      
      await connection.confirmTransaction(signature);

      setWithdrawAmount('');
      const newBalance = await connection.getBalance(publicKey);
      setBalance(newBalance / LAMPORTS_PER_SOL);
      
      setTxStatus({
        status: 'success',
        signature,
        action: 'withdraw'
      });
      
    } catch (err) {
      setTxStatus({
        status: 'error',
        error: err instanceof Error ? err.message : 'An unknown error occurred',
        action: 'withdraw'
      });
    }
  }

  const TransactionAlert = () => {
    if (txStatus.status === 'idle') return null;

    const baseStyle = "px-4 py-3 rounded relative flex items-center gap-2 mb-4";
    const getStyle = () => {
      switch (txStatus.status) {
        case 'pending':
          return `${baseStyle} bg-yellow-100 border border-yellow-400 text-yellow-700`;
        case 'success':
          return `${baseStyle} bg-green-100 border border-green-400 text-green-700`;
        case 'error':
          return `${baseStyle} bg-red-100 border border-red-400 text-red-700`;
        default:
          return baseStyle;
      }
    };

    return (
      <div className={getStyle()}>
        {txStatus.status === 'pending' && (
          <>
            <Loader2 className="animate-spin" />
            <span>Transaction pending...</span>
          </>
        )}
        {txStatus.status === 'success' && (
          <>
            <CheckCircle2 className="text-green-500" />
            <span>Transaction successful!</span>
            {txStatus.signature && (
              <a 
                href={`https://explorer.solana.com/tx/${txStatus.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 underline"
              >
                View on Explorer <ExternalLink size={16} />
              </a>
            )}
          </>
        )}
        {txStatus.status === 'error' && (
          <>
            <XCircle className="text-red-500" />
            <span>{txStatus.error}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="text-lg font-medium flex justify-between items-center">
        <span>{connected ? `Connected: ${publicKey?.toBase58()}` : 'Not Connected'}</span>
        <WalletMultiButton />
      </div>

      <TransactionAlert />

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Deposit SOL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>Available: {balance.toFixed(4)} SOL</div>
            <Input
              type="number"
              placeholder="Amount in SOL"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
            />
            <Button 
              className="w-full"
              onClick={handleDeposit}
              disabled={(!depositAmount && connected) || txStatus.status === 'pending'}
            >
              {txStatus.status === 'pending' ? 'Confirming...' : 'Deposit'}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Withdraw SOL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>Available: {weakHandsBalance.toFixed(4)} SOL</div>
            <Input
              type="number"
              placeholder="Amount in SOL"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
            <Button 
              className="w-full"
              onClick={handleWithdraw}
              disabled={(!withdrawAmount && connected) || txStatus.status === 'pending'}
            >
              {txStatus.status === 'pending' ? 'Confirming...' : 'Withdraw'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
