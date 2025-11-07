import { useState, useEffect, useMemo } from "react";
import { parseUnits } from "viem";
import { useChainId, useAccount, usePublicClient } from "wagmi";
import { getRouter } from "../../../config/config";
import type { PoolQuote } from "../services/pool";
import type { TransactionSettingsData } from "../../../hooks/useTransactionSettings";
import type { SharedPoolState, SharedPoolActions } from "./useSharedPoolLogic";

export type V2TransactionStepId = "approveA" | "approveB" | "create";

export type V2TransactionStepStatus = "pending" | "inProgress" | "completed" | "error";

export interface V2TransactionStep {
  id: V2TransactionStepId;
  label: string;
  status: V2TransactionStepStatus;
  txHash?: `0x${string}`;
}

export interface V2PoolState {
  // V2-specific state
  feeTier: 0.3; // Fixed V2 fee
  quote: PoolQuote | null;
  isLoadingQuote: boolean;
  
  // Router address
  routerAddress: `0x${string}` | undefined;
  transactionSteps: V2TransactionStep[];
  isSequenceRunning: boolean;
}

export interface V2PoolActions {
  // V2-specific actions
  handleCreatePool: () => Promise<void>;
}

export interface UseV2PoolLogicParams {
  sharedState: SharedPoolState;
  sharedActions: SharedPoolActions;
  poolSettings: TransactionSettingsData;
  setHash: (hash: `0x${string}` | undefined) => void;
  setIsConfirming: (confirming: boolean) => void;
  isActive: boolean;
  onPoolCreated?: (hash: `0x${string}`) => void;
}

/**
 * V2-specific pool logic hook
 * Handles: fixed 0.3% fee, V2 router interactions, LP token creation
 */
