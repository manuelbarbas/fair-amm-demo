import type { PublicClient, WalletClient } from 'viem';
import { TradeType } from '@uniswap/sdk-core';
import type { Currency, NativeCurrency } from '@uniswap/sdk-core';
import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import type { TokenConfig } from '../../../config/config';

// ============================================================================
// QUOTE INTERFACES
// ============================================================================

export interface V2Quote {
  version: 'v2';
  amountOut: bigint;
  path: `0x${string}`[];
  gasEstimate: bigint;
  priceImpact: number;
}

export interface V3Quote {
  version: 'v3';
  amountOut: bigint;
  fee: number;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  gasEstimate: bigint;
  priceImpact: number;
}


// Union type for all quote types
export type UnifiedQuote = V2Quote | V3Quote;

// ============================================================================
// SERVICE INTERFACES
// ============================================================================

export interface IUniswapService {
  getQuote(
    amount: CurrencyAmount<Currency>,
    toToken: Currency,
    tradeType?: TradeType
  ): Promise<BestQuoteResult | null>;

  executeSwap(
    quote: UnifiedQuote,
    options: UniversalSwapOptions
  ): Promise<`0x${string}`>;
}

// Result of a successful quote comparison
export interface BestQuoteResult {
  quote: UnifiedQuote;
  reason: string; // Why this quote was selected
}

// ============================================================================
// SWAP OPTIONS
// ============================================================================

// Swap options for the Universal Router
export interface UniversalSwapOptions {
  slippageTolerance: number; // percentage (e.g., 1 for 1%)
  deadline: number; // timestamp
  recipient: `0x${string}`;
  amountIn: bigint; // The input amount for the swap
}

// ============================================================================
// UNIVERSAL ROUTER INTERFACES
// ============================================================================

// Universal Router Command Types
export interface SwapExactInParams {
  recipient: `0x${string}`;
  amountIn: bigint;
  amountOutMinimum: bigint;
  path: `0x${string}`[];
  payer: `0x${string}`;
}

export interface SwapExactOutParams {
  recipient: `0x${string}`;
  amountOut: bigint;
  amountInMaximum: bigint;
  path: `0x${string}`[];
  payer: `0x${string}`;
}

export interface WrapETHParams {
  recipient: `0x${string}`;
  amountMin: bigint;
}

export interface UnwrapWETHParams {
  recipient: `0x${string}`;
  amountMin: bigint;
}

export interface SweepParams {
  token: `0x${string}`;
  recipient: `0x${string}`;
  amountMin: bigint;
}

// ============================================================================
// HOOK INTERFACES  
// ============================================================================

export interface UniversalRouterSwapParams {
  tokenIn: any; // TokenConfig from config
  tokenOut: any; // TokenConfig from config
  amountIn: string;
  amountOutMin: string;
  slippageTolerance: number;
  deadline?: number;
  useV3?: boolean; // Prefer V3 over V2
}

export interface UniversalRouterQuoteParams {
  tokenIn: any; // TokenConfig from config
  tokenOut: any; // TokenConfig from config
  amountIn: string;
  useV3?: boolean;
}

// ============================================================================
// QUOTE SERVICE INTERFACES
// ============================================================================

export interface IQuoteService<TQuote> {
  getQuote(
    amountIn: CurrencyAmount<Token>,
    tokenOut: Token,
    chainId: number
  ): Promise<TQuote | null>;
}

export interface IV2QuoteService extends IQuoteService<V2Quote> {}
export interface IV3QuoteService extends IQuoteService<V3Quote> {}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

export interface UniswapServiceConfig {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  chainId: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type QuoteVersion = 'v2' | 'v3';

export interface TransactionResult {
  calldata: string;
  value: bigint;
}
