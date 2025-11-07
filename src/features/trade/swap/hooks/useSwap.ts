import { useState, useEffect, useMemo } from 'react';
import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useChainId, useWalletClient, usePublicClient } from 'wagmi';
import { UniswapService, type BestQuoteResult, type UniversalSwapOptions, type QuoteVersion } from '../../../../lib/uniswap';
import { getTokens, createNativeToken, getPermit2Address, getRouter, getV3SwapRouterAddress, type TokenConfig } from '../../../../config/config';
import type { TransactionSettingsData } from '../../../../hooks/useTransactionSettings';
import { ERC20_ABI } from '../../../../abi/ERC20';

export type SwapTransactionStepId = 'approve' | 'swap';

export type SwapTransactionStepStatus =
  | 'pending'
  | 'inProgress'
  | 'completed'
  | 'error';

export interface SwapTransactionStep {
  id: SwapTransactionStepId;
  label: string;
  status: SwapTransactionStepStatus;
  txHash?: `0x${string}`;
}

// Helper function to check if a token is native (has zero address)
const isNativeToken = (token: TokenConfig): boolean => {
  return token.address === '0x0000000000000000000000000000000000000000';
};

export const useSwap = (swapSettings: TransactionSettingsData) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const chainTokens = getTokens(chainId);

  // State
  const [fromToken, setFromToken] = useState<TokenConfig | null>(null);
  const [toToken, setToToken] = useState<TokenConfig | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [balanceTo, setBalanceTo] = useState<bigint>(0n);
  const [quote, setQuote] = useState<BestQuoteResult | null>(null);
  const [swapHash, setSwapHash] = useState<`0x${string}` | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [transactionSteps, setTransactionSteps] = useState<SwapTransactionStep[]>([]);
  const [isSequenceRunning, setIsSequenceRunning] = useState(false);

  // Create service instance
  const uniswapService = useMemo(() => {
    if (!publicClient) return null;
    return UniswapService.create(publicClient, walletClient || undefined);
  }, [publicClient, walletClient]);

  const approvalTarget = useMemo<`0x${string}` | undefined>(() => {
    if (!chainId) return undefined;

    const resolveTarget = (version?: QuoteVersion | undefined): `0x${string}` | undefined => {
      if (version === 'v2') {
        return getRouter(chainId);
      }
      if (version === 'v3') {
        return getV3SwapRouterAddress(chainId);
      }
      return getRouter(chainId) ?? getV3SwapRouterAddress(chainId) ?? getPermit2Address(chainId);
    };

    return resolveTarget(quote?.quote.version);
  }, [chainId, quote?.quote.version]);

  const needsApproval = useMemo(() => {
    if (!fromToken) {
      return false;
    }

    if (isNativeToken(fromToken)) {
      return false;
    }

    return !isApproved;
  }, [fromToken, isApproved]);

  const baseSteps = useMemo<SwapTransactionStep[]>(() => {
    if (!fromToken || !toToken) {
      return [];
    }

    const steps: SwapTransactionStep[] = [];

    if (needsApproval) {
      steps.push({
        id: 'approve',
        label: `Approve ${fromToken.symbol}`,
        status: 'pending',
      });
    }

    steps.push({
      id: 'swap',
      label: `Swap ${fromToken.symbol} for ${toToken.symbol}`,
      status: 'pending',
    });

    return steps;
  }, [fromToken, toToken, needsApproval]);

  useEffect(() => {
    if (isSequenceRunning) {
      return;
    }

    setTransactionSteps((prev) => {
      const previousIds = prev.map((step) => step.id).join('|');
      const nextIds = baseSteps.map((step) => step.id).join('|');

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
    id: SwapTransactionStepId,
    updates: Partial<SwapTransactionStep>
  ) => {
    setTransactionSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, ...updates } : step))
    );
  };

  // Wait for transaction receipt
  const { isLoading: isTxConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  // Initialize tokens when chain changes
  useEffect(() => {
    const nativeTokenConfig = createNativeToken(chainId);
    const tokens = Object.values(chainTokens);

    if (nativeTokenConfig && tokens.length >= 1) {
      setFromToken(nativeTokenConfig);
      setToToken(tokens[0] as TokenConfig);
    } else if (tokens.length >= 2) {
      setFromToken(tokens[0] as TokenConfig);
      setToToken(tokens[1] as TokenConfig);
    }
  }, [chainId, chainTokens]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!publicClient || !address) return;

      const fetchBalance = async (token: TokenConfig): Promise<bigint> => {
        try {
          if (isNativeToken(token)) {
            // Native token
            return await publicClient.getBalance({ address });
          } else {
            // ERC20 token
            return (await publicClient.readContract({
              address: token.address,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address],
            })) as bigint;
          }
        } catch (error) {
          console.error(`Error fetching balance for ${token.symbol}:`, error);
          return 0n;
        }
      };

      if (fromToken) {
        const fromBalance = await fetchBalance(fromToken);
        setBalance(fromBalance);
      }
      if (toToken) {
        const toBalance = await fetchBalance(toToken);
        setBalanceTo(toBalance);
      }
    };

    fetchBalances();
  }, [publicClient, address, fromToken, toToken, isConfirmed]);

  // Check token allowance for the active swap target
  useEffect(() => {
    const checkAllowance = async () => {
      if (!publicClient || !address || !fromToken || isNativeToken(fromToken)) {
        setAllowance(BigInt(Number.MAX_SAFE_INTEGER));
        setIsApproved(true);
        return;
      }

      if (!approvalTarget) {
        console.warn('Approval target not found for chain', chainId, 'and quote version', quote?.quote.version);
        setAllowance(0n);
        setIsApproved(false);
        return;
      }

      try {
        const allowanceAmount = (await publicClient.readContract({
          address: fromToken.address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, approvalTarget],
        })) as bigint;

        setAllowance(allowanceAmount);
        
        // Check if allowance is sufficient
        if (fromAmount && parseFloat(fromAmount) > 0) {
          const requiredAmount = parseUnits(fromAmount, fromToken.decimals);
          setIsApproved(allowanceAmount >= requiredAmount);
        } else {
          setIsApproved(allowanceAmount > 0n);
        }
      } catch (error) {
        console.error('Error checking allowance:', error);
        setAllowance(0n);
        setIsApproved(false);
      }
    };

    checkAllowance();
  }, [publicClient, address, fromToken, chainId, fromAmount, isConfirmed, approvalTarget, quote?.quote.version]);

  // Get swap quote with debouncing
  useEffect(() => {
    const fetchQuote = async () => {
      if (!uniswapService || !fromAmount || !fromToken || !toToken || parseFloat(fromAmount) <= 0) {
        setQuote(null);
        setToAmount('');
        return;
      }

      setIsLoadingQuote(true);
      try {
        const swapQuote = await uniswapService.getQuoteFromTokenConfig(
          fromToken,
          toToken,
          fromAmount
        );

        if (swapQuote) {
          setQuote(swapQuote);
          // Format the output amount from the best quote
          const outputAmount = swapQuote.quote.amountOut;
          const formattedAmount = formatUnits(outputAmount, toToken.decimals);
          setToAmount(parseFloat(formattedAmount).toFixed(6));
        } else {
          setQuote(null);
          setToAmount('');
        }
      } catch (error) {
        console.error('Error fetching quote:', error);
        setQuote(null);
        setToAmount('');
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [uniswapService, fromAmount, fromToken, toToken]);

  // Reset confirming state when transaction is confirmed or fails
  useEffect(() => {
    if (isConfirmed) {
      setIsConfirming(false);
      // Reset form after successful swap
      setFromAmount('');
      setToAmount('');
      setQuote(null);
    }
    if (isTxConfirming === false && !isConfirmed) {
      setIsConfirming(false);
    }
  }, [isConfirmed, isTxConfirming]);

  const performApproval = async (): Promise<`0x${string}` | undefined> => {
    if (!walletClient) {
      throw new Error('Wallet client not available for approval');
    }

    if (!fromToken || isNativeToken(fromToken)) {
      return undefined;
    }

    if (!approvalTarget) {
      throw new Error(`Approval target not found for chain ${chainId}`);
    }

    const maxAmount = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

    const txHash = await walletClient.sendTransaction({
      account: walletClient.account!,
      to: fromToken.address as `0x${string}`,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [approvalTarget, maxAmount],
      }),
      chain: walletClient.chain,
    });

    if (!publicClient) {
      throw new Error('Public client not available to confirm approval');
    }

    await publicClient.waitForTransactionReceipt({ hash: txHash });

    setAllowance(maxAmount);
    setIsApproved(true);

    return txHash;
  };

  const performSwap = async (): Promise<`0x${string}` | undefined> => {
    if (!uniswapService || !quote || !address || !fromToken) {
      return undefined;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      return undefined;
    }

    const swapOptions: UniversalSwapOptions = {
      slippageTolerance: swapSettings.slippage.value,
      deadline: Math.floor(Date.now() / 1000) + swapSettings.deadline * 60,
      recipient: address,
      amountIn: parseUnits(fromAmount, fromToken.decimals),
    };

    const txHash = await uniswapService.executeSwap(quote.quote, swapOptions);
    setSwapHash(txHash);

    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    }

    return txHash;
  };

  const runSwapSequence = async (includeApproval: boolean) => {
    if (!fromToken || !toToken) {
      return;
    }

    const stepsToExecute = baseSteps.filter(
      (step) => includeApproval || step.id !== 'approve'
    );

    if (stepsToExecute.length === 0) {
      return;
    }

    const requiresSwapStep = stepsToExecute.some((step) => step.id === 'swap');
    const amountNumeric = fromAmount ? parseFloat(fromAmount) : Number.NaN;

    if (
      requiresSwapStep &&
      (!Number.isFinite(amountNumeric) || amountNumeric <= 0)
    ) {
      console.warn('Invalid swap amount');
      return;
    }

    setTransactionSteps(
      stepsToExecute.map((step) => ({ ...step, status: 'pending', txHash: undefined }))
    );
    setIsSequenceRunning(true);
    setIsConfirming(true);

    let currentStepId: SwapTransactionStepId | null = null;

    try {
      for (const step of stepsToExecute) {
        currentStepId = step.id;
        updateTransactionStep(step.id, { status: 'inProgress', txHash: undefined });

        let txHash: `0x${string}` | undefined;

        if (step.id === 'approve') {
          txHash = await performApproval();
        } else {
          txHash = await performSwap();
        }

        if (!txHash) {
          throw new Error(`Transaction not sent for step ${step.id}`);
        }

        updateTransactionStep(step.id, { status: 'completed', txHash });
      }
    } catch (error) {
      console.error('Error executing swap sequence:', error);
      if (currentStepId) {
        updateTransactionStep(currentStepId, { status: 'error' });
      }
      throw error;
    } finally {
      setIsSequenceRunning(false);
      setIsConfirming(false);
    }
  };

  // Actions
  const handleApprove = async () => {
    return runSwapSequence(true);
  };

  const handleSwap = async () => {
    return runSwapSequence(false);
  };

  const handleSwitchTokens = () => {
    const oldFromToken = fromToken;
    const oldToToken = toToken;
    
    setFromToken(oldToToken);
    setToToken(oldFromToken);
    setFromAmount(toAmount);
    setToAmount('');
    setQuote(null);
  };

  const setMaxFromAmount = () => {
    if (fromToken && balance && balance > 0n) {
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
    allowance,
    balance,
    balanceTo,
    quote,
    isConfirming,
    isConfirmed,
    isLoadingQuote,
    transactionSteps,
    isSequenceRunning,
    hash: swapHash,

    // Actions
    setFromToken,
    setToToken,
    setFromAmount,
    handleApprove,
    handleSwap,
    handleSwitchTokens,
    setMaxFromAmount,
  };
};
