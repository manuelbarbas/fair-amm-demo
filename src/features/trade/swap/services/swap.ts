import { parseUnits, formatUnits } from "viem";
import type { PublicClient, WalletClient } from "viem";
import { ERC20_ABI } from "../../../../abi/ERC20";
import { UNISWAP_V2_ROUTER_ABI } from "../../../../abi/UniswapV2Router";
import { readContract, writeContract } from "../../../../hooks/useContracts";
import { isNativeToken, getWETHAddress } from "../../../../config/config";
import { isNativeWrappedPair, type Token } from "../../../../utils/tokenUtils";

// Re-export Token interface for convenience
export type { Token } from "../../../../utils/tokenUtils";

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
   * Get token balance for a specific address (handles both native and ERC20 tokens)
   */
  async getTokenBalance(
    token: Token,
    userAddress: `0x${string}`
  ): Promise<bigint> {
    try {
      if (isNativeToken(token)) {
        // For native tokens, get ETH balance
        const balance = await this.publicClient.getBalance({ address: userAddress });
        return balance;
      } else {
        // For ERC20 tokens
        const balance = (await readContract(
          this.publicClient,
          ERC20_ABI,
          token.address,
          "balanceOf",
          [userAddress]
        )) as bigint;
        return balance;
      }
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
   * Get swap quote from router (handles native tokens using WETH for routing)
   */
  async getSwapQuote(
    amountIn: string,
    fromToken: Token,
    toToken: Token,
    routerAddress: `0x${string}`,
    chainId: number,
    slippagePercent: number = 1
  ): Promise<SwapQuote | null> {
    try {
      const amountInWei = parseUnits(amountIn, fromToken.decimals);
      
      // Special case: Native ↔ Wrapped token (1:1 ratio)
      if (isNativeWrappedPair(fromToken, toToken, chainId)) {
        const slippageMultiplier = (100 - slippagePercent) / 100;
        const minimumAmountOut = parseUnits(
          (parseFloat(formatUnits(amountInWei, fromToken.decimals)) * slippageMultiplier).toString(),
          toToken.decimals
        );
        
        return {
          amountOut: amountInWei, // 1:1 ratio
          minimumAmountOut,
          priceImpact: 0,
        };
      }
      
      // Build the path for routing
      let path: `0x${string}`[];
      
      if (isNativeToken(fromToken)) {
        // Native → Token: use WETH → Token path
        const wethAddress = getWETHAddress(chainId);
        if (!wethAddress) {
          console.error("WETH address not found for chain", chainId);
          return null;
        }
        path = [wethAddress, toToken.address];
      } else if (isNativeToken(toToken)) {
        // Token → Native: use Token → WETH path
        const wethAddress = getWETHAddress(chainId);
        if (!wethAddress) {
          console.error("WETH address not found for chain", chainId);
          return null;
        }
        path = [fromToken.address, wethAddress];
      } else {
        // Token → Token: direct path
        path = [fromToken.address, toToken.address];
      }

      const amountsOut = (await readContract(
        this.publicClient,
        UNISWAP_V2_ROUTER_ABI,
        routerAddress,
        "getAmountsOut",
        [amountInWei, path]
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
   * Execute swap (handles all three types: token→token, token→native, native→token)
   */
  async executeSwap(
    amountIn: bigint,
    minimumAmountOut: bigint,
    fromToken: Token,
    toToken: Token,
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
      // Special case: Native ↔ Wrapped token direct swap
      if (isNativeWrappedPair(fromToken, toToken, chainId)) {
        const wethAddress = getWETHAddress(chainId);
        if (!wethAddress) {
          throw new Error("WETH address not found for chain");
        }
        
        if (isNativeToken(fromToken)) {
          // FAIR → WFAIR: deposit native to get wrapped
          const txHash = await writeContract(
            this.walletClient,
            [
              {
                "inputs": [],
                "name": "deposit",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
              }
            ],
            wethAddress,
            "deposit",
            [],
            isBite,
            amountIn // Send native token as value
          );
          return txHash;
        } else {
          // WFAIR → FAIR: withdraw wrapped to get native
          const txHash = await writeContract(
            this.walletClient,
            [
              {
                "inputs": [
                  {
                    "internalType": "uint256",
                    "name": "wad",
                    "type": "uint256"
                  }
                ],
                "name": "withdraw",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
              }
            ],
            wethAddress,
            "withdraw",
            [amountIn],
            isBite
          );
          return txHash;
        }
      }
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);
      
      if (isNativeToken(fromToken) && !isNativeToken(toToken)) {
        // Native → Token: swapExactETHForTokens
        const wethAddress = getWETHAddress(chainId);
        if (!wethAddress) {
          throw new Error("WETH address not found for chain");
        }
        
        const txHash = await writeContract(
          this.walletClient,
          UNISWAP_V2_ROUTER_ABI,
          routerAddress,
          "swapExactETHForTokens",
          [
            minimumAmountOut,
            [wethAddress, toToken.address],
            userAddress,
            deadline,
          ],
          isBite,
          amountIn // Send native token as value
        );
        return txHash;
        
      } else if (!isNativeToken(fromToken) && isNativeToken(toToken)) {
        // Token → Native: swapExactTokensForETH
        const wethAddress = getWETHAddress(chainId);
        if (!wethAddress) {
          throw new Error("WETH address not found for chain");
        }
        
        const txHash = await writeContract(
          this.walletClient,
          UNISWAP_V2_ROUTER_ABI,
          routerAddress,
          "swapExactTokensForETH",
          [
            amountIn,
            minimumAmountOut,
            [fromToken.address, wethAddress],
            userAddress,
            deadline,
          ],
          isBite
        );
        return txHash;
        
      } else if (!isNativeToken(fromToken) && !isNativeToken(toToken)) {
        // Token → Token: swapExactTokensForTokens
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
        
      } else {
        // Native → Native (shouldn't happen, but handle gracefully)
        throw new Error("Cannot swap native token to itself");
      }
      
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
