import type { TokenConfig } from '../../../config/config';

// ============================================================================
// SHARED POOL TYPES
// ============================================================================

export interface PoolToken extends TokenConfig {
  chainId: number;
}

export interface BasePoolOptions {
  slippageTolerance: number; // percentage (e.g., 1 for 1%)
  deadline: number; // timestamp
  recipient: `0x${string}`;
}

// ============================================================================
// V2 POOL TYPES
// ============================================================================

export interface V2PoolCreationParams {
  tokenA: PoolToken;
  tokenB: PoolToken;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
}

export interface V2PoolQuote {
  version: 'v2';
  amountA: bigint;
  amountB: bigint;
  liquidityAmount: bigint;
  share: number; // percentage of pool share (100% for new pools)
  fee: 0.3; // V2 has fixed 0.3% fee
}

// ============================================================================
// V3 POOL TYPES
// ============================================================================

export type V3FeeTier = 100 | 500 | 3000 | 10000; // 0.01%, 0.05%, 0.3%, 1%

export interface V3PriceRange {
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96Lower: bigint;
  sqrtPriceX96Upper: bigint;
}

export interface V3FullRange {
  type: 'full';
}

export interface V3CustomRange {
  type: 'custom';
  minPrice: string; // User-input price
  maxPrice: string; // User-input price
}

export type V3RangeSelection = V3FullRange | V3CustomRange;

export interface V3PoolCreationParams {
  tokenA: PoolToken;
  tokenB: PoolToken;
  fee: V3FeeTier;
  tickLower: number;
  tickUpper: number;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  sqrtPriceX96?: bigint; // For pool initialization (if pool doesn't exist)
}

export interface V3PoolQuote {
  version: 'v3';
  fee: V3FeeTier;
  amountA: bigint;
  amountB: bigint;
  liquidityAmount: bigint;
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint;
  priceRange: {
    minPrice: number;
    maxPrice: number;
  };
  share: number; // percentage of pool share within the price range
}

// ============================================================================
// UNIFIED POOL TYPES
// ============================================================================

export type UnifiedPoolQuote = V2PoolQuote | V3PoolQuote;
export type PoolCreationParams = V2PoolCreationParams | V3PoolCreationParams;

export interface BestPoolResult {
  quote: UnifiedPoolQuote;
  reason: string;
}

// ============================================================================
// POOL SERVICE INTERFACES
// ============================================================================

export interface IPoolService<TQuote, TParams> {
  getQuote(params: Omit<TParams, 'amountAMin' | 'amountBMin'>): Promise<TQuote | null>;
  createPool(params: TParams, options: BasePoolOptions): Promise<`0x${string}`>;
}

export interface IV2PoolService extends IPoolService<V2PoolQuote, V2PoolCreationParams> {}
export interface IV3PoolService extends IPoolService<V3PoolQuote, V3PoolCreationParams> {}

// ============================================================================
// POSITION TYPES (for future liquidity management)
// ============================================================================

export interface V2LiquidityPosition {
  version: 'v2';
  tokenA: PoolToken;
  tokenB: PoolToken;
  liquidity: bigint;
  poolAddress: `0x${string}`;
}

export interface V3LiquidityPosition {
  version: 'v3';
  tokenId: bigint;
  tokenA: PoolToken;
  tokenB: PoolToken;
  fee: V3FeeTier;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  poolAddress: `0x${string}`;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export type LiquidityPosition = V2LiquidityPosition | V3LiquidityPosition;

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type PoolVersion = 'v2' | 'v3';

export interface PoolServiceConfig {
  chainId: number;
  publicClient: any; // viem PublicClient
  walletClient?: any; // viem WalletClient
}

// Helper type for fee tier labels
export const V3_FEE_TIER_LABELS: Record<V3FeeTier, string> = {
  100: '0.01%',
  500: '0.05%',
  3000: '0.3%',
  10000: '1%',
};

// Helper type for fee tier descriptions
export const V3_FEE_TIER_DESCRIPTIONS: Record<V3FeeTier, string> = {
  100: 'Best for very stable pairs',
  500: 'Best for stable pairs',
  3000: 'Best for most pairs',
  10000: 'Best for exotic pairs',
};

// Full range ticks (covers all possible prices)
export const FULL_RANGE_TICKS = {
  tickLower: -887272,
  tickUpper: 887272,
};
