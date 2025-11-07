import type { PublicClient } from 'viem';
import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import { UNISWAP_V2_ROUTER_ABI } from '../../../abi/UniswapV2Router';
import { getRouter, getWETHAddress } from '../../../config/config';

export interface V2Quote {
  version: 'v2';
  amountOut: bigint;
  path: `0x${string}`[];
  gasEstimate: bigint;
  priceImpact: number;
}

export class V2QuoteService {
  constructor(private publicClient: PublicClient) {}

  async getQuote(
    amountIn: CurrencyAmount<Token>,
    tokenOut: Token,
    chainId: number
  ): Promise<V2Quote | null> {
    try {
      const routerAddress = getRouter(chainId);
      if (!routerAddress) {
        console.warn('V2 router not found for chain', chainId);
        return null;
      }

      const path = this.buildPath(amountIn.currency, tokenOut, chainId);
      if (!path || path.length < 2) {
        return null;
      }

      // Call getAmountsOut on V2 router
      const amounts = await this.publicClient.readContract({
        address: routerAddress,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: 'getAmountsOut',
        args: [BigInt(amountIn.quotient.toString()), path],
      }) as readonly bigint[];

      if (amounts.length < 2) {
        return null;
      }

      const amountOut = amounts[amounts.length - 1];
      
      // Simple gas estimate for V2 (actual gas will vary)
      const gasEstimate = BigInt(150000); // Typical V2 swap gas

      // Calculate simple price impact (more sophisticated calculation could be added)
      const priceImpact = this.calculatePriceImpact(amountIn, amountOut, tokenOut);

      return {
        version: 'v2',
        amountOut,
        path,
        gasEstimate,
        priceImpact,
      };
    } catch (error) {
      console.error('Error getting V2 quote:', error);
      return null;
    }
  }

  private buildPath(tokenIn: Token, tokenOut: Token, chainId: number): `0x${string}`[] | null {
    const isNative = (token: Token) => token.address === '0x0000000000000000000000000000000000000000';
    
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
        return [tokenIn.address as `0x${string}`, tokenOut.address as `0x${string}`];
      }
    }
    
    return null;
  }

  private calculatePriceImpact(
    amountIn: CurrencyAmount<Token>,
    amountOut: bigint,
    tokenOut: Token
  ): number {
    // Simplified price impact calculation
    // In production, you'd want to get reserve data and calculate properly
    return 0.1; // Placeholder 0.1% impact
  }
}
