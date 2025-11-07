import type { PublicClient } from 'viem';

// Browser compatibility fix for Smart Order Router
if (typeof global === 'undefined') {
  (window as any).global = globalThis;
}

/**
 * Creates a minimal ethers-compatible provider from a viem PublicClient.
 * This is used to allow SDKs that expect ethers (like the Uniswap Smart Order Router)
 * to work with a viem-based setup.
 */
export const createEthersProvider = (publicClient: PublicClient) => {
  return {
    _isProvider: true,
    call: async (transaction: { to: `0x${string}`; data: `0x${string}` }) => {
      try {
        const { data } = await publicClient.call({
          to: transaction.to,
          data: transaction.data,
        });
        return data ?? '0x';
      } catch (error) {
        console.error('Error in provider call:', error);
        return '0x';
      }
    },
    getBlockNumber: async () => {
      try {
        const blockNumber = await publicClient.getBlockNumber();
        return Number(blockNumber);
      } catch (error) {
        console.error('Error getting block number:', error);
        return 0;
      }
    },
    getNetwork: async () => {
      return {
        chainId: publicClient.chain!.id,
        name: publicClient.chain!.name,
      };
    },
    getGasPrice: async () => {
      try {
        return await publicClient.getGasPrice();
      } catch (error) {
        console.error('Error getting gas price:', error);
        return BigInt(0);
      }
    },
  };
};

