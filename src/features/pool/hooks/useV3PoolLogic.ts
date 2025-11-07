import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { parseUnits } from "viem";
import { useChainId, useAccount, usePublicClient, useWalletClient } from "wagmi";
import { getV3NFTPositionManagerAddress } from "../../../config/config";
import type { TransactionSettingsData } from "../../../hooks/useTransactionSettings";
import type { V3FeeTier, V3RangeSelection } from "../../../lib/uniswap/pools";
import { V3PoolService } from "../../../lib/uniswap/pools/V3PoolService";
import type { SharedPoolState, SharedPoolActions } from "./useSharedPoolLogic";

const Q96N = 2n ** 96n;
const MIN_TICK = -887272;
const MAX_TICK = 887272;
const LOG_BASE = Math.log(1.0001);

const TICK_SPACING_MAP: Record<V3FeeTier, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

const getTickSpacing = (fee: V3FeeTier): number => {
  const spacing = TICK_SPACING_MAP[fee];
  if (!spacing) {
    throw new Error(`Unsupported fee tier: ${fee}`);
  }
  return spacing;
};

const alignToSpacing = (tick: number, spacing: number, direction: "down" | "up") => {
  if (direction === "down") {
    return Math.floor(tick / spacing) * spacing;
  }
  return Math.ceil(tick / spacing) * spacing;
};

const getFullRangeTicks = (spacing: number) => {
  const lower = Math.max(Math.ceil(MIN_TICK / spacing) * spacing, MIN_TICK);
  const upper = Math.min(Math.floor(MAX_TICK / spacing) * spacing, MAX_TICK);
  return { lower, upper };
};

const clampTick = (tick: number, spacing: number, boundary: "min" | "max") => {
  if (boundary === "min") {
    const alignedMin = Math.ceil(MIN_TICK / spacing) * spacing;
    return Math.max(tick, alignedMin);
  }
  const alignedMax = Math.floor(MAX_TICK / spacing) * spacing;
  return Math.min(tick, alignedMax);
};

const priceToTick = (price: number) => {
  return Math.log(price) / LOG_BASE;
};

const calculateCustomRangeTicks = (
  minPrice: number,
  maxPrice: number,
  spacing: number
) => {
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || minPrice <= 0 || maxPrice <= minPrice) {
    throw new Error("Invalid price range provided for V3 position");
  }

  let lower = alignToSpacing(Math.floor(priceToTick(minPrice)), spacing, "down");
  let upper = alignToSpacing(Math.ceil(priceToTick(maxPrice)), spacing, "up");

  lower = clampTick(lower, spacing, "min");
  upper = clampTick(upper, spacing, "max");

  if (upper <= lower) {
    upper = clampTick(lower + spacing, spacing, "max");
    if (upper <= lower) {
      lower = clampTick(upper - spacing, spacing, "min");
      if (lower >= upper) {
        throw new Error("Unable to derive valid tick range for provided prices");
      }
    }
  }

  return { lower, upper };
};

export type V3TransactionStepId = "approveA" | "approveB" | "initialize" | "create";

export type V3TransactionStepStatus = "pending" | "inProgress" | "completed" | "error";

export interface V3TransactionStep {
  id: V3TransactionStepId;
  label: string;
  status: V3TransactionStepStatus;
  txHash?: `0x${string}`;
}

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
  transactionSteps: V3TransactionStep[];
  isSequenceRunning: boolean;
}

export interface V3PoolActions {
  // V3-specific actions
  setSelectedFeeTier: (fee: V3FeeTier) => void;
  setPriceRangeSelection: (selection: V3RangeSelection) => void;
  handleCreatePool: () => Promise<void>;
  handleApproveTokenA: () => Promise<void>;
  handleApproveTokenB: () => Promise<void>;
}

export interface UseV3PoolLogicParams {
  sharedState: SharedPoolState;
  sharedActions: SharedPoolActions;
  poolSettings: TransactionSettingsData;
  setHash: (hash: `0x${string}` | undefined) => void;
  setIsConfirming: (confirming: boolean) => void;
  isActive: boolean;
  onPoolCreated?: (hash: `0x${string}`) => void;
}

/**
 * V3-specific pool logic hook
 * Handles: fee tiers, price ranges, tick calculations, position manager interactions, NFT positions
 */
