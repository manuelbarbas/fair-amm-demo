import React from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import TokenSelector from "../../../../components/TokenSelector/TokenSelector";
import { useSwap } from "../hooks/useSwap";
import type { TransactionSettingsData } from "../../../../hooks/useTransactionSettings";
// 1. Import the CSS module
import styles from "./Swap.module.css";
import { BalanceWalletIcon } from "../../../../components/UI";

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
                  <BalanceWalletIcon />
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
            <button
              className={styles.switchButton}
              onClick={handleSwitchTokens}
            >
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
                  <BalanceWalletIcon />
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
        <div className={styles.successMessage}>
          Swap completed successfully!
        </div>
      )}
    </div>
  );
};

export default Swap;
