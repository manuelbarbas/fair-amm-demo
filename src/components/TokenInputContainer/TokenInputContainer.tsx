import React from "react";
import { formatUnits } from "viem";
import TokenSelector from "../TokenSelector/TokenSelector";
import { BalanceWalletIcon } from "../UI";
import type { Token } from "../../types/token";
import styles from "./TokenInputContainer.module.css";

// Utility function to format USD values
const formatUSDValue = (value: number): string => {
  if (value === 0) return "$0";
  
  const absValue = Math.abs(value);
  
  if (absValue >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}B`;
  } else if (absValue >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}M`;
  } else if (absValue >= 1_000) {
    return `$${(value / 1_000).toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}K`;
  } else if (absValue >= 1) {
    return `$${value.toLocaleString('en-US', { 
      minimumFractionDigits: 1, 
      maximumFractionDigits: 1 
    })}`;
  } else {
    return `$${value.toFixed(2)}`;
  }
};

interface TokenInputContainerProps {
  // Token input props
  selectedToken: Token | null;
  amount: string;
  balance: bigint;
  placeholder?: string;
  
  // Behavior props
  readOnly?: boolean;
  
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

    return (
      <div className={styles.balanceDisplay} onClick={onMaxClick}>
        <BalanceWalletIcon />
        <span>{formattedBalance}</span>
      </div>
    );
  };

  const renderUSDValue = () => {
    // For now, always show $0 as placeholder
    // Later this will be calculated using token price and amount
    const usdValue = 0; // TODO: Calculate actual USD value based on amount and token price
    
    return (
      <div className={styles.usdValue}>
        <span>{formatUSDValue(usdValue)}</span>
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
        <div className={styles.bottomRow}>
          {renderUSDValue()}
          {renderBalanceDisplay()}
        </div>
      </div>
    </div>
  );
};

export default TokenInputContainer;
