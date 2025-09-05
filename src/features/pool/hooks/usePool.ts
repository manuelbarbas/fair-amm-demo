import { useState, useEffect, useMemo } from "react";
import { parseUnits, formatUnits } from "viem";
import { useAccount, useWaitForTransactionReceipt, useChainId, useWalletClient, usePublicClient } from "wagmi";
import { createPoolService, type Token, type PoolQuote } from "../services/pool";
import { getTokens, getRouter } from "../../../config/config";
import { usePoolBalance } from "./usePoolBalance";
import { needsPoolApproval, isInvalidPoolPair } from "../../../utils/tokenUtils";
import type { TransactionSettingsData } from "../../../hooks/useTransactionSettings";

export const usePool = (poolSettings: TransactionSettingsData) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const chainTokens = getTokens(chainId);
  const router = getRouter(chainId);

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

  // State for pool configuration
  const [selectedFeeTier, setSelectedFeeTier] = useState<number>(0.3);
  const [priceRangeOption, setPriceRangeOption] = useState<'full' | 'custom'>('full');

  // State for balances and allowances
  const [balanceA, setBalanceA] = useState<bigint>(0n);
  const [balanceB, setBalanceB] = useState<bigint>(0n);
  const [allowanceA, setAllowanceA] = useState<bigint>(0n);
  const [allowanceB, setAllowanceB] = useState<bigint>(0n);

  // State for approvals
  const [isApprovedA, setIsApprovedA] = useState(false);
  const [isApprovedB, setIsApprovedB] = useState(false);

  // State for pool operations
  const [quote, setQuote] = useState<PoolQuote | null>(null);
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

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
      if (!poolService || !router || !address) return;
      
      if (tokenA) {
        // Only fetch allowance for tokens that need approval
        if (needsPoolApproval(tokenA)) {
          const allowanceA = await poolService.getTokenAllowance(
            tokenA.address,
            address,
            router
          );
          setAllowanceA(allowanceA);
        } else {
          // Native tokens don't need allowance, set to max to indicate no approval needed
          setAllowanceA(BigInt(Number.MAX_SAFE_INTEGER));
        }
      }

      if (tokenB) {
        // Only fetch allowance for tokens that need approval
        if (needsPoolApproval(tokenB)) {
          const allowanceB = await poolService.getTokenAllowance(
            tokenB.address,
            address,
            router
          );
          setAllowanceB(allowanceB);
        } else {
          // Native tokens don't need allowance, set to max to indicate no approval needed
          setAllowanceB(BigInt(Number.MAX_SAFE_INTEGER));
        }
      }
    };

    fetchAllowances();
  }, [poolService, tokenA, tokenB, router, address]);

  // Get pool quote when amounts change
  useEffect(() => {
    const fetchQuote = async () => {
      if (!poolService || !router || !amountA || !amountB || !tokenA || !tokenB) {
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
          router
        );
        
        setQuote(poolQuote);
      } catch (error) {
        console.error("Error fetching pool quote:", error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [poolService, router, amountA, amountB, tokenA, tokenB]);

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
    setIsApprovedA(!poolService.isApprovalNeeded(allowanceA, requiredAmount));
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
    setIsApprovedB(!poolService.isApprovalNeeded(allowanceB, requiredAmount));
  }, [poolService, allowanceB, amountB, tokenB, chainId]);

  // Reset confirming state when transaction is confirmed or fails
  useEffect(() => {
    if (isConfirmed || isTxConfirming === false) {
      setIsConfirming(false);
    }
  }, [isConfirmed, isTxConfirming]);

  // Actions
  const handleApproveTokenA = async () => {
    if (!poolService || !tokenA || !amountA || !router) return;

    try {
      setIsConfirming(true);
      const amount = parseUnits(amountA, tokenA.decimals);
      const txHash = await poolService.approveToken(
        tokenA.address, 
        router, 
        amount, 
        poolSettings?.biteEncryption
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error approving token A:", error);
      setIsConfirming(false);
    }
  };

  const handleApproveTokenB = async () => {
    if (!poolService || !tokenB || !amountB || !router) return;

    try {
      setIsConfirming(true);
      const amount = parseUnits(amountB, tokenB.decimals);
      const txHash = await poolService.approveToken(
        tokenB.address, 
        router, 
        amount, 
        poolSettings?.biteEncryption
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error approving token B:", error);
      setIsConfirming(false);
    }
  };

  const handleCreatePool = async () => {
    if (!poolService || !tokenA || !tokenB || !amountA || !amountB || !quote || !address || !router) {
      return;
    }

    try {
      setIsConfirming(true);
      const amountADesired = parseUnits(amountA, tokenA.decimals);
      const amountBDesired = parseUnits(amountB, tokenB.decimals);
      
      // For new pools, use very liberal minimum amounts since there's no existing ratio to maintain
      // We'll use a small percentage (like 5%) or 1 wei minimum to prevent MEV attacks but allow pool creation
      const minSlippage = Math.max(poolSettings.slippage.value, 5); // Minimum 5% slippage for new pools
      const { amountAMin, amountBMin } = poolService.calculateMinAmounts(
        amountADesired,
        amountBDesired,
        minSlippage
      );
      
      console.log('Pool creation amounts:', {
        tokenA: tokenA.symbol,
        tokenB: tokenB.symbol,
        amountADesired: amountADesired.toString(),
        amountBDesired: amountBDesired.toString(),
        amountAMin: amountAMin.toString(),
        amountBMin: amountBMin.toString(),
        slippage: minSlippage
      });
      
      const txHash = await poolService.addLiquidity(
        tokenA,
        tokenB,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        router,
        address,
        chainId,
        poolSettings?.deadline,
        poolSettings?.biteEncryption
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error creating pool:", error);
      setIsConfirming(false);
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
    setQuote(null);
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
  const canCreatePool = tokenA && tokenB && amountA && amountB && 
    parseFloat(amountA) > 0 && parseFloat(amountB) > 0 && 
    isApprovedA && isApprovedB;

  const needsApprovalA = tokenA && amountA && parseFloat(amountA) > 0 && needsPoolApproval(tokenA) && !isApprovedA;
  const needsApprovalB = tokenB && amountB && parseFloat(amountB) > 0 && needsPoolApproval(tokenB) && !isApprovedB;

  return {
    // State
    tokenA,
    tokenB,
    amountA,
    amountB,
    selectedFeeTier,
    priceRangeOption,
    balanceA,
    balanceB,
    isApprovedA,
    isApprovedB,
    quote,
    isConfirming,
    isConfirmed,
    isLoadingQuote,
    isLoadingPrices,
    balanceError,
    
    // Computed
    canCreatePool,
    needsApprovalA,
    needsApprovalB,
    
    // Actions
    setTokenA: setTokenAWithValidation,
    setTokenB: setTokenBWithValidation,
    setAmountA,
    setAmountB,
    setSelectedFeeTier,
    setPriceRangeOption,
    handleApproveTokenA,
    handleApproveTokenB,
    handleCreatePool,
    handleTokenSwap,
    setMaxAmountA,
    setMaxAmountB,
    
    // Utils
    poolService,
  };
};
