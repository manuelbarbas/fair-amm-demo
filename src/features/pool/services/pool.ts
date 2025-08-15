import { parseUnits, formatUnits } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { ERC20_ABI } from "../../../abi/ERC20";
import { UNISWAP_V2_ROUTER_ABI } from "../../../abi/UniswapV2Router";
import { readContract, writeContract } from "../../../hooks/useContracts";

export interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  name: string;
  chainId?: number;
}

export interface PoolQuote {
  amountA: bigint;
  amountB: bigint;
  liquidityAmount: bigint;
  share: number; // percentage of pool share
}

export interface LiquidityPosition {
  tokenA: Token;
  tokenB: Token;
  liquidity: bigint;
  poolAddress: `0x${string}`;
  feeTier: number;
}

export class PoolService {
  constructor(
    private publicClient: PublicClient,
    private walletClient?: WalletClient
  ) {}

  /**
   * Get token balance for a specific address
   */
  async getTokenBalance(
    tokenAddress: `0x${string}`,
    userAddress: `0x${string}`
  ): Promise<bigint> {
    try {
      const balance = (await readContract(
        this.publicClient,
        ERC20_ABI,
        tokenAddress,
        "balanceOf",
        [userAddress]
      )) as bigint;
      return balance;
    } catch (error) {
      console.error("Error fetching token balance:", error);
      return 0n;
    }
  }

  /**
   * Get token allowance for router
   */
  async getTokenAllowance(
    tokenAddress: `0x${string}`,
    userAddress: `0x${string}`,
    spenderAddress: `0x${string}`
  ): Promise<bigint> {
    try {
      const allowance = (await readContract(
        this.publicClient,
        ERC20_ABI,
        tokenAddress,
        "allowance",
        [userAddress, spenderAddress]
      )) as bigint;
      return allowance;
    } catch (error) {
      console.error("Error fetching token allowance:", error);
      return 0n;
    }
  }

  /**
   * Get liquidity quote for adding liquidity to an existing pool
   */
  async getLiquidityQuote(
    amountADesired: string,
    amountBDesired: string,
    tokenA: Token,
    tokenB: Token,
    routerAddress: `0x${string}`
  ): Promise<PoolQuote | null> {
    try {
      const amountAWei = parseUnits(amountADesired, tokenA.decimals);
      const amountBWei = parseUnits(amountBDesired, tokenB.decimals);

      // Get amounts that will actually be used (accounting for existing pool ratio)
      const quote = (await readContract(
        this.publicClient,
        UNISWAP_V2_ROUTER_ABI,
        routerAddress,
        "quote",
        [amountAWei, amountAWei, amountBWei] // This is simplified - in reality need pool reserves
      )) as bigint;

      return {
        amountA: amountAWei,
        amountB: quote,
        liquidityAmount: amountAWei + quote, // Simplified calculation
        share: 100, // This would be calculated based on existing pool liquidity
      };
    } catch (error) {
      console.error("Error getting liquidity quote:", error);
      return null;
    }
  }

  /**
   * Approve token spending for router
   */
  async approveToken(
    tokenAddress: `0x${string}`,
    spenderAddress: `0x${string}`,
    amount: bigint,
    isBite: boolean
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet client not available");
    }

