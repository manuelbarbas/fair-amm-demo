import { useMemo, useCallback } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { TradeType } from '@uniswap/sdk-core';
import type { Currency } from '@uniswap/sdk-core';
import { CurrencyAmount } from '@uniswap/sdk-core';

import { UniswapService } from '../core/UniswapService';
import type { 
  UniversalSwapOptions,
  BestQuoteResult,
  UnifiedQuote
} from '../core/types';

export interface UseUniswapOptions {
  chainId?: number;
}

export interface UseUniswapResult {
  // Service instance
  service: UniswapService | null;
  
  // Quote methods
  getQuote: (
    amount: CurrencyAmount<Currency>,
    toToken: Currency,
    tradeType?: TradeType
  ) => Promise<BestQuoteResult | null>;
  
  // Swap execution
  executeSwap: (
    quote: UnifiedQuote,
    options: UniversalSwapOptions
  ) => Promise<`0x${string}`>;
  
  // Utility methods
  getSupportedVersions: () => string[];
  isReady: boolean;
}

/**
 * Main hook for interacting with Uniswap across all versions (V2, V3, V4)
 * via the Universal Router
 */
export function useUniswap(options: UseUniswapOptions = {}): UseUniswapResult {
  const publicClient = usePublicClient({ chainId: options.chainId });
  const { data: walletClient } = useWalletClient({ chainId: options.chainId });
  
  // Create service instance
  const service = useMemo(() => {
    if (!publicClient) return null;
    
    try {
      return UniswapService.create(publicClient, walletClient || undefined);
    } catch (error) {
      console.error('Failed to create UniswapService:', error);
      return null;
    }
  }, [publicClient, walletClient]);
  
  // Update wallet client when it changes
  useMemo(() => {
    if (service && walletClient) {
      service.updateWalletClient(walletClient);
    }
  }, [service, walletClient]);
  
  // Quote method
  const getQuote = useCallback(
    async (
      amount: CurrencyAmount<Currency>,
      toToken: Currency,
      tradeType: TradeType = TradeType.EXACT_INPUT
    ): Promise<BestQuoteResult | null> => {
      if (!service) {
        console.warn('UniswapService not available');
        return null;
      }
      
      return service.getQuote(amount, toToken, tradeType);
    },
    [service]
  );
  
  // Swap execution method
  const executeSwap = useCallback(
    async (
      quote: UnifiedQuote,
      options: UniversalSwapOptions
    ): Promise<`0x${string}`> => {
      if (!service) {
        throw new Error('UniswapService not available');
      }
      
      return service.executeSwap(quote, options);
    },
    [service]
  );
  
  // Get supported versions
  const getSupportedVersions = useCallback(() => {
    return service ? service.getSupportedVersions() : [];
  }, [service]);
  
  // Check if service is ready
  const isReady = useMemo(() => {
    return !!service && !!publicClient;
  }, [service, publicClient]);
  
  return {
    service,
    getQuote,
    executeSwap,
    getSupportedVersions,
    isReady
  };
}

// Export types for external use
export type { 
  UniversalSwapOptions,
  BestQuoteResult,
  UnifiedQuote,
  V2Quote,
  V3Quote
} from '../core/types';
