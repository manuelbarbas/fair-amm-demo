import type { PublicClient } from 'viem';
import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import { getWETHAddress, getV3QuoterAddress } from '../../../config/config';
import { UNISWAP_V3_QUOTER_ABI } from '../../../abi/V3Quoter';

export interface V3Quote {
  version: 'v3';
  amountOut: bigint;
  fee: number;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  gasEstimate: bigint;
  priceImpact: number;
}

export class V3QuoteService {

  // Common fee tiers for V3
  private feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

  constructor(private publicClient: PublicClient) {}

  async getQuote(
    amountIn: CurrencyAmount<Token>,
    tokenOut: Token,
    chainId: number
  ): Promise<V3Quote | null> {
    const quoterAddress = getV3QuoterAddress(chainId);
    if (!quoterAddress) {
      console.warn('V3 quoter not available for chain', chainId);
      return null;
    }

    try {
      const { tokenInAddress, tokenOutAddress } = this.getTokenAddresses(
        amountIn.currency,
        tokenOut,
        chainId
      );

      if (!tokenInAddress || !tokenOutAddress) {
        return null;
      }

      // Try different fee tiers and get the best quote
      const quotes = await Promise.allSettled(
        this.feeTiers.map(fee => 
          this.getQuoteForFee(tokenInAddress, tokenOutAddress, fee, amountIn, quoterAddress)
        )
      );

      // Find the best quote (highest output amount)
      let bestQuote: V3Quote | null = null;
      
      quotes.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          if (!bestQuote || result.value.amountOut > bestQuote.amountOut) {
            bestQuote = result.value;
          }
        }
      });

      return bestQuote;
    } catch (error) {
      console.error('Error getting V3 quote:', error);
      return null;
    }
  }

  private async getQuoteForFee(
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    fee: number,
    amountIn: CurrencyAmount<Token>,
    quoterAddress: `0x${string}`
  ): Promise<V3Quote | null> {
    try {
      // QuoterV2 uses a struct parameter
      const quoteParams = {
        tokenIn,
        tokenOut,
        amountIn: BigInt(amountIn.quotient.toString()),
        fee,
        sqrtPriceLimitX96: BigInt(0) // No price limit
      };

      const result = await this.publicClient.readContract({
        address: quoterAddress,
        abi: UNISWAP_V3_QUOTER_ABI,
        functionName: 'quoteExactInputSingle',
        args: [quoteParams],
      }) as readonly [bigint, bigint, number, bigint]; // [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]

      const [amountOut, , , gasEstimate] = result;

      if (amountOut === BigInt(0)) {
        return null;
      }

      return {
        version: 'v3',
        amountOut,
        fee,
        tokenIn,
        tokenOut,
        gasEstimate: gasEstimate || BigInt(180000), // Use actual gas estimate from QuoterV2
        priceImpact: 0.15, // Placeholder - could be calculated with more sophisticated logic
      };
    } catch (error) {
      // This fee tier might not exist, that's okay
      console.debug(`V3 quote failed for fee ${fee}:`, error);
      return null;
    }
  }

  private getTokenAddresses(
    tokenIn: Token,
    tokenOut: Token,
    chainId: number
  ): { tokenInAddress: `0x${string}` | null; tokenOutAddress: `0x${string}` | null } {
    const isNative = (token: Token) => token.address === '0x0000000000000000000000000000000000000000';
    
    let tokenInAddress: `0x${string}` | null = null;
    let tokenOutAddress: `0x${string}` | null = null;

    if (isNative(tokenIn)) {
      // Use WETH for native token in V3
      tokenInAddress = getWETHAddress(chainId);
    } else {
      tokenInAddress = tokenIn.address as `0x${string}`;
    }

    if (isNative(tokenOut)) {
      // Use WETH for native token in V3
      tokenOutAddress = getWETHAddress(chainId);
    } else {
      tokenOutAddress = tokenOut.address as `0x${string}`;
    }

    return { tokenInAddress, tokenOutAddress };
  }
}