export const useV3PoolLogic = ({ 
  sharedState, 
  sharedActions,
  poolSettings, 
  setHash, 
  setIsConfirming,
  isActive,
  onPoolCreated
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
  const defaultSpacing = getTickSpacing(3000);
  const defaultFullRange = getFullRangeTicks(defaultSpacing);
  const [tickLower, setTickLower] = useState<number>(defaultFullRange.lower);
  const [tickUpper, setTickUpper] = useState<number>(defaultFullRange.upper);
  const [sqrtPriceX96, setSqrtPriceX96] = useState<bigint | null>(null);
  const [transactionSteps, setTransactionSteps] = useState<V3TransactionStep[]>([]);
  const [isSequenceRunning, setIsSequenceRunning] = useState(false);
  const [requiresInitialization, setRequiresInitialization] = useState(false);

  const { tokenA, tokenB, amountA, amountB } = sharedState;
  const tokenPairKey = `${tokenA?.address ?? 'null'}|${tokenB?.address ?? 'null'}`;
  const lastPairKeyRef = useRef<string | null>(null);
  const initializationCompletedRef = useRef(false);
  const {
    needsApprovalA,
    needsApprovalB,
    handleApproveTokenA: approveTokenA,
    handleApproveTokenB: approveTokenB,
  } = sharedActions;

  // Create V3 pool service instance using wagmi clients directly
  const v3PoolService = useMemo(() => {
    if (!publicClient) return null;
    return new V3PoolService(publicClient, walletClient);
  }, [publicClient, walletClient]);

  useEffect(() => {
    let cancelled = false;

    const checkInitializationRequirement = async () => {
      if (!isActive || !tokenA || !tokenB || !positionManagerAddress || !v3PoolService) {
        initializationCompletedRef.current = true;
        setRequiresInitialization(false);
        return;
      }

      initializationCompletedRef.current = false;
      setRequiresInitialization(true);

      try {
        const { token0, token1 } = V3PoolService.sortTokens(tokenA.address, tokenB.address);
        const required = await v3PoolService.needsPoolInitialization({
          positionManager: positionManagerAddress,
          token0: token0 as `0x${string}`,
          token1: token1 as `0x${string}`,
          fee: selectedFeeTier,
        });

        if (!cancelled) {
          setRequiresInitialization(required);
          if (!required) {
            initializationCompletedRef.current = true;
          }
        }
      } catch (error) {
        console.warn('Failed to determine if pool initialization is required:', error);
        if (!cancelled) {
          setRequiresInitialization(true);
        }
      }
    };

    void checkInitializationRequirement();

    return () => {
      cancelled = true;
    };
  }, [
    isActive,
    tokenA?.address,
    tokenB?.address,
    v3PoolService,
    positionManagerAddress,
    selectedFeeTier,
  ]);

  const calculateInitialSqrtPrice = useCallback((amount0Desired: bigint, amount1Desired: bigint) => {
    if (amount0Desired === 0n || amount1Desired === 0n) {
      return Q96N;
    }

    try {
      const ratio = Number(amount1Desired) / Number(amount0Desired);
      if (!Number.isFinite(ratio) || ratio <= 0) {
        return Q96N;
      }
      const sqrtPrice = Math.sqrt(ratio);
      const derived = BigInt(Math.floor(sqrtPrice * Number(Q96N)));
      return derived > 0n ? derived : Q96N;
    } catch (error) {
      console.warn('Failed to calculate initial sqrt price, using default:', error);
      return Q96N;
    }
  }, []);

  const buildMintContext = useCallback(() => {
    if (!tokenA || !tokenB || !amountA || !amountB) {
      return null;
    }

    const amountADesired = parseUnits(amountA, tokenA.decimals);
    const amountBDesired = parseUnits(amountB, tokenB.decimals);

    const minSlippage = Math.max(poolSettings.slippage.value, 5);
    const slippageMultiplier = (100 - minSlippage) / 100;
    const amountAMin = BigInt(Math.floor(Number(amountADesired) * slippageMultiplier));
    const amountBMin = BigInt(Math.floor(Number(amountBDesired) * slippageMultiplier));

    const { token0, token1, swapped } = V3PoolService.sortTokens(
      tokenA.address,
      tokenB.address
    );
    const token0Address = token0 as `0x${string}`;
    const token1Address = token1 as `0x${string}`;

    const amount0Desired = swapped ? amountBDesired : amountADesired;
    const amount1Desired = swapped ? amountADesired : amountBDesired;
    const amount0Min = swapped ? amountBMin : amountAMin;
    const amount1Min = swapped ? amountAMin : amountBMin;

    const sqrtPriceForInit = calculateInitialSqrtPrice(amount0Desired, amount1Desired);

    return {
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      token0: token0Address,
      token1: token1Address,
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      sqrtPriceForInit,
    };
  }, [tokenA, tokenB, amountA, amountB, poolSettings.slippage.value, calculateInitialSqrtPrice]);

  const baseSteps = useMemo<V3TransactionStep[]>(() => {
    if (!tokenA || !tokenB) {
      return [];
    }

    const steps: V3TransactionStep[] = [];

    if (needsApprovalA) {
      steps.push({
        id: 'approveA',
        label: `Approve ${tokenA.symbol}`,
        status: 'pending',
      });
    }

    if (needsApprovalB) {
      steps.push({
        id: 'approveB',
        label: `Approve ${tokenB.symbol}`,
        status: 'pending',
      });
    }

    if (requiresInitialization) {
      steps.push({
        id: 'initialize',
        label: 'Initialize pool',
        status: 'pending',
      });
    }

    steps.push({
      id: 'create',
      label: `Create ${tokenA.symbol}/${tokenB.symbol} V3 position`,
      status: 'pending',
    });

    return steps;
  }, [tokenA, tokenB, needsApprovalA, needsApprovalB, requiresInitialization]);

  useEffect(() => {
    if (isSequenceRunning) {
      return;
    }

    setTransactionSteps((prev) => {
      if (lastPairKeyRef.current !== tokenPairKey) {
        lastPairKeyRef.current = tokenPairKey;
        initializationCompletedRef.current = false;
        return baseSteps;
      }

      const prevMap = new Map(prev.map((step) => [step.id, step]));
      return baseSteps.map((step) => {
        const existing = prevMap.get(step.id);
        return existing ? { ...step, status: existing.status, txHash: existing.txHash } : step;
      });
    });
  }, [baseSteps, isSequenceRunning, tokenPairKey]);

  const updateTransactionStep = useCallback((id: V3TransactionStepId, updates: Partial<V3TransactionStep>) => {
    setTransactionSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...updates } : step)));
  }, []);

  const executeTransactionStep = useCallback(async (stepId: V3TransactionStepId) => {
    updateTransactionStep(stepId, { status: 'inProgress', txHash: undefined });

    try {
      if (stepId === 'approveA') {
        const txHash = await approveTokenA();
        if (!txHash) {
          throw new Error('Approval transaction for token A not sent');
        }
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }
        updateTransactionStep(stepId, { status: 'completed', txHash });
        return;
      }

      if (stepId === 'approveB') {
        const txHash = await approveTokenB();
        if (!txHash) {
          throw new Error('Approval transaction for token B not sent');
        }
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }
        updateTransactionStep(stepId, { status: 'completed', txHash });
        return;
      }

      if (!v3PoolService || !tokenA || !tokenB || !amountA || !amountB || !address || !positionManagerAddress) {
        throw new Error('Missing V3 pool creation requirements');
      }

      const mintContext = buildMintContext();
      if (!mintContext) {
        throw new Error('Unable to derive mint context for V3 pool');
      }

      if (stepId === 'initialize') {
        const initResult = await v3PoolService.initializePoolIfNeeded({
          positionManager: positionManagerAddress,
          token0: mintContext.token0,
          token1: mintContext.token1,
          fee: selectedFeeTier,
          sqrtPriceX96: mintContext.sqrtPriceForInit,
          biteEncryption: poolSettings?.biteEncryption,
          waitForReceipt: false,
        });

        initializationCompletedRef.current = true;

        if (initResult?.txHash && publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: initResult.txHash });
          setHash(initResult.txHash);
        }

        updateTransactionStep(stepId, {
          status: 'completed',
          txHash: initResult?.txHash,
        });

        setRequiresInitialization(false);

        return;
      }

      if (stepId === 'create') {
        const effectiveSqrtPrice = sqrtPriceX96 ?? mintContext.sqrtPriceForInit;

        console.log('V3 Pool creation parameters:', {
          isActive,
          tokenA: tokenA.symbol,
          tokenB: tokenB.symbol,
          amountADesired: mintContext.amountADesired.toString(),
          amountBDesired: mintContext.amountBDesired.toString(),
          amountAMin: mintContext.amountAMin.toString(),
          amountBMin: mintContext.amountBMin.toString(),
          feeTier: selectedFeeTier,
          tickLower,
          tickUpper,
          sqrtPriceX96: effectiveSqrtPrice?.toString(),
          priceRange: priceRangeSelection,
          chainId,
          positionManagerAddress,
        });

        const txHash = await v3PoolService.createPosition({
          tokenA: { ...tokenA, chainId: tokenA.chainId || chainId },
          tokenB: { ...tokenB, chainId: tokenB.chainId || chainId },
          fee: selectedFeeTier,
          tickLower,
          tickUpper,
          amountADesired: mintContext.amountADesired,
          amountBDesired: mintContext.amountBDesired,
          amountAMin: mintContext.amountAMin,
          amountBMin: mintContext.amountBMin,
          sqrtPriceX96: effectiveSqrtPrice,
        }, {
          slippageTolerance: poolSettings.slippage.value,
          deadline: Math.floor(Date.now() / 1000) + (poolSettings.deadline * 60),
          recipient: address,
          chainId,
          biteEncryption: poolSettings?.biteEncryption,
          skipInitialization: initializationCompletedRef.current || !requiresInitialization,
          waitForInitializationReceipt: false,
        });

        if (!txHash) {
          throw new Error('Mint transaction not sent');
        }

        initializationCompletedRef.current = true;
        setHash(txHash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }

        updateTransactionStep(stepId, { status: 'completed', txHash });
        onPoolCreated?.(txHash);
        return;
      }

      throw new Error(`Unknown transaction step: ${stepId}`);
    } catch (error) {
      console.error(`Error executing V3 step ${stepId}:`, error);
      updateTransactionStep(stepId, { status: 'error' });
      throw error;
    }
  }, [
    updateTransactionStep,
    approveTokenA,
    approveTokenB,
    buildMintContext,
    v3PoolService,
    tokenA,
    tokenB,
    amountA,
    amountB,
    address,
    positionManagerAddress,
    selectedFeeTier,
    poolSettings.biteEncryption,
    poolSettings.slippage.value,
    poolSettings.deadline,
    sqrtPriceX96,
    priceRangeSelection,
    chainId,
    isActive,
    setHash,
    publicClient,
    onPoolCreated,
    requiresInitialization,
  ]);

  const runSequentialSteps = useCallback(async (stepsToRun: V3TransactionStepId[]) => {
    if (stepsToRun.length === 0) {
      return;
    }

    setIsSequenceRunning(true);
    setIsConfirming(true);

    try {
      for (const stepId of stepsToRun) {
        await executeTransactionStep(stepId);
      }
    } finally {
      setIsSequenceRunning(false);
    }
  }, [executeTransactionStep, setIsConfirming]);

  const handleApproveStep = useCallback(async (stepId: Extract<V3TransactionStepId, 'approveA' | 'approveB'>) => {
    try {
      await runSequentialSteps([stepId]);
    } catch (error) {
      console.error(`V3 approval step ${stepId} failed:`, error);
    } finally {
      setIsConfirming(false);
    }
  }, [runSequentialSteps, setIsConfirming]);

  // Calculate price range ticks when price range selection changes
  useEffect(() => {
    if (!isActive) {
      return;
    }

    try {
      const spacing = getTickSpacing(selectedFeeTier);
      const { lower: fullLower, upper: fullUpper } = getFullRangeTicks(spacing);

      if (priceRangeSelection.type === 'full') {
        setTickLower(fullLower);
        setTickUpper(fullUpper);
        return;
      }

      const minPriceNum = Number(priceRangeSelection.minPrice);
      const maxPriceNum = Number(priceRangeSelection.maxPrice);

      const { lower, upper } = calculateCustomRangeTicks(minPriceNum, maxPriceNum, spacing);
      setTickLower(lower);
      setTickUpper(upper);
    } catch (error) {
      console.warn('Error calculating V3 ticks, reverting to full range:', error);
      try {
        const spacing = getTickSpacing(selectedFeeTier);
        const { lower, upper } = getFullRangeTicks(spacing);
        setTickLower(lower);
        setTickUpper(upper);
      } catch (innerError) {
        console.error('Failed to derive fallback ticks:', innerError);
        setTickLower(MIN_TICK);
        setTickUpper(MAX_TICK);
      }
    }
  }, [isActive, priceRangeSelection, selectedFeeTier]);

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
  const handleCreatePool = useCallback(async () => {
    if (!isActive) {
      console.log('V3 hook not active, skipping pool creation');
      return;
    }

    if (!tokenA || !tokenB) {
      console.warn('Tokens not selected for V3 pool creation');
      return;
    }

    const stepsToRun = transactionSteps
      .filter((step) => step.status !== 'completed')
      .map((step) => step.id);

    try {
      await runSequentialSteps(stepsToRun);
    } catch (error) {
      console.error('V3 pool creation sequence failed:', error);
    } finally {
      setIsConfirming(false);
    }
  }, [isActive, tokenA, tokenB, transactionSteps, runSequentialSteps, setIsConfirming]);

  const handleApproveTokenA = useCallback(async () => {
    await handleApproveStep('approveA');
  }, [handleApproveStep]);

  const handleApproveTokenB = useCallback(async () => {
    await handleApproveStep('approveB');
  }, [handleApproveStep]);

  // V3 state
  const state: V3PoolState = {
    selectedFeeTier,
    priceRangeSelection,
    tickLower,
    tickUpper,
    sqrtPriceX96,
    positionManagerAddress,
    v3PoolService,
    transactionSteps,
    isSequenceRunning,
  };

  // V3 actions
  const actions: V3PoolActions = {
    setSelectedFeeTier,
    setPriceRangeSelection,
    handleCreatePool,
    handleApproveTokenA,
    handleApproveTokenB,
  };

  return { state, actions };
};
