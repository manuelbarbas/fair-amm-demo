import { parseUnits, formatUnits } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { ERC20_ABI } from "../../../abi/ERC20";
import { UNISWAP_V2_ROUTER_ABI } from "../../../abi/UniswapV2Router";
import { readContract, writeContract } from "../../../shared/web3/requests";

export interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  name: string;
}

export interface SwapQuote {
  amountOut: bigint;
  minimumAmountOut: bigint;
  priceImpact?: number;
}

export class SwapService {
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
   * Get swap quote from router
   */
  async getSwapQuote(
    amountIn: string,
    fromToken: Token,
    toToken: Token,
    routerAddress: `0x${string}`,
    slippagePercent: number = 1
  ): Promise<SwapQuote | null> {
    try {
      const amountInWei = parseUnits(amountIn, fromToken.decimals);
      const amountsOut = (await readContract(
        this.publicClient,
        UNISWAP_V2_ROUTER_ABI,
        routerAddress,
        "getAmountsOut",
        [amountInWei, [fromToken.address, toToken.address]]
      )) as readonly bigint[];

      if (amountsOut.length < 2) {
        return null;
      }

      const amountOut = amountsOut[1];
      const slippageMultiplier = (100 - slippagePercent) / 100;
      const minimumAmountOut = parseUnits(
        (parseFloat(formatUnits(amountOut, toToken.decimals)) * slippageMultiplier).toString(),
        toToken.decimals
      );

      return {
        amountOut,
        minimumAmountOut,
        priceImpact: 0, // Could calculate price impact here if needed
      };
    } catch (error) {
      console.error("Error getting swap quote:", error);
      return null;
    }
  }

  /**
   * Approve token spending
   */
  async approveToken(
    tokenAddress: `0x${string}`,
    spenderAddress: `0x${string}`,
    amount: bigint,
    isBite:boolean
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
   * Execute token swap
   */
  async executeSwap(
    amountIn: bigint,
    minimumAmountOut: bigint,
    fromToken: Token,
    toToken: Token,
    routerAddress: `0x${string}`,
    userAddress: `0x${string}`,
    deadlineMinutes: number = 20,
    isBite:boolean
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
        "swapExactTokensForTokens",
        [
          amountIn,
          minimumAmountOut,
          [fromToken.address, toToken.address],
          userAddress,
          deadline,
        ],
        isBite
      );
      return txHash;
    } catch (error) {
      console.error("Error executing swap:", error);
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
}

// Helper function to create SwapService instance
export const createSwapService = (
  publicClient: PublicClient,
  walletClient?: WalletClient
) => {
  return new SwapService(publicClient, walletClient);
};
