import React, { useState, useEffect } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useChainId,
  useWalletClient,
  usePublicClient
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import TokenSelector from "./TokenSelector";
import { getTokens, getRouter, isNativeWrappedToken, getNativeTokens } from "../config/config";
import { ERC20_ABI } from "../abi/ERC20";
import { UNISWAP_V2_ROUTER_ABI } from "../abi/UniswapV2Router";
import { readContract, writeContract } from "../web3/requests"

interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  name: string;
}

const Liquidity: React.FC = () => {
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const chainTokens = getTokens(chainId);
  const router = getRouter(chainId);

  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [isTokenAApproved, setIsTokenAApproved] = useState(false);
  const [isTokenBApproved, setIsTokenBApproved] = useState(false);
  const [allowanceA, setAllowanceA] = useState<bigint>(0n);
  const [allowanceB, setAllowanceB] = useState<bigint>(0n);
  const [balanceA, setBalanceA] = useState<bigint>(0n);
  const [balanceB, setBalanceB] = useState<bigint>(0n);
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);

  // Initialize tokens when chain changes
  useEffect(() => {
    const tokens = Object.values(chainTokens);
    if (tokens.length >= 2) {
      setTokenA({ ...tokens[0], chainId });
      setTokenB({ ...tokens[1], chainId });
    }
  }, [chainTokens, chainId]);

  // Fetch contract data using custom functions
  useEffect(() => {
    const fetchAllowanceA = async () => {
      if (publicClient && tokenA && router && address) {
        try {
          const result = await readContract(
            publicClient,
            ERC20_ABI,
            tokenA.address,
            "allowance",
            [address, router]
          ) as bigint;
          setAllowanceA(result);
        } catch (error) {
          console.error("Error fetching allowanceA:", error);
          setAllowanceA(0n);
        }
      }
    };

    fetchAllowanceA();
  }, [publicClient, tokenA, router, address]);

  useEffect(() => {
    const fetchAllowanceB = async () => {
      if (publicClient && tokenB && router && address) {
        try {
          const result = await readContract(
            publicClient,
            ERC20_ABI,
            tokenB.address,
            "allowance",
            [address, router]
          ) as bigint;
          setAllowanceB(result);
        } catch (error) {
          console.error("Error fetching allowanceB:", error);
          setAllowanceB(0n);
        }
      }
    };

    fetchAllowanceB();
  }, [publicClient, tokenB, router, address]);

  useEffect(() => {
    const fetchBalanceA = async () => {
      if (publicClient && tokenA && address) {
        try {
          const result = await readContract(
            publicClient,
            ERC20_ABI,
            tokenA.address,
            "balanceOf",
            [address]
          ) as bigint;
          setBalanceA(result);
        } catch (error) {
          console.error("Error fetching balanceA:", error);
          setBalanceA(0n);
        }
      }
    };

    fetchBalanceA();
  }, [publicClient, tokenA, address]);

  useEffect(() => {
    const fetchBalanceB = async () => {
      if (publicClient && tokenB && address) {
        try {
          const result = await readContract(
            publicClient,
            ERC20_ABI,
            tokenB.address,
            "balanceOf",
            [address]
          ) as bigint;
          setBalanceB(result);
        } catch (error) {
          console.error("Error fetching balanceB:", error);
          setBalanceB(0n);
        }
      }
    };

    fetchBalanceB();
  }, [publicClient, tokenB, address]);

  // Wait for transaction receipt
  const { isLoading: isTxConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  // Update approval status for token A
  useEffect(() => {
    if (allowanceA && amountA && tokenA) {
      const requiredAmount = parseUnits(amountA, tokenA.decimals);
      setIsTokenAApproved(allowanceA >= requiredAmount);
    }
  }, [allowanceA, amountA, tokenA]);

  // Update approval status for token B
  useEffect(() => {
    if (allowanceB && amountB && tokenB) {
      const requiredAmount = parseUnits(amountB, tokenB.decimals);
      setIsTokenBApproved(allowanceB >= requiredAmount);
    }
  }, [allowanceB, amountB, tokenB]);

  // Reset confirming state when transaction is confirmed or fails
  useEffect(() => {
    if (isConfirmed || isTxConfirming === false) {
      setIsConfirming(false);
    }
  }, [isConfirmed, isTxConfirming]);

  const handleApproveTokenA = async () => {
    if (!tokenA || !amountA || !router || !walletClient) return;

    try {
      setIsConfirming(true);
      const txHash = await writeContract(
        walletClient,
        ERC20_ABI,
        tokenA.address,
        "approve",
        [router, parseUnits(amountA, tokenA.decimals)]
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error approving token A:", error);
      setIsConfirming(false);
    }
  };

  const handleApproveTokenB = async () => {
    if (!tokenB || !amountB || !router || !walletClient) return;

    try {
      setIsConfirming(true);
      const txHash = await writeContract(
        walletClient,
        ERC20_ABI,
        tokenB.address,
        "approve",
        [router, parseUnits(amountB, tokenB.decimals)]
      );
      setHash(txHash);
    } catch (error) {
      console.error("Error approving token B:", error);
      setIsConfirming(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!tokenA || !tokenB || !amountA || !amountB || !address || !router || !walletClient)
      return;

    try {
      setIsConfirming(true);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes from now
      const amountADesired = parseUnits(amountA, tokenA.decimals);
      const amountBDesired = parseUnits(amountB, tokenB.decimals);
      const amountAMin = parseUnits(
        (parseFloat(amountA) * 0.95).toString(),
        tokenA.decimals
      ); // 5% slippage
      const amountBMin = parseUnits(
        (parseFloat(amountB) * 0.95).toString(),
        tokenB.decimals
      ); // 5% slippage

      let txHash;

      // Check if one of the tokens is the wrapped native token
      if (isNativeWrappedToken(tokenA.symbol)) {
        txHash = await writeContract(
          walletClient,
          UNISWAP_V2_ROUTER_ABI,
          router,
          "addLiquidityETH",
          [
            tokenB.address,
            amountBDesired,
            amountBMin,
            amountAMin,
            address,
            deadline,
          ]
          // Note: Your writeContract function signature doesn't support value parameter
          // You may need to modify it to handle ETH transactions with value
        );
      } else if (isNativeWrappedToken(tokenB.symbol)) {
        txHash = await writeContract(
          walletClient,
          UNISWAP_V2_ROUTER_ABI,
          router,
          "addLiquidityETH",
          [
            tokenA.address,
            amountADesired,
            amountAMin,
            amountBMin,
            address,
            deadline,
          ]
          // Note: Your writeContract function signature doesn't support value parameter
          // You may need to modify it to handle ETH transactions with value
        );
      } else {
        txHash = await writeContract(
          walletClient,
          UNISWAP_V2_ROUTER_ABI,
          router,
          "addLiquidity",
          [
            tokenA.address,
            tokenB.address,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin,
            address,
            deadline,
          ]
        );
      }

      setHash(txHash);
    } catch (error) {
      console.error("Error adding liquidity:", error);
      setIsConfirming(false);
    }
  };

  const isReadyToAddLiquidity = () => {
    if (!address || !amountA || !amountB || !tokenA || !tokenB) return false;

    // If dealing with a wrapped native token, we don't need to approve it (it's native)
    if (isNativeWrappedToken(tokenA.symbol)) {
      return isTokenBApproved;
    } else if (isNativeWrappedToken(tokenB.symbol)) {
      return isTokenAApproved;
    }

    return isTokenAApproved && isTokenBApproved;
  };

  const needsApproval = () => {
    if (!amountA || !amountB) return false;

    const needsTokenAApproval = tokenA && !isNativeWrappedToken(tokenA.symbol) && !isTokenAApproved;
    const needsTokenBApproval = tokenB && !isNativeWrappedToken(tokenB.symbol) && !isTokenBApproved;

    return needsTokenAApproval || needsTokenBApproval;
  };

  return (
    <div className="liquidity-container">
      <div className="liquidity-form">
        <div className="token-input-container">
          <div className="token-input-row">
            <div className="token-input-content">
              <input
                className="amount-input"
                type="number"
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="0"
              />
              <TokenSelector
                selectedToken={tokenA}
                onTokenSelect={setTokenA}
                otherSelectedToken={tokenB}
                onTokenSwap={() => {
                  const temp = tokenA;
                  setTokenA(tokenB);
                  setTokenB(temp);
                  const tempAmount = amountA;
                  setAmountA(amountB);
                  setAmountB(tempAmount);
                }}
              />
            </div>
            {balanceA && tokenA && (
              <div
                className="balance-display"
                onClick={() =>
                  setAmountA(formatUnits(balanceA, tokenA.decimals))
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
                  {parseFloat(formatUnits(balanceA, tokenA.decimals)).toFixed(
                    2
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="plus-icon">+</div>

        <div className="token-input-container">
          <div className="token-input-row">
            <div className="token-input-content">
              <input
                className="amount-input"
                type="number"
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="0"
              />
              <TokenSelector
                selectedToken={tokenB}
                onTokenSelect={setTokenB}
                otherSelectedToken={tokenA}
                onTokenSwap={() => {
                  const temp = tokenA;
                  setTokenA(tokenB);
                  setTokenB(temp);
                  const tempAmount = amountA;
                  setAmountA(amountB);
                  setAmountB(tempAmount);
                }}
              />
            </div>
            {balanceB && tokenB && (
              <div
                className="balance-display"
                onClick={() =>
                  setAmountB(formatUnits(balanceB, tokenB.decimals))
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
                  {parseFloat(formatUnits(balanceB, tokenB.decimals)).toFixed()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {needsApproval() ? (
        <div className="approval-buttons">
          {tokenA &&
            !isNativeWrappedToken(tokenA.symbol) &&
            !isTokenAApproved &&
            amountA && (
              <button
                className="approve-button"
                onClick={handleApproveTokenA}
                disabled={isConfirming}
              >
                {isConfirming ? "Approving..." : `Approve ${tokenA?.symbol}`}
              </button>
            )}
          {tokenB &&
            !isNativeWrappedToken(tokenB.symbol) &&
            !isTokenBApproved &&
            amountB && (
              <button
                className="approve-button"
                onClick={handleApproveTokenB}
                disabled={isConfirming}
              >
                {isConfirming ? "Approving..." : `Approve ${tokenB?.symbol}`}
              </button>
            )}
        </div>
      ) : (
        <button
          className="liquidity-button"
          onClick={handleAddLiquidity}
          disabled={!isReadyToAddLiquidity() || isConfirming}
        >
          {isConfirming ? "Adding Liquidity..." : "Add Liquidity"}
        </button>
      )}

      {isConfirmed && (
        <div className="success-message">Liquidity added successfully!</div>
      )}
    </div>
  );
};

export default Liquidity;
