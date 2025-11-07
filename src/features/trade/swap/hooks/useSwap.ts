import { useState, useEffect, useMemo } from 'react';
import { parseUnits, formatUnits, encodeFunctionData } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useChainId, useWalletClient, usePublicClient } from 'wagmi';
import { UniswapService, type BestQuoteResult, type UniversalSwapOptions, type QuoteVersion } from '../../../../lib/uniswap';
import { getTokens, createNativeToken, getPermit2Address, getRouter, getV3SwapRouterAddress, type TokenConfig } from '../../../../config/config';
import type { TransactionSettingsData } from '../../../../hooks/useTransactionSettings';
import { ERC20_ABI } from '../../../../abi/ERC20';

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

  // Actions
  const handleApprove = async () => {
    if (!walletClient) {
      console.log('Wallet client not available for approval');
      return;
    }

    if (!fromToken || isNativeToken(fromToken)) {
      console.log('No approval needed for native token');
      return handleSwap();
    }

    if (!approvalTarget) {
      throw new Error(`Approval target not found for chain ${chainId}`);
    }

    try {
      setIsConfirming(true);
      
      // Approve maximum amount to the swap contract
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

      await handleSwap();
    } catch (error) {
      console.error('Error approving token:', error);
      setIsConfirming(false);
      throw error;
    }
  };

  const handleSwap = async () => {
    if (!uniswapService || !quote || !address || !fromToken) {
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setIsConfirming(false);
      return;
    }

    try {
      setIsConfirming(true);
      const swapOptions: UniversalSwapOptions = {
        slippageTolerance: swapSettings.slippage.value,
        deadline: Math.floor(Date.now() / 1000) + swapSettings.deadline * 60,
        recipient: address,
        amountIn: parseUnits(fromAmount, fromToken.decimals),
      };

      const txHash = await uniswapService.executeSwap(quote.quote, swapOptions);
      setSwapHash(txHash);
    } catch (error) {
      console.error('Error swapping tokens:', error);
      setIsConfirming(false);
      throw error;
    }
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
