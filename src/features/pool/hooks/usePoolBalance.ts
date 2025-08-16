import { useState, useEffect, useCallback } from 'react';
import { fetchTokenPrice, type TokenPrice } from '../../../lib/pythService';
import type { Token } from '../../../types/token';

interface UsePoolBalanceParams {
  tokenA: Token | null;
  tokenB: Token | null;
}

interface UsePoolBalanceReturn {
  // Amounts
  amountA: string;
  amountB: string;
  
  // Price information
  priceA: TokenPrice | null;
  priceB: TokenPrice | null;
  
  // USD values for display/validation
  usdValueA: number;
  usdValueB: number;
  totalUsdValue: number;
  
  // Pool state
  poolExists: boolean;
  poolRatio: number | null; // tokenA/tokenB ratio from existing pool
  
  // Loading states
  isLoadingPrices: boolean;
  isLoadingPool: boolean;
  error: string | null;
  
  // Actions
  setAmountA: (amount: string) => void;
  setAmountB: (amount: string) => void;
  
  // Manual control (for max buttons, etc.)
  setExactAmountA: (amount: string) => void;
  setExactAmountB: (amount: string) => void;
}

type LastEditedField = 'A' | 'B' | null;

/**
 * Custom hook for managing balanced liquidity pool amounts
 * Priority: 1) Existing pool ratio, 2) Market prices from Pyth
 * Automatically balances token amounts to maintain 50/50 USD value
 */
