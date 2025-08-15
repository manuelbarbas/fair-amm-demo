import { useState, useEffect, useCallback } from 'react';
import { fetchTokenPrice, calculateUSDValue, hasPriceSupport, type TokenPrice } from '../lib/pythService';
import type { Token } from '../types/token';

interface UseTokenUSDValueParams {
  token: Token | null;
  amount: string;
  refreshInterval?: number; // In milliseconds, default 30 seconds
}

interface UseTokenUSDValueReturn {
  usdValue: number;
  tokenPrice: TokenPrice | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refetch: () => void;
}

/**
 * Custom hook to calculate USD value for a token amount
 * Handles price fetching, caching, and automatic refresh
 */
export const useTokenUSDValue = ({
  token,
  amount,
  refreshInterval = 30000, // 30 seconds default
}: UseTokenUSDValueParams): UseTokenUSDValueReturn => {
  const [tokenPrice, setTokenPrice] = useState<TokenPrice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Calculate USD value based on current token price and amount
  const usdValue = tokenPrice ? calculateUSDValue(amount, tokenPrice.price) : 0;

  const fetchPrice = useCallback(async () => {
    if (!token) {
      setTokenPrice(null);
      setError(null);
      setLastUpdated(null);
      return;
    }

    // Check if token has price support
    if (!hasPriceSupport(token.symbol)) {
      setTokenPrice(null);
      setError(`Price not available for ${token.symbol}`);
      setLastUpdated(Date.now());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const price = await fetchTokenPrice(token.symbol);
      setTokenPrice(price);
      setLastUpdated(Date.now());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token price';
      setError(errorMessage);
      setTokenPrice(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const refetch = useCallback(() => {
    fetchPrice();
  }, [fetchPrice]);

  // Initial price fetch when token changes
  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (!token || !hasPriceSupport(token.symbol)) return;

    const interval = setInterval(() => {
      fetchPrice();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [token, fetchPrice, refreshInterval]);

  return {
    usdValue,
    tokenPrice,
    isLoading,
    error,
    lastUpdated,
    refetch,
  };
};
