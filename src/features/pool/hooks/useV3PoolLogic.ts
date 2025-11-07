import { useState, useEffect, useMemo } from "react";
import { parseUnits } from "viem";
import { useChainId, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { getV3NFTPositionManagerAddress } from "../../../config/config";
import type { TransactionSettingsData } from "../../../hooks/useTransactionSettings";
import type { V3FeeTier, V3RangeSelection } from "../../../lib/uniswap/pools";
import { V3PoolService } from "../../../lib/uniswap/pools/V3PoolService";
import type { SharedPoolState } from "./useSharedPoolLogic";

export interface V3PoolState {
  // V3-specific state
  selectedFeeTier: V3FeeTier;
  priceRangeSelection: V3RangeSelection;
  
  // V3 calculations
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint | null;
  
  // Position manager address
  positionManagerAddress: `0x${string}` | undefined;
  
  // V3 service
  v3PoolService: V3PoolService | null;
}

export interface V3PoolActions {
  // V3-specific actions
  setSelectedFeeTier: (fee: V3FeeTier) => void;
  setPriceRangeSelection: (selection: V3RangeSelection) => void;
  handleCreatePool: () => Promise<void>;
}

export interface UseV3PoolLogicParams {
  sharedState: SharedPoolState;
  poolSettings: TransactionSettingsData;
  setHash: (hash: `0x${string}` | undefined) => void;
  setIsConfirming: (confirming: boolean) => void;
  isActive: boolean;
}

/**
 * V3-specific pool logic hook
 * Handles: fee tiers, price ranges, tick calculations, position manager interactions, NFT positions
 */
export const useV3PoolLogic = ({ 
  sharedState, 
  poolSettings, 
  setHash, 
  setIsConfirming,
  isActive
}: UseV3PoolLogicParams) => {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const positionManagerAddress = getV3NFTPositionManagerAddress(chainId);

  // V3-specific state
  const [selectedFeeTier, setSelectedFeeTier] = useState<V3FeeTier>(3000); // 0.3% default
  const [priceRangeSelection, setPriceRangeSelection] = useState<V3RangeSelection>({
    type: 'full'
  });
  
  // V3 calculation state
  const [tickLower, setTickLower] = useState<number>(-887272); // Full range default
  const [tickUpper, setTickUpper] = useState<number>(887272); // Full range default
  const [sqrtPriceX96, setSqrtPriceX96] = useState<bigint | null>(null);

  const { tokenA, tokenB, amountA, amountB } = sharedState;

  // Create V3 pool service instance using wagmi clients directly
  const v3PoolService = useMemo(() => {
    if (!publicClient) return null;
    return new V3PoolService(publicClient, walletClient);
  }, [publicClient, walletClient]);

  // Calculate price range ticks when price range selection changes
  useEffect(() => {
    const calculateTicks = async () => {
      if (!isActive || !tokenA || !tokenB || !v3PoolService) return;

      try {
        if (priceRangeSelection.type === 'full') {
          // Use full range ticks
          setTickLower(-887272);
          setTickUpper(887272);
        } else if (priceRangeSelection.type === 'custom') {
          // Calculate custom ticks from price inputs
          const { minPrice, maxPrice } = priceRangeSelection;
          
          if (minPrice && maxPrice) {
            const minPriceNum = parseFloat(minPrice);
            const maxPriceNum = parseFloat(maxPrice);
            
            if (minPriceNum > 0 && maxPriceNum > minPriceNum) {
              // Convert prices to ticks (simplified calculation)
              // In a real implementation, you'd use proper price-to-tick conversion
              const lowerTick = Math.floor(Math.log(minPriceNum) / Math.log(1.0001));
              const upperTick = Math.floor(Math.log(maxPriceNum) / Math.log(1.0001));
              
              setTickLower(lowerTick);
              setTickUpper(upperTick);
            }
          }
        }
      } catch (error) {
        console.error('Error calculating V3 ticks:', error);
        // Fallback to full range
        setTickLower(-887272);
        setTickUpper(887272);
      }
    };

    calculateTicks();
  }, [isActive, priceRangeSelection, tokenA, tokenB, v3PoolService]);

  // Calculate initial sqrt price when tokens and amounts change
  useEffect(() => {
    const calculateSqrtPrice = () => {
      if (!isActive || !tokenA || !tokenB || !amountA || !amountB) {
        setSqrtPriceX96(null);
        return;
      }

      try {
        // Calculate price from amounts: price = amountB / amountA
        const price = parseFloat(amountB) / parseFloat(amountA);
        
        if (price > 0) {
          // Convert price to sqrtPriceX96 (simplified calculation)
          // In a real implementation, you'd use proper price conversion utilities
          const sqrtPrice = Math.sqrt(price);
          const Q96 = 2n ** 96n;
          const sqrtPriceX96Value = BigInt(Math.floor(sqrtPrice * Number(Q96)));
          setSqrtPriceX96(sqrtPriceX96Value);
        }
      } catch (error) {
        console.error('Error calculating sqrt price:', error);
        setSqrtPriceX96(null);
      }
    };

    calculateSqrtPrice();
  }, [isActive, tokenA, tokenB, amountA, amountB]);

  // V3 Pool creation logic
  const handleCreatePool = async () => {
    console.log('V3 handleCreatePool called', { isActive });
    
    if (!isActive) {
      console.log('V3 hook not active, skipping pool creation');
      return;
    }
    
    if (!v3PoolService || !tokenA || !tokenB || !amountA || !amountB || !address || !positionManagerAddress) {
      console.error('Missing V3 pool creation requirements:', {
        v3PoolService: !!v3PoolService,
        tokenA: !!tokenA,
        tokenB: !!tokenB,
        amountA,
        amountB,
        address,
        positionManagerAddress
      });
      return;
    }

    try {
      setIsConfirming(true);
      const amountADesired = parseUnits(amountA, tokenA.decimals);
      const amountBDesired = parseUnits(amountB, tokenB.decimals);
      
      // Calculate minimum amounts with slippage protection
      const minSlippage = Math.max(poolSettings.slippage.value, 5);
      const slippageMultiplier = (100 - minSlippage) / 100;
      const amountAMin = BigInt(Math.floor(Number(amountADesired) * slippageMultiplier));
      const amountBMin = BigInt(Math.floor(Number(amountBDesired) * slippageMultiplier));
      
      console.log('V3 Pool creation parameters:', {
        isActive,
        tokenA: tokenA.symbol,
        tokenB: tokenB.symbol,
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        amountAMin: amountAMin.toString(),
        amountBMin: amountBMin.toString(),
        feeTier: selectedFeeTier,
        tickLower,
        tickUpper,
        sqrtPriceX96: sqrtPriceX96?.toString(),
        priceRange: priceRangeSelection,
        slippage: minSlippage,
        chainId,
        positionManagerAddress
      });
      
      // Create V3 position using position manager
      const txHash = await v3PoolService.createPosition({
        tokenA: { ...tokenA, chainId: tokenA.chainId || chainId },
        tokenB: { ...tokenB, chainId: tokenB.chainId || chainId },
        fee: selectedFeeTier,
        tickLower,
        tickUpper,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        sqrtPriceX96: sqrtPriceX96 || undefined,
      }, {
        slippageTolerance: poolSettings.slippage.value,
        deadline: Math.floor(Date.now() / 1000) + (poolSettings.deadline * 60),
        recipient: address,
        chainId,
        biteEncryption: poolSettings?.biteEncryption,
      });

      setHash(txHash);
    } catch (error) {
      console.error("Error creating V3 pool:", error);
      setIsConfirming(false);
    }
  };

  // V3 state
  const state: V3PoolState = {
    selectedFeeTier,
    priceRangeSelection,
    tickLower,
    tickUpper,
    sqrtPriceX96,
    positionManagerAddress,
    v3PoolService,
  };

  // V3 actions
  const actions: V3PoolActions = {
    setSelectedFeeTier,
    setPriceRangeSelection,
    handleCreatePool,
  };

  return { state, actions };
};
