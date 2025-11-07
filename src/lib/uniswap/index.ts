// ============================================================================
// MAIN EXPORTS
// ============================================================================

// Core service
export { UniswapService } from './core/UniswapService';

// Helper functions

// Main hook
export { useUniswap } from './hooks/useUniswap';
export type { UseUniswapOptions, UseUniswapResult } from './hooks/useUniswap';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Quote types
  V2Quote,
  V3Quote, 
  UnifiedQuote,
  
  // Service types
  IUniswapService,
  BestQuoteResult,
  UniswapServiceConfig,
  
  // Swap types
  UniversalSwapOptions,
  
  // Quote service interfaces
  IQuoteService,
  IV2QuoteService,
  IV3QuoteService,
  
  // Utility types
  QuoteVersion
} from './core/types';


// ============================================================================
// QUOTE SERVICES (for advanced usage)
// ============================================================================

export { V2QuoteService } from './quotes/V2QuoteService';
export { V3QuoteService } from './quotes/V3QuoteService';

// ============================================================================
// SWAP SERVICES (for advanced usage)
// ============================================================================

export { V2SwapService } from './swaps/V2SwapService';
export { V3SwapService } from './swaps/V3SwapService';

// ============================================================================
// POOL SERVICES (for advanced usage)
// ============================================================================

export { V2PoolService, V3PoolService } from './pools';
export type {
  V2PoolCreationParams,
  V3PoolCreationParams,
  V2PoolQuote,
  V3PoolQuote,
  UnifiedPoolQuote,
  V3FeeTier,
  V3RangeSelection,
  PoolToken,
  BasePoolOptions,
} from './pools';

// ============================================================================
// UTILITIES
// ============================================================================

// Re-export commonly used Uniswap SDK types for convenience
export { TradeType } from '@uniswap/sdk-core';
export type { Currency, Token } from '@uniswap/sdk-core';
export { CurrencyAmount } from '@uniswap/sdk-core';
