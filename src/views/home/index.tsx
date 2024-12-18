// Next, React
import { FC } from 'react';

// Wallet
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

// Components
import WeakHandsInterface from '../../components/ui/weakhands-ui';

export const HomeView: FC = ({ }) => {
  return (
    <div className="md:w-full md:max-w-3xl mx-auto">
      <WeakHandsInterface />
    </div>
  );
};
