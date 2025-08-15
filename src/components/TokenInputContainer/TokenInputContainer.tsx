import React from "react";
import { formatUnits } from "viem";
import TokenSelector from "../TokenSelector/TokenSelector";
import { BalanceWalletIcon } from "../UI";
import type { Token } from "../../types/token";
import styles from "./TokenInputContainer.module.css";

export type BalanceDisplayVariant = "swap" | "pool";

interface TokenInputContainerProps {
  // Token input props
  selectedToken: Token | null;
  amount: string;
  balance: bigint;
  placeholder?: string;
  
  // Behavior props
  readOnly?: boolean;
  balanceDisplayVariant?: BalanceDisplayVariant;
  
  // Handlers
  onTokenSelect: (token: Token | null) => void;
  onAmountChange: (amount: string) => void;
  onMaxClick: () => void;
  onTokenSwap?: () => void;
  
  // Token selector props
  otherSelectedToken?: Token | null;
  disableTokenSelector?: boolean;
  
  // Styling props
  className?: string;
  containerClassName?: string;
}

const TokenInputContainer: React.FC<TokenInputContainerProps> = ({
  selectedToken,
  amount,
  balance,
  placeholder = "0",
  readOnly = false,
  balanceDisplayVariant = "swap",
  onTokenSelect,
  onAmountChange,
  onMaxClick,
  onTokenSwap,
  otherSelectedToken,
  disableTokenSelector = false,
  className,
  containerClassName,
}) => {
  const handleTokenSelect = disableTokenSelector ? () => {} : onTokenSelect;

  const renderBalanceDisplay = () => {
    if (!selectedToken) return null;

    const formattedBalance = parseFloat(
      formatUnits(balance, selectedToken.decimals)
    ).toFixed(2);

    // Default to swap variant
    return (
      <div className={styles.balanceDisplay} onClick={onMaxClick}>
        <BalanceWalletIcon />
        <span>{formattedBalance}</span>
      </div>
    );
  };

  return (
    <div className={`${styles.tokenInputContainer} ${containerClassName || ""}`}>
      <div className={`${styles.tokenInputRow} ${className || ""}`}>
        <div className={styles.tokenInputContent}>
          <input
            className={styles.amountInput}
            type="number"
            value={amount}
            onChange={readOnly ? undefined : (e) => onAmountChange(e.target.value)}
            readOnly={readOnly}
            placeholder={placeholder}
          />
          <TokenSelector
            selectedToken={selectedToken}
            onTokenSelect={handleTokenSelect}
            otherSelectedToken={otherSelectedToken}
            onTokenSwap={onTokenSwap}
          />
        </div>
        {renderBalanceDisplay()}
      </div>
    </div>
  );
};

export default TokenInputContainer;
