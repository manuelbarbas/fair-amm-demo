import React from 'react';
import TokenSelector from '../../../components/TokenSelector/TokenSelector';
import TokenInputContainer from '../../../components/TokenInputContainer/TokenInputContainer';
import ActionButton from '../../../components/ActionButton/ActionButton';
import type { Token } from '../services/pool';
import type { V2TransactionStep } from '../hooks/useV2PoolLogic';
import styles from './PoolCreate.module.css';

interface V2PoolCreateProps {
  // Step management
  currentStep: 1 | 2;
  onContinue: () => void;

  // Token state
  tokenA: Token | null;
  tokenB: Token | null;
  onTokenASelect: (token: Token | null) => void;
  onTokenBSelect: (token: Token | null) => void;

  // Amount state
  amountA: string;
  amountB: string;
  onAmountAChange: (amount: string) => void;
  onAmountBChange: (amount: string) => void;
  onMaxAmountA: () => void;
  onMaxAmountB: () => void;

  // Balance state
  balanceA: bigint;
  balanceB: bigint;

  // Pool creation
  onCreatePool: () => Promise<void>;
  isConfirming: boolean;
  isSequenceRunning: boolean;
  transactionSteps: V2TransactionStep[];
}

export const V2PoolCreate: React.FC<V2PoolCreateProps> = ({
  currentStep,
  onContinue,
  tokenA,
  tokenB,
  onTokenASelect,
  onTokenBSelect,
  amountA,
  amountB,
  onAmountAChange,
  onAmountBChange,
  onMaxAmountA,
  onMaxAmountB,
  balanceA,
  balanceB,
  onCreatePool,
  isConfirming,
  isSequenceRunning,
  transactionSteps,
}) => {
  const isStep1Complete = tokenA && tokenB;
  const v2FeeTier = 0.3;
  const getStatusClassName = (status: V2TransactionStep['status']) =>
    `${styles.transactionStepStatus} ${styles[`transactionStepStatus--${status}`] ?? ''}`;
  const getStatusLabel = (status: V2TransactionStep['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'inProgress':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Failed';
      default:
        return '';
    }
  };

  const renderActionButton = () => {
    if (currentStep === 1) {
      return (
        <ActionButton
          variant="secondary"
          onClick={onContinue}
          disabled={!isStep1Complete}
          className={styles.continueButton}
        >
          Continue
        </ActionButton>
      );
    }

    const amountANumeric = amountA ? parseFloat(amountA) : Number.NaN;
    const amountBNumeric = amountB ? parseFloat(amountB) : Number.NaN;
    const hasValidAmounts = Number.isFinite(amountANumeric) && amountANumeric > 0 && Number.isFinite(amountBNumeric) && amountBNumeric > 0;
    const hasTokens = Boolean(tokenA && tokenB);
    const isDisabled = !hasTokens || !hasValidAmounts || isSequenceRunning;
    const isLoading = isSequenceRunning || isConfirming;

    return (
      <ActionButton
        variant="primary"
        onClick={onCreatePool}
        disabled={isDisabled}
        loading={isLoading}
        loadingText="Processing..."
        className={styles.createPoolButton}
      >
        Create V2 Pool
      </ActionButton>
    );
  };

  return (
    <>
      {currentStep === 1 && (
        <>
          <div className={styles.formSection}>
            <h3>Select pair</h3>
            <p className={styles.sectionDescription}>
              Choose the tokens you want to provide liquidity for.
            </p>
            <div className={styles.tokenPairSelectors}>
              <div className={styles.tokenSelectorContainer}>
                <TokenSelector
                  selectedToken={tokenA}
                  onTokenSelect={(token) => onTokenASelect(token)}
                  otherSelectedToken={tokenB}
                />
              </div>
              <div className={styles.tokenSelectorContainer}>
                <TokenSelector
                  selectedToken={tokenB}
                  onTokenSelect={(token) => onTokenBSelect(token)}
                  otherSelectedToken={tokenA}
                />
              </div>
            </div>
          </div>
          
          <div className={styles.formSection}>
            <h3>Fee tier</h3>
            <p className={styles.sectionDescription}>
              V2 pools have a fixed fee tier.
            </p>
            <div className={styles.feeTierContainer}>
              <div className={styles.feeTierSelected}>
                <div className={styles.feeTierInfo}>
                  <span className={styles.feeTierPercentage}>
                    0.30% fee tier
                  </span>
                </div>
                <div className={styles.feeTierDescription}>
                  Fixed fee tier for V2 pools
                </div>
              </div>
            </div>
          </div>
          
          {renderActionButton()}
        </>
      )}

      {currentStep === 2 && (
        <>
          <div className={styles.formSection}>
            <h3>Deposit amounts</h3>
            <div className={styles.tokenPairContainer}>
              <TokenInputContainer
                selectedToken={tokenA}
                amount={amountA}
                balance={balanceA}
                onTokenSelect={() => {}} // Disabled in step 2
                onAmountChange={onAmountAChange}
                onMaxClick={onMaxAmountA}
                otherSelectedToken={tokenB}
                disableTokenSelector={true}
                containerClassName={styles.tokenInputContainer}
              />
              <div className={styles.plusContainer}>
                <div className={styles.plusIcon}>+</div>
              </div>
              <TokenInputContainer
                selectedToken={tokenB}
                amount={amountB}
                balance={balanceB}
                onTokenSelect={() => {}} // Disabled in step 2
                onAmountChange={onAmountBChange}
                onMaxClick={onMaxAmountB}
                otherSelectedToken={tokenA}
                disableTokenSelector={true}
                containerClassName={styles.tokenInputContainer}
              />
            </div>
          </div>
          
          {tokenA && tokenB && (
            <div className={styles.formSection}>
              <h3>Pool Preview</h3>
              <div className={styles.poolPreview}>
                <div className={styles.poolPair}>
                  <span>
                    {tokenA.symbol} / {tokenB.symbol}
                  </span>
                  <span className={styles.feeBadge}>{v2FeeTier}%</span>
                </div>
                {amountA && amountB && (
                  <div className={styles.poolRatio}>
                    <div>
                      Initial Price: 1 {tokenA.symbol} ={' '}
                      {(parseFloat(amountB) / parseFloat(amountA)).toFixed(6)}{' '}
                      {tokenB.symbol}
                    </div>
                    <div>Your Pool Share: 100%</div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {renderActionButton()}

          {transactionSteps.length > 0 && (
            <div className={styles.transactionChecklist}>
              <div className={styles.transactionChecklistTitle}>On-chain transactions</div>
              <ul className={styles.transactionStepsList}>
                {transactionSteps.map((step) => (
                  <li key={step.id} className={styles.transactionStepRow}>
                    <span className={getStatusClassName(step.status)}>
                      {step.status === 'completed'
                        ? '✓'
                        : step.status === 'error'
                        ? '!'
                        : step.status === 'inProgress'
                        ? '•'
                        : ''}
                    </span>
                    <span className={styles.transactionStepLabel}>{step.label}</span>
                    <span className={styles.transactionStepState}>{getStatusLabel(step.status)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
};
