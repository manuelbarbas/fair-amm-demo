import type { PublicClient, WalletClient } from 'viem';
import { encodeFunctionData } from 'viem';
import { Token } from '@uniswap/sdk-core';
import { UNISWAP_V2_ROUTER_ABI } from '../../../abi/UniswapV2Router';
import { getRouter, getWETHAddress } from '../../../config/config';
import type { V2Quote } from '../quotes/V2QuoteService';

export interface V2SwapOptions {
  slippageTolerance: number; // percentage (e.g., 1 for 1%)
  deadline: number; // timestamp
  recipient: `0x${string}`;
  amountIn: bigint;
}

export class V2SwapService {
  constructor(
    private publicClient: PublicClient,
    private walletClient?: WalletClient
  ) {}

  /**
   * Execute a V2 swap directly through the V2 Router contract
   */
  async executeSwap(
    quote: V2Quote,
    options: V2SwapOptions,
    chainId: number
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required for swap execution');
    }

    const routerAddress = getRouter(chainId);
    if (!routerAddress) {
      throw new Error(`V2 router not found for chain ${chainId}`);
    }

    // Calculate minimum amount out based on slippage tolerance
    const amountOutMinimum = this.calculateAmountOutMinimum(
      quote.amountOut,
      options.slippageTolerance
    );

    // Determine if this is an ETH swap
    const isFromETH = this.isETHAddress(quote.path[0]);
    const isToETH = this.isETHAddress(quote.path[quote.path.length - 1]);

    let functionName: string;
    let args: any[];
    let value = 0n;

    if (isFromETH) {
      // ETH -> Token
      functionName = 'swapExactETHForTokens';
      args = [
        amountOutMinimum,
        quote.path,
        options.recipient,
        BigInt(options.deadline)
      ];
      value = options.amountIn;
    } else if (isToETH) {
      // Token -> ETH
      functionName = 'swapExactTokensForETH';
      args = [
        options.amountIn,
        amountOutMinimum,
        quote.path,
        options.recipient,
        BigInt(options.deadline)
      ];
    } else {
      // Token -> Token
      functionName = 'swapExactTokensForTokens';
      args = [
        options.amountIn,
        amountOutMinimum,
        quote.path,
        options.recipient,
        BigInt(options.deadline)
      ];
    }

    // Encode the transaction data
    const data = encodeFunctionData({
      abi: UNISWAP_V2_ROUTER_ABI,
      functionName,
      args,
    });

    // Execute the transaction
    const txHash = await this.walletClient.sendTransaction({
      account: this.walletClient.account!,
      to: routerAddress as `0x${string}`,
      data,
      value,
      chain: this.walletClient.chain,
    });

    return txHash;
  }

  /**
   * Calculate minimum amount out based on slippage tolerance
   */
  private calculateAmountOutMinimum(
    amountOut: bigint,
    slippageTolerance: number
  ): bigint {
    const slippageBips = BigInt(Math.floor(slippageTolerance * 100)); // Convert to basis points
    const slippageAmount = (amountOut * slippageBips) / 10000n;
    return amountOut - slippageAmount;
  }

  /**
   * Check if an address represents ETH (WETH address or zero address)
   */
  private isETHAddress(address: `0x${string}`): boolean {
    return address === '0x0000000000000000000000000000000000000000';
  }

  /**
   * Build the swap path for V2
   */
  static buildPath(
    tokenIn: Token,
    tokenOut: Token,
    chainId: number
  ): `0x${string}`[] | null {
    const isNative = (token: Token) =>
      token.address === '0x0000000000000000000000000000000000000000';

    if (isNative(tokenIn)) {
      // Native → Token: WETH → Token
      const wethAddress = getWETHAddress(chainId);
      if (!wethAddress) return null;

      if (tokenOut.address.toLowerCase() === wethAddress.toLowerCase()) {
        // Native → WETH (direct)
        return [wethAddress, tokenOut.address as `0x${string}`];
      } else {
        // Native → Token (via WETH)
        return [wethAddress, tokenOut.address as `0x${string}`];
      }
    } else if (isNative(tokenOut)) {
      // Token → Native: Token → WETH
      const wethAddress = getWETHAddress(chainId);
      if (!wethAddress) return null;
      return [tokenIn.address as `0x${string}`, wethAddress];
    } else {
      // Token → Token: direct path first, fallback to WETH routing
      const wethAddress = getWETHAddress(chainId);

      // Try direct path first
      if (tokenIn.address.toLowerCase() !== tokenOut.address.toLowerCase()) {
        // For now, use direct path. In production, you'd want to check if pair exists
        return [
          tokenIn.address as `0x${string}`,
          tokenOut.address as `0x${string}`,
        ];
      }
    }

    return null;
  }
}