export const usePoolBalance = ({ tokenA, tokenB }: UsePoolBalanceParams): UsePoolBalanceReturn => {
  const [amountA, setAmountAInternal] = useState('');
  const [amountB, setAmountBInternal] = useState('');
  const [priceA, setPriceA] = useState<TokenPrice | null>(null);
  const [priceB, setPriceB] = useState<TokenPrice | null>(null);
  const [poolExists, setPoolExists] = useState(false);
  const [poolRatio, setPoolRatio] = useState<number | null>(null);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isLoadingPool, setIsLoadingPool] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEdited, setLastEdited] = useState<LastEditedField>(null);

  // Calculate USD values
  const usdValueA = priceA && amountA ? parseFloat(amountA) * priceA.price : 0;
  const usdValueB = priceB && amountB ? parseFloat(amountB) * priceB.price : 0;
  const totalUsdValue = usdValueA + usdValueB;

  // Check if pool exists and get current ratio
  const checkPoolExists = useCallback(async () => {
    if (!tokenA || !tokenB) {
      setPoolExists(false);
      setPoolRatio(null);
      return;
    }

    setIsLoadingPool(true);
    
    try {
      // TODO: Replace with actual pool contract call
      // For now, simulate that pools don't exist (new pools)
      // In real implementation, you'd call the UniswapV2Factory contract
      // to check if a pair exists and get reserves
      
      setPoolExists(false);
      setPoolRatio(null);
      
      // Example of what the real implementation would look like:
      // const pairAddress = await factoryContract.getPair(tokenA.address, tokenB.address);
      // if (pairAddress !== '0x0000000000000000000000000000000000000000') {
      //   const pairContract = new Contract(pairAddress, PairABI, provider);
      //   const [reserve0, reserve1] = await pairContract.getReserves();
      //   const ratio = reserve0 / reserve1; // Adjust based on token order
      //   setPoolExists(true);
      //   setPoolRatio(ratio);
      // } else {
      //   setPoolExists(false);
      //   setPoolRatio(null);
      // }
    } catch (error) {
      console.error('Error checking pool existence:', error);
      setPoolExists(false);
      setPoolRatio(null);
    } finally {
      setIsLoadingPool(false);
    }
  }, [tokenA, tokenB]);

  // Fetch market prices from Pyth
  const fetchMarketPrices = useCallback(async () => {
    if (!tokenA || !tokenB) {
      setPriceA(null);
      setPriceB(null);
      return;
    }

    setIsLoadingPrices(true);
    setError(null);

    try {
      const [priceDataA, priceDataB] = await Promise.all([
        fetchTokenPrice(tokenA.symbol),
        fetchTokenPrice(tokenB.symbol),
      ]);

      if (!priceDataA || !priceDataB) {
        throw new Error(`Unable to fetch prices for ${tokenA.symbol} or ${tokenB.symbol}`);
      }

      setPriceA(priceDataA);
      setPriceB(priceDataB);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch token prices';
      setError(errorMessage);
      console.error('Pool balance price fetch error:', error);
    } finally {
      setIsLoadingPrices(false);
    }
  }, [tokenA, tokenB]);

  // Get the effective ratio to use for balancing
  const getEffectiveRatio = useCallback((): number | null => {
    if (poolExists && poolRatio !== null) {
      // Use existing pool ratio
      return poolRatio;
    } else if (priceA && priceB) {
      // Use market price ratio
      return priceA.price / priceB.price;
    }
    return null;
  }, [poolExists, poolRatio, priceA, priceB]);

  // Calculate balanced amount for token B based on token A amount
  const calculateBalancedAmountB = useCallback((amountAValue: string): string => {
    const ratio = getEffectiveRatio();
    if (!ratio || !amountAValue) return '';
    
    const numAmountA = parseFloat(amountAValue);
    if (isNaN(numAmountA) || numAmountA <= 0) return '';
    
    let balancedAmountB: number;
    
    if (poolExists && poolRatio !== null) {
      // Use pool ratio directly
      balancedAmountB = numAmountA / poolRatio;
    } else if (priceA && priceB) {
      // Use USD value balancing with market prices
      const usdValue = numAmountA * priceA.price;
      balancedAmountB = usdValue / priceB.price;
    } else {
      return '';
    }
    
    return balancedAmountB.toFixed(2);
  }, [getEffectiveRatio, poolExists, poolRatio, priceA, priceB]);

  // Calculate balanced amount for token A based on token B amount
  const calculateBalancedAmountA = useCallback((amountBValue: string): string => {
    const ratio = getEffectiveRatio();
    if (!ratio || !amountBValue) return '';
    
    const numAmountB = parseFloat(amountBValue);
    if (isNaN(numAmountB) || numAmountB <= 0) return '';
    
    let balancedAmountA: number;
    
    if (poolExists && poolRatio !== null) {
      // Use pool ratio directly
      balancedAmountA = numAmountB * poolRatio;
    } else if (priceA && priceB) {
      // Use USD value balancing with market prices
      const usdValue = numAmountB * priceB.price;
      balancedAmountA = usdValue / priceA.price;
    } else {
      return '';
    }
    
    return balancedAmountA.toFixed(2);
  }, [getEffectiveRatio, poolExists, poolRatio, priceA, priceB]);

  // Set amount A and auto-calculate amount B
  const setAmountA = useCallback((amount: string) => {
    setAmountAInternal(amount);
    setLastEdited('A');
    
    if (amount) {
      const balancedB = calculateBalancedAmountB(amount);
      setAmountBInternal(balancedB);
    } else {
      setAmountBInternal('');
    }
  }, [calculateBalancedAmountB]);

  // Set amount B and auto-calculate amount A
  const setAmountB = useCallback((amount: string) => {
    setAmountBInternal(amount);
    setLastEdited('B');
    
    if (amount) {
      const balancedA = calculateBalancedAmountA(amount);
      setAmountAInternal(balancedA);
    } else {
      setAmountAInternal('');
    }
  }, [calculateBalancedAmountA]);

  // Set exact amounts without auto-balancing (for max buttons, etc.)
  const setExactAmountA = useCallback((amount: string) => {
    setAmountAInternal(amount);
    setLastEdited('A');
  }, []);

  const setExactAmountB = useCallback((amount: string) => {
    setAmountBInternal(amount);
    setLastEdited('B');
  }, []);

  // Re-balance when prices or pool ratio changes
  useEffect(() => {
    if (lastEdited && (priceA && priceB) || (poolExists && poolRatio !== null)) {
      if (lastEdited === 'A' && amountA) {
        const balancedB = calculateBalancedAmountB(amountA);
        setAmountBInternal(balancedB);
      } else if (lastEdited === 'B' && amountB) {
        const balancedA = calculateBalancedAmountA(amountB);
        setAmountAInternal(balancedA);
      }
    }
  }, [priceA, priceB, poolExists, poolRatio, lastEdited, amountA, amountB, calculateBalancedAmountA, calculateBalancedAmountB]);

  // Check pool and fetch prices when tokens change
  useEffect(() => {
    if (tokenA && tokenB) {
      checkPoolExists();
      fetchMarketPrices();
    }
  }, [checkPoolExists, fetchMarketPrices]);

  // Clear amounts when tokens change
  useEffect(() => {
    setAmountAInternal('');
    setAmountBInternal('');
    setLastEdited(null);
  }, [tokenA, tokenB]);

  return {
    amountA,
    amountB,
    priceA,
    priceB,
    usdValueA,
    usdValueB,
    totalUsdValue,
    poolExists,
    poolRatio,
    isLoadingPrices,
    isLoadingPool,
    error,
    setAmountA,
    setAmountB,
    setExactAmountA,
    setExactAmountB,
  };
};
