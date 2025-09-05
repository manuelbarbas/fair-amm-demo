import { isNativeToken, getWETHAddress } from "../config/config";

export interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  name: string;
  chainId?: number;
}

// =============================================================================
// NATIVE/WRAPPED TOKEN DETECTION
// =============================================================================

/**
 * Check if this is a native/wrapped token pair (e.g., FAIR ↔ WFAIR)
 * These pairs represent the same underlying asset
 */
export const isNativeWrappedPair = (
  tokenA: Token | null, 
  tokenB: Token | null, 
  chainId: number
): boolean => {
  if (!tokenA || !tokenB) return false;
  
  const wethAddress = getWETHAddress(chainId);
  if (!wethAddress) return false;
  
  return (isNativeToken(tokenA) && tokenB.address.toLowerCase() === wethAddress.toLowerCase()) ||
         (isNativeToken(tokenB) && tokenA.address.toLowerCase() === wethAddress.toLowerCase());
};

// =============================================================================
// APPROVAL UTILITIES
// =============================================================================

/**
 * Check if a token needs approval for swap operations
 * - Native tokens: never need approval
 * - Native/wrapped pairs: no approval needed (direct deposit/withdraw)
 * - Regular ERC20: needs approval for router
 */
export const needsSwapApproval = (
  fromToken: Token | null, 
  toToken: Token | null, 
  chainId: number
): boolean => {
  if (!fromToken) return false;
  
  // Native tokens never need approval
  if (isNativeToken(fromToken)) return false;
  
  // Native/wrapped pairs don't need approval (direct deposit/withdraw)
  if (isNativeWrappedPair(fromToken, toToken, chainId)) {
    return false; // No approval needed for either direction
  }
  
  // Regular ERC20 tokens need approval for router
  return true;
};

/**
 * Check if a token needs approval for pool operations
 * Native tokens don't need approval, all others do
 */
export const needsPoolApproval = (token: Token | null): boolean => {
  if (!token) return false;
  return !isNativeToken(token);
};

/**
 * Get the correct approval target address for swap operations
 * - Native/wrapped pairs: null (no approval needed)
 * - Regular swaps: router address
 */
export const getSwapApprovalTarget = (
  fromToken: Token | null, 
  toToken: Token | null, 
  routerAddress: `0x${string}`, 
  chainId: number
): `0x${string}` | null => {
  if (!fromToken) return null;
  
  // Native/wrapped token pairs don't need approval
  if (isNativeWrappedPair(fromToken, toToken, chainId)) {
    return null; // No approval needed
  }
  
  // For regular swaps, approve the router
  return routerAddress;
};

// =============================================================================
// POOL VALIDATION
// =============================================================================

/**
 * Check if this is an invalid pair for pool creation
 * Invalid pairs include:
 * - Same token (e.g., FAIR ↔ FAIR)
 * - Native/wrapped pairs (e.g., FAIR ↔ WFAIR)
 */
export const isInvalidPoolPair = (
  tokenA: Token | null, 
  tokenB: Token | null, 
  chainId: number
): boolean => {
  if (!tokenA || !tokenB) return false;
  
  // Same token check
  if (tokenA.address.toLowerCase() === tokenB.address.toLowerCase()) {
    return true;
  }
  
  // Native/wrapped pair check
  return isNativeWrappedPair(tokenA, tokenB, chainId);
};

/**
 * Get validation message for invalid pool pairs
 */
export const getPoolPairValidationMessage = (
  tokenA: Token | null, 
  tokenB: Token | null, 
  chainId: number
): string | null => {
  if (!tokenA || !tokenB) return null;
  
  // Same token check
  if (tokenA.address.toLowerCase() === tokenB.address.toLowerCase()) {
    return `Cannot create ${tokenA.symbol}/${tokenB.symbol} pool - same token selected twice.`;
  }
  
  // Native/wrapped pair check
  if (isNativeWrappedPair(tokenA, tokenB, chainId)) {
    const nativeSymbol = isNativeToken(tokenA) ? tokenA?.symbol : tokenB?.symbol;
    const wrappedSymbol = isNativeToken(tokenA) ? tokenB?.symbol : tokenA?.symbol;
    return `Cannot create ${nativeSymbol}/${wrappedSymbol} pool - these tokens represent the same asset. Use swap to convert between them.`;
  }
  
  return null;
};

// =============================================================================
// BALANCE UTILITIES
// =============================================================================

/**
 * Check if we should fetch native balance vs ERC20 balance
 */
export const shouldFetchNativeBalance = (token: Token | null): boolean => {
  return token ? isNativeToken(token) : false;
};
