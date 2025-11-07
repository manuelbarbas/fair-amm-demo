import { useState, useEffect, useMemo } from "react";
import { parseUnits, formatUnits } from "viem";
import { useAccount, useWaitForTransactionReceipt, useChainId, useWalletClient, usePublicClient } from "wagmi";
import { createPoolService, type Token } from "../services/pool";
import { getTokens } from "../../../config/config";
import { usePoolBalance } from "./usePoolBalance";
import { needsPoolApproval, isInvalidPoolPair } from "../../../utils/tokenUtils";
import type { TransactionSettingsData } from "../../../hooks/useTransactionSettings";

export interface SharedPoolState {
  // Token state
  tokenA: Token | null;
  tokenB: Token | null;
  
  // Amount state (from usePoolBalance)
  amountA: string;
  amountB: string;
  
  // Balance state
  balanceA: bigint;
  balanceB: bigint;
  
  // Approval state
  isApprovedA: boolean;
  isApprovedB: boolean;
  allowanceA: bigint;
  allowanceB: bigint;
  
  // Transaction state
  hash: `0x${string}` | undefined;
  isConfirming: boolean;
  isConfirmed: boolean;
  isTxConfirming: boolean;
  
  // Loading states
  isLoadingPrices: boolean;
  balanceError: string | null;
  
  // Pool service
  poolService: any;
}

export interface SharedPoolActions {
  // Token actions
  setTokenA: (token: Token | null) => void;
  setTokenB: (token: Token | null) => void;
  handleTokenSwap: () => void;
  
  // Amount actions
  setAmountA: (amount: string) => void;
  setAmountB: (amount: string) => void;
  setMaxAmountA: () => void;
  setMaxAmountB: () => void;
  
  // Approval actions
  handleApproveTokenA: () => Promise<`0x${string}` | undefined>;
  handleApproveTokenB: () => Promise<`0x${string}` | undefined>;
  
  // Computed values
  needsApprovalA: boolean;
  needsApprovalB: boolean;
  canCreatePool: boolean;
}

export interface UseSharedPoolLogicParams {
  poolSettings: TransactionSettingsData;
  routerAddress?: `0x${string}`;
}

/**
 * Shared pool logic hook containing common functionality for both V2 and V3 pools
 * Handles: token management, balances, approvals, transaction state
 * 
 * APPROVAL FLOW:
 * - V2: Direct approval to V2 Router (traditional ERC20 approve)
 * - V3: Approval to the NonfungiblePositionManager (direct ERC20 approve)
 */
