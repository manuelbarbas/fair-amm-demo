import React from "react";
import TokenInputContainer from "../../../../components/TokenInputContainer/TokenInputContainer";
import ActionButton from "../../../../components/ActionButton/ActionButton";
import { useSwap } from "../hooks/useSwap";
import type { TransactionSettingsData } from "../../../../hooks/useTransactionSettings";
// 1. Import the CSS module
import styles from "./Swap.module.css";

interface SwapProps {
  settings: TransactionSettingsData; // Prop renamed for clarity
}

const Swap: React.FC<SwapProps> = ({ settings }) => {

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
          <TokenInputContainer
            selectedToken={fromToken}
            amount={fromAmount}
            balance={balance}
            onTokenSelect={setFromToken}
            onAmountChange={setFromAmount}
            onMaxClick={setMaxFromAmount}
            onTokenSwap={handleSwitchTokens}
            otherSelectedToken={toToken}
            containerClassName={styles.tokenInputContainer}
          />

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
          <TokenInputContainer
            selectedToken={toToken}
            amount={toAmount}
            balance={balanceTo}
            readOnly={true}
            onTokenSelect={setToToken}
            onAmountChange={() => {}} // No-op since it's readonly
            onMaxClick={() => {}} // No-op for the "to" token
            onTokenSwap={handleSwitchTokens}
            otherSelectedToken={fromToken}
            containerClassName={styles.tokenInputContainer}
          />
        </div>
      </div>

      {/* Action Button */}
      {!isApproved && fromAmount ? (
        <ActionButton
          variant="approve"
          onClick={handleApprove}
          loading={isConfirming}
          loadingText="Approving..."
          className={styles.approveButton}
        >
          Approve {fromToken?.symbol}
        </ActionButton>
      ) : (
        <ActionButton
          variant="primary"
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount}
          loading={isConfirming}
          loadingText="Swapping..."
          className={styles.swapButton}
        >
          Swap
        </ActionButton>
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
