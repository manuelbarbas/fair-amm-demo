import React from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import TokenSelector from "../../../../components/TokenSelector/TokenSelector";
import { useSwap } from "../hooks/useSwap";
import type { TransactionSettingsData } from "../../../../hooks/useTransactionSettings";
// 1. Import the CSS module
import styles from "./Swap.module.css";

interface SwapProps {
  settings: TransactionSettingsData; // Prop renamed for clarity
}

const Swap: React.FC<SwapProps> = ({ settings }) => {
  const { address } = useAccount();
  
  
  const {
    fromToken,
    toToken,
    fromAmount,
    toAmount,
    isApproved,
    balance,
    balanceTo,
    isConfirming,
    isConfirmed,
    setFromToken,
    setToToken,
    setFromAmount,
    handleApprove,
    handleSwap,
    handleSwitchTokens,
    setMaxFromAmount,
  } = useSwap(settings);

  return (
    <div className={styles.swapContainer}>
      <div className={styles.swapForm}>
        <div className={styles.tokenInputsWrapper}>
          {/* From Token Input */}
          <div className={styles.tokenInputContainer}>
            <div className={styles.tokenInputRow}>
              <div className={styles.tokenInputContent}>
                <input
                  className={styles.amountInput}
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
              {fromToken && (
                <div
                  className={styles.balanceDisplay}
                  onClick={setMaxFromAmount}
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

          {/* Switch Button */}
          <div className={styles.switchContainer}>
            <button className={styles.switchButton} onClick={handleSwitchTokens}>
              ↕
            </button>
          </div>

          {/* To Token Input */}
          <div className={styles.tokenInputContainer}>
            <div className={styles.tokenInputRow}>
              <div className={styles.tokenInputContent}>
                <input
                  className={styles.amountInput}
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
              {toToken && (
                <div className={styles.balanceDisplay}>
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

      {/* Action Button */}
      {address && !isApproved && fromAmount ? (
        <button
          className={styles.approveButton}
          onClick={handleApprove}
          disabled={isConfirming}
        >
          {isConfirming ? "Approving..." : `Approve ${fromToken?.symbol}`}
        </button>
      ) : (
        <button
          className={styles.swapButton}
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount || isConfirming}
        >
          {isConfirming ? "Swapping..." : "Swap"}
        </button>
      )}

      {/* Confirmation Message */}
      {isConfirmed && (
        <div className={styles.successMessage}>Swap completed successfully!</div>
      )}
    </div>
  );
};

export default Swap;