export const useSharedPoolLogic = ({ 
  poolSettings, 
  routerAddress 
}: UseSharedPoolLogicParams) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const chainTokens = getTokens(chainId);

  // State for tokens
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  
  // Use pool balance hook for automatic amount balancing
  const {
    amountA,
    amountB,
    setAmountA,
    setAmountB,
    isLoadingPrices,
    error: balanceError
  } = usePoolBalance({ tokenA, tokenB });

  // State for balances and allowances
  const [balanceA, setBalanceA] = useState<bigint>(0n);
  const [balanceB, setBalanceB] = useState<bigint>(0n);
  const [allowanceA, setAllowanceA] = useState<bigint>(0n);
  const [allowanceB, setAllowanceB] = useState<bigint>(0n);

  // State for approvals
  const [isApprovedA, setIsApprovedA] = useState(false);
  const [isApprovedB, setIsApprovedB] = useState(false);

  // State for transactions
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);

  // Create service instance
  const poolService = useMemo(() => {
    if (!publicClient) return null;
    return createPoolService(publicClient, walletClient);
  }, [publicClient, walletClient]);

  // Wait for transaction receipt
  const { isLoading: isTxConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Initialize tokens when chain changes
  useEffect(() => {
    const tokens = Object.values(chainTokens);
    if (tokens.length >= 2) {
      setTokenA({ ...tokens[0], chainId });
      setTokenB({ ...tokens[1], chainId });
    }
  }, [chainTokens, chainId]);

  // Enhanced token setters with validation
  const setTokenAWithValidation = (token: Token | null) => {
    setTokenA(token);
    
    // If selecting a token that creates invalid pair, reset the other token
    if (token && tokenB && isInvalidPoolPair(token, tokenB, chainId)) {
      setTokenB(null);
    }
  };

  const setTokenBWithValidation = (token: Token | null) => {
    setTokenB(token);
    
    // If selecting a token that creates invalid pair, reset the other token
    if (token && tokenA && isInvalidPoolPair(tokenA, token, chainId)) {
      setTokenA(null);
    }
  };

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!poolService || !address) return;

      if (tokenA) {
        const balanceA = await poolService.getTokenBalance(tokenA, address);
        setBalanceA(balanceA);
      }

      if (tokenB) {
        const balanceB = await poolService.getTokenBalance(tokenB, address);
        setBalanceB(balanceB);
      }
    };

    fetchBalances();
  }, [poolService, tokenA, tokenB, address, isConfirmed]);

  // Fetch allowances
  useEffect(() => {
    const fetchAllowances = async () => {
      if (!poolService || !routerAddress || !address) return;
      
      console.log('Fetching allowances for approval target:', {
        routerAddress,
        targetType: routerAddress?.toLowerCase().includes('permit2') ? 'Permit2' : 'Router',
        tokenA: tokenA?.symbol,
        tokenB: tokenB?.symbol
      });
      
      if (tokenA) {
        // Only fetch allowance for tokens that need approval
        if (needsPoolApproval(tokenA)) {
          const allowanceA = await poolService.getTokenAllowance(
            tokenA.address,
            address,
            routerAddress
          );
          console.log(`Token A (${tokenA.symbol}) allowance:`, allowanceA.toString());
          setAllowanceA(allowanceA);
        } else {
          // Native tokens don't need allowance, set to max to indicate no approval needed
          console.log(`Token A (${tokenA.symbol}) is native - no approval needed`);
          setAllowanceA(BigInt(Number.MAX_SAFE_INTEGER));
        }
      }

      if (tokenB) {
        // Only fetch allowance for tokens that need approval
        if (needsPoolApproval(tokenB)) {
          const allowanceB = await poolService.getTokenAllowance(
            tokenB.address,
            address,
            routerAddress
          );
          console.log(`Token B (${tokenB.symbol}) allowance:`, allowanceB.toString());
          setAllowanceB(allowanceB);
        } else {
          // Native tokens don't need allowance, set to max to indicate no approval needed
          console.log(`Token B (${tokenB.symbol}) is native - no approval needed`);
          setAllowanceB(BigInt(Number.MAX_SAFE_INTEGER));
        }
      }
    };

    fetchAllowances();
  }, [poolService, tokenA, tokenB, routerAddress, address, isConfirmed]);

  // Update approval status for token A
  useEffect(() => {
    if (!poolService || !amountA || !tokenA) {
      setIsApprovedA(false);
      return;
    }

    // Check if token needs approval using shared utility
    if (!needsPoolApproval(tokenA)) {
      setIsApprovedA(true);
      return;
    }

    if (!allowanceA) {
      setIsApprovedA(false);
      return;
    }

    const requiredAmount = parseUnits(amountA, tokenA.decimals);
    const isApprovalNeeded = poolService.isApprovalNeeded(allowanceA, requiredAmount);
    const approved = !isApprovalNeeded;
    console.log(`Token A (${tokenA.symbol}) approval status:`, {
      allowance: allowanceA.toString(),
      required: requiredAmount.toString(),
      isApprovalNeeded,
      approved
    });
    setIsApprovedA(approved);
  }, [poolService, allowanceA, amountA, tokenA, chainId]);

  // Update approval status for token B
  useEffect(() => {
    if (!poolService || !amountB || !tokenB) {
      setIsApprovedB(false);
      return;
    }

    // Check if token needs approval using shared utility
    if (!needsPoolApproval(tokenB)) {
      setIsApprovedB(true);
      return;
    }

    if (!allowanceB) {
      setIsApprovedB(false);
      return;
    }

    const requiredAmount = parseUnits(amountB, tokenB.decimals);
    const isApprovalNeeded = poolService.isApprovalNeeded(allowanceB, requiredAmount);
    const approved = !isApprovalNeeded;
    console.log(`Token B (${tokenB.symbol}) approval status:`, {
      allowance: allowanceB.toString(),
      required: requiredAmount.toString(),
      isApprovalNeeded,
      approved
    });
    setIsApprovedB(approved);
  }, [poolService, allowanceB, amountB, tokenB, chainId]);

  // Reset confirming state when transaction is confirmed or fails
  useEffect(() => {
    if (isConfirmed || isTxConfirming === false) {
      setIsConfirming(false);
    }
  }, [isConfirmed, isTxConfirming]);

  // Actions
  const handleApproveTokenA = async (): Promise<`0x${string}` | undefined> => {
    if (!poolService || !tokenA || !amountA || !routerAddress) return undefined;

    console.log('Approving Token A to:', {
      token: tokenA.symbol,
      target: routerAddress,
      amount: amountA,
      targetType: routerAddress?.toLowerCase().includes('permit2') ? 'Permit2' : 'Router'
    });

    try {
      setIsConfirming(true);
      const amount = parseUnits(amountA, tokenA.decimals);
      const txHash = await poolService.approveToken(
        tokenA.address, 
        routerAddress, 
        amount, 
        poolSettings?.biteEncryption
      );
      setHash(txHash);
      return txHash;
    } catch (error) {
      console.error("Error approving token A:", error);
      setIsConfirming(false);
      return undefined;
    }
  };

  const handleApproveTokenB = async (): Promise<`0x${string}` | undefined> => {
    if (!poolService || !tokenB || !amountB || !routerAddress) return undefined;

    console.log('Approving Token B to:', {
      token: tokenB.symbol,
      target: routerAddress,
      amount: amountB,
      targetType: routerAddress?.toLowerCase().includes('permit2') ? 'Permit2' : 'Router'
    });

    try {
      setIsConfirming(true);
      const amount = parseUnits(amountB, tokenB.decimals);
      const txHash = await poolService.approveToken(
        tokenB.address, 
        routerAddress, 
        amount, 
        poolSettings?.biteEncryption
      );
      setHash(txHash);
      return txHash;
    } catch (error) {
      console.error("Error approving token B:", error);
      setIsConfirming(false);
      return undefined;
    }
  };

  const handleTokenSwap = () => {
    const tempToken = tokenA;
    const tempBalance = balanceA;
    const tempAllowance = allowanceA;
    const tempApproved = isApprovedA;
    
    setTokenA(tokenB);
    setTokenB(tempToken);
    setBalanceA(balanceB);
    setBalanceB(tempBalance);
    setAllowanceA(allowanceB);
    setAllowanceB(tempAllowance);
    setIsApprovedA(isApprovedB);
    setIsApprovedB(tempApproved);
    
    // Clear amounts as usePoolBalance will handle recalculation
    setAmountA("");
    setAmountB("");
  };

  const setMaxAmountA = () => {
    if (tokenA && balanceA) {
      const maxAmount = formatUnits(balanceA, tokenA.decimals);
      setAmountA(maxAmount);
    }
  };

  const setMaxAmountB = () => {
    if (tokenB && balanceB) {
      const maxAmount = formatUnits(balanceB, tokenB.decimals);
      setAmountB(maxAmount);
    }
  };

  // Computed values
  const needsApprovalA = tokenA && amountA && parseFloat(amountA) > 0 && needsPoolApproval(tokenA) && !isApprovedA;
  const needsApprovalB = tokenB && amountB && parseFloat(amountB) > 0 && needsPoolApproval(tokenB) && !isApprovedB;
  
  const canCreatePool = tokenA && tokenB && amountA && amountB && 
    parseFloat(amountA) > 0 && parseFloat(amountB) > 0 && 
    isApprovedA && isApprovedB;

  // Debug final computed values
  console.log('Pool creation status:', {
    tokenA: tokenA?.symbol,
    tokenB: tokenB?.symbol,
    amountA,
    amountB,
    isApprovedA,
    isApprovedB,
    needsApprovalA,
    needsApprovalB,
    canCreatePool
  });

  // Return state and actions
  const state: SharedPoolState = {
    tokenA,
    tokenB,
    amountA,
    amountB,
    balanceA,
    balanceB,
    isApprovedA,
    isApprovedB,
    allowanceA,
    allowanceB,
    hash,
    isConfirming,
    isConfirmed,
    isTxConfirming,
    isLoadingPrices,
    balanceError,
    poolService,
  };

  const actions: SharedPoolActions = {
    setTokenA: setTokenAWithValidation,
    setTokenB: setTokenBWithValidation,
    handleTokenSwap,
    setAmountA,
    setAmountB,
    setMaxAmountA,
    setMaxAmountB,
    handleApproveTokenA,
    handleApproveTokenB,
    needsApprovalA: Boolean(needsApprovalA),
    needsApprovalB: Boolean(needsApprovalB),
    canCreatePool: Boolean(canCreatePool),
  };

  return { state, actions };
};
