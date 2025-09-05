import { useState, useEffect, useMemo } from "react";
import { parseUnits, formatUnits } from "viem";
import { useAccount, useWaitForTransactionReceipt, useChainId, useWalletClient, usePublicClient } from "wagmi";
import { createSwapService, type Token, type SwapQuote } from "../services/swap";
import { getTokens, getRouter, getAllTokensWithChain, createNativeToken, isNativeToken } from "../../../../config/config";
import { needsSwapApproval, getSwapApprovalTarget } from "../../../../utils/tokenUtils";
import type { TransactionSettingsData } from "../../../../hooks/useTransactionSettings";

export const useSwap = (swapSettings: TransactionSettingsData) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const chainTokens = getTokens(chainId);
  const router = getRouter(chainId);

  // State
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [balanceTo, setBalanceTo] = useState<bigint>(0n);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // Create service instance
  const swapService = useMemo(() => {
    if (!publicClient) return null;
    return createSwapService(publicClient, walletClient);
  }, [publicClient, walletClient]);

  // Wait for transaction receipt
  const { isLoading: isTxConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Initialize tokens when chain changes
  useEffect(() => {
    // Get native token for this chain
    const nativeToken = createNativeToken(chainId);
    const tokens = Object.values(chainTokens);
    
    if (nativeToken && tokens.length >= 1) {
      // Default: Native token → First ERC20 token
      setFromToken(nativeToken);
      setToToken(tokens[0]);
    } else if (tokens.length >= 2) {
      // Fallback: First two ERC20 tokens
      setFromToken(tokens[0]);
      setToToken(tokens[1]);
    }
  }, [chainTokens, chainId]);

  // Fetch allowance (skip for tokens that don't need approval)
  useEffect(() => {
    const fetchAllowance = async () => {
      if (!swapService || !fromToken || !router || !address) return;
      
      // Check if this swap needs approval using shared utility
      if (!needsSwapApproval(fromToken, toToken, chainId)) {
        setAllowance(BigInt(Number.MAX_SAFE_INTEGER)); // Set to max to indicate no approval needed
        return;
      }
      
      // Get the correct approval target (router vs WETH contract)
      const approvalTarget = getSwapApprovalTarget(fromToken, toToken, router, chainId);
      if (!approvalTarget) {
        setAllowance(0n);
        return;
      }
      
      const allowanceAmount = await swapService.getTokenAllowance(
        fromToken.address,
        address,
        approvalTarget
      );
      setAllowance(allowanceAmount);
    };

    fetchAllowance();
  }, [swapService, fromToken, toToken, router, address, chainId]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!swapService || !address) return;

      if (fromToken) {
        const fromBalance = await swapService.getTokenBalance(fromToken, address);
        setBalance(fromBalance);
      }

      if (toToken) {
        const toBalance = await swapService.getTokenBalance(toToken, address);
        setBalanceTo(toBalance);
      }
    };

    fetchBalances();
  }, [swapService, fromToken, toToken, address, isConfirmed]);

  // Get swap quote
  useEffect(() => {
    const fetchQuote = async () => {
      if (!swapService || !router || !fromAmount || !fromToken || !toToken) {
        setQuote(null);
        setToAmount("");
        return;
      }

      setIsLoadingQuote(true);
      try {
        const swapQuote = await swapService.getSwapQuote(
          fromAmount,
          fromToken,
          toToken,
          router,
          chainId,
          swapSettings.slippage.value
        );
        
        if (swapQuote) {
          setQuote(swapQuote);
          const formattedAmount = swapService.formatTokenAmount(
            swapQuote.amountOut,
            toToken.decimals,
            3
          );
          setToAmount(formattedAmount);
        } else {
          setQuote(null);
          setToAmount("");
        }
      } catch (error) {
        console.error("Error fetching quote:", error);
        setQuote(null);
        setToAmount("");
      } finally {
        setIsLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [swapService, router, fromAmount, fromToken, toToken]);

  // Update approval status
  useEffect(() => {
    if (!fromAmount || !fromToken) {
      setIsApproved(false);
      return;
    }

    // If no approval is needed for this swap type, set to approved
    if (!needsSwapApproval(fromToken, toToken, chainId)) {
      setIsApproved(true);
      return;
    }

    // For swaps that need approval, check the allowance
    if (!swapService || !allowance) {
      setIsApproved(false);
      return;
    }

    const requiredAmount = parseUnits(fromAmount, fromToken.decimals);
    setIsApproved(!swapService.isApprovalNeeded(allowance, requiredAmount));
  }, [swapService, allowance, fromAmount, fromToken, toToken, chainId]);

  // Reset confirming state when transaction is confirmed or fails
  useEffect(() => {
    if (isConfirmed || isTxConfirming === false) {
      setIsConfirming(false);
    }
  }, [isConfirmed, isTxConfirming]);

  // Actions
  const handleApprove = async () => {
    if (!swapService || !fromToken || !fromAmount || !router) return;

    // Get the correct approval target (router vs WETH contract)
    const approvalTarget = getSwapApprovalTarget(fromToken, toToken, router, chainId);
    if (!approvalTarget) {
      console.error("No approval target found");
      return;
    }

    try {
      setIsConfirming(true);
      const amount = parseUnits(fromAmount, fromToken.decimals);
      const txHash = await swapService.approveToken(fromToken.address, approvalTarget, amount, swapSettings?.biteEncryption);
      setHash(txHash);
    } catch (error) {
      console.error("Error approving token:", error);
      setIsConfirming(false);
    }
  };

  const handleSwap = async () => {
    if (!swapService || !fromToken || !toToken || !fromAmount || !quote || !address || !router) {
      return;
    }

    try {
      setIsConfirming(true);
      const amountIn = parseUnits(fromAmount, fromToken.decimals);
      
      const txHash = await swapService.executeSwap(
        amountIn,
        quote.minimumAmountOut,
        fromToken,
        toToken,
        router,
        address,
        chainId,
        swapSettings?.deadline,
        swapSettings?.biteEncryption
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error swapping tokens:", error);
      setIsConfirming(false);
    }
  };

  const handleSwitchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount("");
    setQuote(null);
  };

  const setMaxFromAmount = () => {
    if (fromToken && balance) {
      const maxAmount = formatUnits(balance, fromToken.decimals);
      setFromAmount(maxAmount);
    }
  };

  return {
    // State
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    isApproved,
    balance,
    balanceTo,
    quote,
    isConfirming,
    isConfirmed,
    isLoadingQuote,
    
    // Actions
    setFromToken,
    setToToken,
    setFromAmount,
    handleApprove,
    handleSwap,
    handleSwitchTokens,
    setMaxFromAmount,
    
    // Utils
    swapService,
  };
};
