import { useState, useEffect, useMemo } from "react";
import { parseUnits, formatUnits } from "viem";
import { useAccount, useWaitForTransactionReceipt, useChainId, useWalletClient, usePublicClient } from "wagmi";
import { createPoolService, type Token, type PoolQuote } from "../services/pool";
import { getTokens, getRouter } from "../../../config/config";
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
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");

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

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!poolService || !address) return;

      if (tokenA) {
        const balanceA = await poolService.getTokenBalance(tokenA.address, address);
        setBalanceA(balanceA);
      }

      if (tokenB) {
        const balanceB = await poolService.getTokenBalance(tokenB.address, address);
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
        const allowanceA = await poolService.getTokenAllowance(
          tokenA.address,
          address,
          router
        );
        setAllowanceA(allowanceA);
      }

      if (tokenB) {
        const allowanceB = await poolService.getTokenAllowance(
          tokenB.address,
          address,
          router
        );
        setAllowanceB(allowanceB);
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

    // Native tokens don't need approval
    if (poolService.isWrappedNativeToken(tokenA.symbol, chainId)) {
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

    // Native tokens don't need approval
    if (poolService.isWrappedNativeToken(tokenB.symbol, chainId)) {
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
      
      // Calculate minimum amounts with slippage protection
      const { amountAMin, amountBMin } = poolService.calculateMinAmounts(
        amountADesired,
        amountBDesired,
        poolSettings.slippage.value
      );
      
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
    const tempAmount = amountA;
    const tempBalance = balanceA;
    const tempAllowance = allowanceA;
    const tempApproved = isApprovedA;
    
    setTokenA(tokenB);
    setTokenB(tempToken);
    setAmountA(amountB);
    setAmountB(tempAmount);
    setBalanceA(balanceB);
    setBalanceB(tempBalance);
    setAllowanceA(allowanceB);
    setAllowanceB(tempAllowance);
    setIsApprovedA(isApprovedB);
    setIsApprovedB(tempApproved);
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

  const needsApprovalA = tokenA && amountA && parseFloat(amountA) > 0 && !isApprovedA;
  const needsApprovalB = tokenB && amountB && parseFloat(amountB) > 0 && !isApprovedB;

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
    
    // Computed
    canCreatePool,
    needsApprovalA,
    needsApprovalB,
    
    // Actions
    setTokenA,
    setTokenB,
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