export const useV2PoolLogic = ({ 
  sharedState, 
  sharedActions,
  poolSettings, 
  setHash, 
  setIsConfirming,
  isActive,
  onPoolCreated
}: UseV2PoolLogicParams) => {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  
  // For V2: approvals and operations both use the same V2 router
  const routerAddress = getRouter(chainId);

  // V2-specific state
  const [quote, setQuote] = useState<PoolQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [transactionSteps, setTransactionSteps] = useState<V2TransactionStep[]>([]);
  const [isSequenceRunning, setIsSequenceRunning] = useState(false);

  const {
    tokenA,
    tokenB,
    amountA,
    amountB,
    poolService
  } = sharedState;

  const {
    handleApproveTokenA,
    handleApproveTokenB,
    needsApprovalA,
    needsApprovalB
  } = sharedActions;

  const baseSteps = useMemo<V2TransactionStep[]>(() => {
    if (!tokenA || !tokenB) {
      return [];
    }

    const steps: V2TransactionStep[] = [];

    if (needsApprovalA) {
      steps.push({
        id: "approveA",
        label: `Approve ${tokenA.symbol}`,
        status: "pending",
      });
    }

    if (needsApprovalB) {
      steps.push({
        id: "approveB",
        label: `Approve ${tokenB.symbol}`,
        status: "pending",
      });
    }

    steps.push({
      id: "create",
      label: "Create V2 Pool",
      status: "pending",
    });

    return steps;
  }, [tokenA, tokenB, needsApprovalA, needsApprovalB]);

  useEffect(() => {
    if (isSequenceRunning) {
      return;
    }

    setTransactionSteps((prev) => {
      const previousIds = prev.map((step) => step.id).join("|");
      const nextIds = baseSteps.map((step) => step.id).join("|");

      if (previousIds === nextIds) {
        return prev.map((step) => {
          const match = baseSteps.find((candidate) => candidate.id === step.id);
          return match ? { ...step, label: match.label } : step;
        });
      }

      return baseSteps;
    });
  }, [baseSteps, isSequenceRunning]);

  const updateTransactionStep = (
    id: V2TransactionStepId,
    updates: Partial<V2TransactionStep>
  ) => {
    setTransactionSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...updates } : step))
    );
  };

  const executeAddLiquidityStep = async (): Promise<`0x${string}` | undefined> => {
    if (!poolService || !tokenA || !tokenB || !amountA || !amountB || !address || !routerAddress) {
      console.error('Missing V2 pool creation requirements:', {
        poolService: !!poolService,
        tokenA: !!tokenA,
        tokenB: !!tokenB,
        amountA,
        amountB,
        address,
        routerAddress
      });
      return undefined;
    }

    try {
      const amountADesired = parseUnits(amountA, tokenA.decimals);
      const amountBDesired = parseUnits(amountB, tokenB.decimals);

      const minSlippage = Math.max(poolSettings.slippage.value, 5);
      const { amountAMin, amountBMin } = poolService.calculateMinAmounts(
        amountADesired,
        amountBDesired,
        minSlippage
      );

      console.log('V2 Pool creation amounts:', {
        tokenA: tokenA.symbol,
        tokenB: tokenB.symbol,
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        amountAMin: amountAMin.toString(),
        amountBMin: amountBMin.toString(),
        slippage: minSlippage,
        feeTier: '0.3%'
      });

      const txHash = await poolService.addLiquidity(
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        routerAddress,
        address,
        chainId,
        poolSettings?.deadline,
        poolSettings?.biteEncryption
      );
      setHash(txHash);
      return txHash;
    } catch (error) {
      console.error("Error creating V2 pool:", error);
      return undefined;
    }
  };

  // Get pool quote when amounts change (V2 logic)
  useEffect(() => {
    const fetchQuote = async () => {
      if (!isActive || !poolService || !routerAddress || !amountA || !amountB || !tokenA || !tokenB) {
        setQuote(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        const poolQuote = await poolService.getLiquidityQuote(
          amountA,
          amountB,
          tokenA,
          tokenB,
          routerAddress
        );
        
        setQuote(poolQuote);
      } catch (error) {
        console.error("Error fetching V2 pool quote:", error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [isActive, poolService, routerAddress, amountA, amountB, tokenA, tokenB]);

  // V2 Pool creation logic
  const handleCreatePool = async () => {
    console.log('V2 handleCreatePool called', { isActive });

    if (!isActive) {
      console.log('V2 hook not active, skipping pool creation');
      return;
    }

    if (baseSteps.length === 0) {
      console.warn('No transaction steps to execute for V2 pool creation');
      return;
    }

    const amountANumeric = amountA ? parseFloat(amountA) : Number.NaN;
    const amountBNumeric = amountB ? parseFloat(amountB) : Number.NaN;
    if (!Number.isFinite(amountANumeric) || !Number.isFinite(amountBNumeric) || amountANumeric <= 0 || amountBNumeric <= 0) {
      console.warn('Invalid deposit amounts for V2 pool creation');
      return;
    }

    const stepsToRun = baseSteps.map((step) => ({ ...step, status: 'pending' as V2TransactionStepStatus, txHash: undefined }));
    setTransactionSteps(stepsToRun);
    setIsSequenceRunning(true);

    let currentStepId: V2TransactionStepId | null = null;

    try {
      for (const step of stepsToRun) {
        currentStepId = step.id;
        updateTransactionStep(step.id, { status: 'inProgress', txHash: undefined });
        setIsConfirming(true);

        let txHash: `0x${string}` | undefined;

        if (step.id === 'approveA') {
          txHash = await handleApproveTokenA();
        } else if (step.id === 'approveB') {
          txHash = await handleApproveTokenB();
        } else {
          txHash = await executeAddLiquidityStep();
        }

        if (!txHash) {
          throw new Error(`Transaction not sent for step ${step.id}`);
        }

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash });
        }

        updateTransactionStep(step.id, { status: 'completed', txHash });
        setIsConfirming(false);

        if (step.id === 'create') {
          onPoolCreated?.(txHash);
        }
      }
    } catch (error) {
      console.error('Error executing V2 pool sequence:', error);
      if (currentStepId) {
        updateTransactionStep(currentStepId, { status: 'error' });
      }
      setIsConfirming(false);
    } finally {
      setIsSequenceRunning(false);
    }
  };

  // V2 state
  const state: V2PoolState = {
    feeTier: 0.3,
    quote,
    isLoadingQuote,
    routerAddress,
    transactionSteps,
    isSequenceRunning,
  };

  // V2 actions
  const actions: V2PoolActions = {
    handleCreatePool,
  };

  return { state, actions };
};
