import React from "react";
import { formatUnits } from "viem";
import TokenSelector from "../TokenSelector/TokenSelector";
import { BalanceWalletIcon } from "../UI";
import { useTokenUSDValue } from "../../hooks/useTokenUSDValue";
import type { Token } from "../../types/token";
import styles from "./TokenInputContainer.module.css";
import { formatValue } from "../../utils";


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

  // Get USD value for the current token and amount
  const { usdValue, isLoading: isPriceLoading } = useTokenUSDValue({
    token: selectedToken,
    amount,
  });

  const renderBalanceDisplay = () => {
    if (!selectedToken) return null;

    const formattedBalance = formatValue(parseFloat(
      formatUnits(balance, selectedToken.decimals)
    ));

    return (
      <div className={styles.balanceDisplay} onClick={onMaxClick}>
        <BalanceWalletIcon />
        <span>{formattedBalance}</span>
      </div>
    );
  };

  const renderUSDValue = () => {
    return (
      <div className={styles.usdValue}>
        <span>
          {isPriceLoading ? '...' : '$'+ formatValue(usdValue)}
        </span>
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
