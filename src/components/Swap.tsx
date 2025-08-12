import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useChainId,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import TokenSelector from "./TokenSelector";
import { getTokens, getRouter } from "../config/config";
import { ERC20_ABI } from "../abi/ERC20";
import { UNISWAP_V2_ROUTER_ABI } from "../abi/UniswapV2Router";
import { readContract, writeContract } from "../web3/requests";

interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  name: string;
}

const Swap: React.FC = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const chainTokens = getTokens(chainId);
  const router = getRouter(chainId);

  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [isApproved, setIsApproved] = useState(false);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [balance, setBalance] = useState<bigint>(0n);
  const [balanceTo, setBalanceTo] = useState<bigint>(0n);
  const [amountsOut, setAmountsOut] = useState<readonly bigint[]>([]);
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);

  // Initialize tokens when chain changes
  useEffect(() => {
    const tokens = Object.values(chainTokens);
    if (tokens.length >= 2) {
      setFromToken({ ...tokens[0], chainId });
      setToToken({ ...tokens[1], chainId });
    }
  }, [chainTokens, chainId]);

  // Fetch contract data using custom functions
  useEffect(() => {
    const fetchAllowance = async () => {
      if (publicClient && fromToken && router && address) {
        try {
          const result = (await readContract(
            publicClient,
            ERC20_ABI,
            fromToken.address,
            "allowance",
            [address, router]
          )) as bigint;
          setAllowance(result);
        } catch (error) {
          console.error("Error fetching allowance:", error);
          setAllowance(0n);
        }
      }
    };

    fetchAllowance();
  }, [publicClient, fromToken, router, address]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (publicClient && fromToken && address) {
        try {
          const result = (await readContract(
            publicClient,
            ERC20_ABI,
            fromToken.address,
            "balanceOf",
            [address]
          )) as bigint;
          setBalance(result);
        } catch (error) {
          console.error("Error fetching balance:", error);
          setBalance(0n);
        }
      }
    };

    fetchBalance();
  }, [publicClient, fromToken, address]);

  useEffect(() => {
    const fetchBalanceTo = async () => {
      if (publicClient && toToken && address) {
        try {
          const result = (await readContract(
            publicClient,
            ERC20_ABI,
            toToken.address,
            "balanceOf",
            [address]
          )) as bigint;
          setBalanceTo(result);
        } catch (error) {
          console.error("Error fetching balance:", error);
          setBalanceTo(0n);
        }
      }
    };

    fetchBalanceTo();
  }, [publicClient, toToken, address]);

  useEffect(() => {
    const fetchAmountsOut = async () => {
      if (publicClient && router && fromAmount && fromToken && toToken) {
        try {
          const result = (await readContract(
            publicClient,
            UNISWAP_V2_ROUTER_ABI,
            router,
            "getAmountsOut",
            [
              parseUnits(fromAmount, fromToken.decimals),
              [fromToken.address, toToken.address],
            ]
          )) as readonly bigint[];
          setAmountsOut(result);
        } catch (error) {
          console.error("Error fetching amounts out:", error);
          setAmountsOut([]);
        }
      }
    };

    fetchAmountsOut();
  }, [publicClient, router, fromAmount, fromToken, toToken]);

  // Wait for transaction receipt
  const { isLoading: isTxConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Update approval status
  useEffect(() => {
    if (allowance && fromAmount && fromToken) {
      const requiredAmount = parseUnits(fromAmount, fromToken.decimals);
      setIsApproved(allowance >= requiredAmount);
    }
  }, [allowance, fromAmount, fromToken]);

  // Update toAmount when amountsOut changes
  useEffect(() => {
    if (amountsOut && amountsOut.length > 1 && toToken) {
      setToAmount(formatUnits(amountsOut[1], toToken.decimals));
    }
  }, [amountsOut, toToken]);

  // Reset confirming state when transaction is confirmed or fails
  useEffect(() => {
    if (isConfirmed || isTxConfirming === false) {
      setIsConfirming(false);
    }
  }, [isConfirmed, isTxConfirming]);

  const handleApprove = async () => {
    if (!fromToken || !fromAmount || !router || !walletClient) return;

    try {
      setIsConfirming(true);
      const txHash = await writeContract(
        walletClient,
        ERC20_ABI,
        fromToken.address,
        "approve",
        [router, parseUnits(fromAmount, fromToken.decimals)]
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error approving token:", error);
      setIsConfirming(false);
    }
  };

  const handleSwap = async () => {
    if (
      !fromToken ||
      !toToken ||
      !fromAmount ||
      !toAmount ||
      !address ||
      !router ||
      !walletClient
    )
      return;

    try {
      setIsConfirming(true);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes from now
      const amountIn = parseUnits(fromAmount, fromToken.decimals);
      const amountOutMin = parseUnits(
        (parseFloat(toAmount) * 0.99).toString(),
        toToken.decimals
      ); // 1% slippage

      const txHash = await writeContract(
        walletClient,
        UNISWAP_V2_ROUTER_ABI,
        router,
        "swapExactTokensForTokens",
        [
          amountIn,
          amountOutMin,
          [fromToken.address, toToken.address],
          address,
          deadline,
        ]
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error swapping tokens:", error);

      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }

      // Sometimes viem/ethers returns a `cause` or nested `error`
      if ((error as any).cause) {
        console.error("Cause:", (error as any).cause);
      }
      if ((error as any).data) {
        console.error("Error data:", (error as any).data);
      }
      if ((error as any).error) {
        console.error("Inner error:", (error as any).error);
      }

      setIsConfirming(false);
    }
  };

  const handleSwitchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount("");
  };

  return (
    <div className="swap-container">
      <div className="swap-form">
        <div className="token-inputs-wrapper">
          <div className="token-input-container">
            <div className="token-input-row">
              <div className="token-input-content">
                <input
                  className="amount-input"
                  type="number"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  placeholder="0"
                />
                <TokenSelector
                  selectedToken={fromToken}
                  onTokenSelect={setFromToken}
                  otherSelectedToken={toToken}
                  onTokenSwap={handleSwitchTokens}
                />
              </div>
              {balance && fromToken && (
                <div
                  className="balance-display"
                  onClick={() =>
                    setFromAmount(formatUnits(balance, fromToken.decimals))
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                    width="18"
                    height="18"
                  >
                    <path
                      fill="currentColor"
                      d="M15.6 4.6H1.85v-.55l12.1-.968v.968h1.65V2.4c0-1.21-.98-2.059-2.177-1.888L2.378 2.089C1.18 2.26.2 3.39.2 4.6v11a2.2 2.2 0 002.2 2.2h13.2a2.2 2.2 0 002.2-2.2V6.8a2.2 2.2 0 00-2.2-2.2zm-1.65 7.707a1.65 1.65 0 01-.63-3.176 1.65 1.65 0 11.63 3.176z"
                    ></path>
                  </svg>
                  <span>
                    {parseFloat(
                      formatUnits(balance, fromToken.decimals)
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="switch-container">
            <button className="switch-button" onClick={handleSwitchTokens}>
              ↕
            </button>
          </div>

          <div className="token-input-container">
            <div className="token-input-row">
              <div className="token-input-content">
                <input
                  className="amount-input"
                  type="number"
                  value={toAmount}
                  readOnly
                  placeholder="0"
                />
                <TokenSelector
                  selectedToken={toToken}
                  onTokenSelect={setToToken}
                  otherSelectedToken={fromToken}
                  onTokenSwap={handleSwitchTokens}
                />
              </div>
              {balanceTo && toToken && (
                <div
                  className="balance-display"
                  onClick={() =>
                    setFromAmount(formatUnits(balanceTo, toToken.decimals))
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                    width="18"
                    height="18"
                  >
                    <path
                      fill="currentColor"
                      d="M15.6 4.6H1.85v-.55l12.1-.968v.968h1.65V2.4c0-1.21-.98-2.059-2.177-1.888L2.378 2.089C1.18 2.26.2 3.39.2 4.6v11a2.2 2.2 0 002.2 2.2h13.2a2.2 2.2 0 002.2-2.2V6.8a2.2 2.2 0 00-2.2-2.2zm-1.65 7.707a1.65 1.65 0 01-.63-3.176 1.65 1.65 0 11.63 3.176z"
                    ></path>
                  </svg>
                  <span>
                    {parseFloat(
                      formatUnits(balanceTo, toToken.decimals)
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!address ? (
        <w3m-button />
      ) : !isApproved && fromAmount ? (
        <button
          className="approve-button"
          onClick={handleApprove}
          disabled={isConfirming}
        >
          {isConfirming ? "Approving..." : `Approve ${fromToken?.symbol}`}
        </button>
      ) : (
        <button
          className="swap-button"
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount || isConfirming}
        >
          {isConfirming ? "Swapping..." : "Swap"}
        </button>
      )}

      {isConfirmed && (
        <div className="success-message">Swap completed successfully!</div>
      )}
    </div>
  );
};

export default Swap;