    try {
      const txHash = await writeContract(
        this.walletClient,
        ERC20_ABI,
        tokenAddress,
        "approve",
        [spenderAddress, amount],
        isBite
      );
      return txHash;
    } catch (error) {
      console.error("Error approving token:", error);
      throw error;
    }
  }

  /**
   * Add liquidity to create or add to a pool
   * Automatically detects if native ETH is involved and uses the appropriate method
   */
  async addLiquidity(
    tokenA: Token,
    tokenB: Token,
    amountADesired: bigint,
    amountBDesired: bigint,
    amountAMin: bigint,
    amountBMin: bigint,
    routerAddress: `0x${string}`,
    userAddress: `0x${string}`,
    chainId: number,
    deadlineMinutes: number = 20,
    isBite: boolean
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet client not available");
    }

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

      // Check if either token is the wrapped native token
      const isTokenANative = this.isWrappedNativeToken(tokenA.symbol, chainId);
      const isTokenBNative = this.isWrappedNativeToken(tokenB.symbol, chainId);

      if (isTokenANative || isTokenBNative) {
        // Use addLiquidityETH for native token pairs
        const [token, amountTokenDesired, amountTokenMin, amountETHMin, ethValue] = isTokenANative 
          ? [tokenB, amountBDesired, amountBMin, amountAMin, amountADesired]
          : [tokenA, amountADesired, amountAMin, amountBMin, amountBDesired];

        const txHash = await writeContract(
          this.walletClient,
          UNISWAP_V2_ROUTER_ABI,
          routerAddress,
          "addLiquidityETH",
          [
            token.address,
            amountTokenDesired,
            amountTokenMin,
            amountETHMin,
            userAddress,
            deadline,
          ],
          isBite,
          ethValue 
        );
        return txHash;
      } else {
        // Use regular addLiquidity for ERC-20 to ERC-20 pairs
        const txHash = await writeContract(
          this.walletClient,
          UNISWAP_V2_ROUTER_ABI,
          routerAddress,
          "addLiquidity",
          [
            tokenA.address,
            tokenB.address,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            userAddress,
            deadline,
          ],
          isBite
        );
        return txHash;
      }
    } catch (error) {
      console.error("Error adding liquidity:", error);
      throw error;
    }
  }

  /**
   * Remove liquidity from a pool
   */
  async removeLiquidity(
    tokenA: Token,
    tokenB: Token,
    liquidity: bigint,
    amountAMin: bigint,
    amountBMin: bigint,
    routerAddress: `0x${string}`,
    userAddress: `0x${string}`,
    deadlineMinutes: number = 20,
    isBite: boolean
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error("Wallet client not available");
    }

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

      const txHash = await writeContract(
        this.walletClient,
        UNISWAP_V2_ROUTER_ABI,
        routerAddress,
        "removeLiquidity",
        [
          tokenA.address,
          tokenB.address,
          liquidity,
          amountAMin,
          amountBMin,
          userAddress,
          deadline,
        ],
        isBite
      );
      return txHash;
    } catch (error) {
      console.error("Error removing liquidity:", error);
      throw error;
    }
  }

  /**
   * Check if token needs approval
   */
  isApprovalNeeded(allowance: bigint, requiredAmount: bigint): boolean {
    return allowance < requiredAmount;
  }

  /**
   * Format token amount for display
   */
  formatTokenAmount(amount: bigint, decimals: number, precision: number = 2): string {
    const formatted = formatUnits(amount, decimals);
    return parseFloat(formatted).toFixed(precision);
  }

  /**
   * Calculate minimum amounts with slippage
   */
  calculateMinAmounts(
    amountA: bigint,
    amountB: bigint,
    slippagePercent: number = 1
  ): { amountAMin: bigint; amountBMin: bigint } {
    const slippageMultiplier = (100 - slippagePercent) / 100;
    
    const amountAMin = BigInt(Math.floor(Number(amountA) * slippageMultiplier));
    const amountBMin = BigInt(Math.floor(Number(amountB) * slippageMultiplier));

    return { amountAMin, amountBMin };
  }

  /**
   * Check if a token symbol represents a wrapped native token
   */
  isWrappedNativeToken(symbol: string, chainId: number): boolean {
    const wrappedNativeTokens = {
      1289306510: 'WBITE', // BITE Testnet
      1328435889: 'WFAIR', // FAIR Testnet
    };
    
    return wrappedNativeTokens[chainId as keyof typeof wrappedNativeTokens] === symbol;
  }
}

// Helper function to create PoolService instance
export const createPoolService = (
  publicClient: PublicClient,
  walletClient?: WalletClient
) => {
  return new PoolService(publicClient, walletClient);
};
