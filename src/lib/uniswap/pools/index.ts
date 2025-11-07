// ============================================================================
// POOL SERVICES
// ============================================================================

export { V2PoolService } from './V2PoolService';
export { V3PoolService } from './V3PoolService';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Pool tokens and base types
  PoolToken,
  BasePoolOptions,
  PoolVersion,
  PoolServiceConfig,
  
  // V2 types
  V2PoolCreationParams,
  V2PoolQuote,
  
  // V3 types
  V3PoolCreationParams,
  V3PoolQuote,
  V3FeeTier,
  V3PriceRange,
  V3FullRange,
  V3CustomRange,
  V3RangeSelection,
  
  // Unified types
  UnifiedPoolQuote,
  PoolCreationParams,
  BestPoolResult,
  
  // Service interfaces
  IPoolService,
  IV2PoolService,
  IV3PoolService,
  
  // Position types (for future use)
  V2LiquidityPosition,
  V3LiquidityPosition,
  LiquidityPosition,
} from './types';

// ============================================================================
// CONSTANTS AND UTILITIES
// ============================================================================

export {
  V3_FEE_TIER_LABELS,
  V3_FEE_TIER_DESCRIPTIONS,
  FULL_RANGE_TICKS,
} from './types';
