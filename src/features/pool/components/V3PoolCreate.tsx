import React, { useState, useMemo } from 'react';
import TokenSelector from '../../../components/TokenSelector/TokenSelector';
import TokenInputContainer from '../../../components/TokenInputContainer/TokenInputContainer';
import ActionButton from '../../../components/ActionButton/ActionButton';
import TransactionSteps from '../../../components/TransactionSteps/TransactionSteps';
import { InfoIcon } from '../../../components/UI';
import type { Token } from '../services/pool';
import type { V3FeeTier, V3RangeSelection } from '../../../lib/uniswap/pools';
import { V3_FEE_TIER_LABELS } from '../../../lib/uniswap/pools';
import { V3PoolService } from '../../../lib/uniswap/pools';
import type { V3TransactionStep } from '../hooks/useV3PoolLogic';
import styles from './PoolCreate.module.css';

interface V3PoolCreateProps {
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

  // Approval state
  needsApprovalA: boolean;
  needsApprovalB: boolean;
  onApproveA: () => Promise<void>;
  onApproveB: () => Promise<void>;

  // Pool creation
  canCreatePool: boolean;
  onCreatePool: () => Promise<void>;
  isConfirming: boolean;
  isSequenceRunning: boolean;
  transactionSteps: V3TransactionStep[];

  // V3-specific state
  selectedFeeTier: V3FeeTier;
  onFeeTierChange: (fee: V3FeeTier) => void;
  priceRangeSelection: V3RangeSelection;
  onPriceRangeChange: (selection: V3RangeSelection) => void;
}

export const V3PoolCreate: React.FC<V3PoolCreateProps> = ({
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
  needsApprovalA,
  needsApprovalB,
  onApproveA,
  onApproveB,
  canCreatePool,
  onCreatePool,
  isConfirming,
  isSequenceRunning,
  transactionSteps,
  selectedFeeTier,
  onFeeTierChange,
  priceRangeSelection,
  onPriceRangeChange,
}) => {
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');

  const isStep1Complete = tokenA && tokenB;
  const feeTiers = V3PoolService.getFeeTiers();

  // Calculate current price from amounts for display
  const currentPrice = useMemo(() => {
    if (!amountA || !amountB || parseFloat(amountA) === 0) return 0;
    return parseFloat(amountB) / parseFloat(amountA);
  }, [amountA, amountB]);

  const handlePriceRangeToggle = (type: 'full' | 'custom') => {
    if (type === 'full') {
      onPriceRangeChange({ type: 'full' });
    } else {
      onPriceRangeChange({
        type: 'custom',
        minPrice: customMinPrice,
        maxPrice: customMaxPrice,
      });
    }
  };

  const updateCustomRange = () => {
    if (priceRangeSelection.type === 'custom') {
      onPriceRangeChange({
        type: 'custom',
        minPrice: customMinPrice,
        maxPrice: customMaxPrice,
      });
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

    if (needsApprovalA) {
      return (
        <ActionButton
          variant="approve"
          onClick={() => {
            void onApproveA();
          }}
          disabled={isSequenceRunning}
          loading={isSequenceRunning || isConfirming}
          loadingText="Approving..."
          className={styles.createPoolButton}
        >
          Approve {tokenA?.symbol}
        </ActionButton>
      );
    }

    if (needsApprovalB) {
      return (
        <ActionButton
          variant="approve"
          onClick={() => {
            void onApproveB();
          }}
          disabled={isSequenceRunning}
          loading={isSequenceRunning || isConfirming}
          loadingText="Approving..."
          className={styles.createPoolButton}
        >
          Approve {tokenB?.symbol}
        </ActionButton>
      );
    }

    return (
      <ActionButton
        variant="primary"
          onClick={onCreatePool}
          disabled={!canCreatePool || isSequenceRunning}
          loading={isSequenceRunning || isConfirming}
        loadingText="Creating Pool..."
        className={styles.createPoolButton}
      >
        Create V3 Pool
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
              The fee tier determines the trading fee earned by liquidity providers.
            </p>
            <div className={styles.v3FeeTierContainer}>
              {feeTiers.map((tier) => (
                <button
                  key={tier.fee}
                  onClick={() => onFeeTierChange(tier.fee)}
                  className={`${styles.v3FeeTierOption} ${
                    selectedFeeTier === tier.fee ? styles.selected : ''
                  }`}
                >
                  <div className={styles.feeTierLabel}>{tier.label}</div>
                  <div className={styles.feeTierDescription}>{tier.description}</div>
                </button>
              ))}
            </div>
          </div>

          {renderActionButton()}
        </>
      )}

      {currentStep === 2 && (
        <>
          <div className={styles.formSection}>
            <h3>Set price range</h3>
            <p className={styles.sectionDescription}>
              Choose the price range for your liquidity position.
            </p>
            
            <div className={styles.priceRangeToggle}>
              <button
                onClick={() => handlePriceRangeToggle('full')}
                className={`${styles.rangeToggleButton} ${
                  priceRangeSelection.type === 'full' ? styles.active : ''
                }`}
              >
                Full range
              </button>
              <button
                onClick={() => handlePriceRangeToggle('custom')}
                className={`${styles.rangeToggleButton} ${
                  priceRangeSelection.type === 'custom' ? styles.active : ''
                }`}
              >
                Custom range
              </button>
            </div>

            {priceRangeSelection.type === 'full' && (
              <div className={styles.fullRangeInfo}>
                <div className={styles.infoMessage}>
                  <InfoIcon />
                  <span>
                    Providing full range liquidity ensures continuous market participation 
                    across all possible prices, offering simplicity but with potential for 
                    higher impermanent loss.
                  </span>
                </div>
              </div>
            )}

            {priceRangeSelection.type === 'custom' && (
              <div className={styles.customRangeInputs}>
                {tokenA && tokenB && currentPrice > 0 && (
                  <div className={styles.currentPrice}>
                    <span>Market price: {currentPrice.toFixed(6)} {tokenB.symbol} = 1 {tokenA.symbol}</span>
                  </div>
                )}
                
                <div className={styles.priceInputContainer}>
                  <div className={styles.priceInputGroup}>
                    <label>Min price</label>
                    <input
                      type="number"
                      value={customMinPrice}
                      onChange={(e) => {
                        setCustomMinPrice(e.target.value);
                        updateCustomRange();
                      }}
                      placeholder="0"
                      className={styles.priceInput}
                    />
                    <span className={styles.priceInputLabel}>
                      {tokenA?.symbol} = 1 {tokenB?.symbol}
                    </span>
                  </div>
                  
                  <div className={styles.priceInputGroup}>
                    <label>Max price</label>
                    <input
                      type="number"
                      value={customMaxPrice}
                      onChange={(e) => {
                        setCustomMaxPrice(e.target.value);
                        updateCustomRange();
                      }}
                      placeholder="∞"
                      className={styles.priceInput}
                    />
                    <span className={styles.priceInputLabel}>
                      {tokenA?.symbol} = 1 {tokenB?.symbol}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.formSection}>
            <h3>Deposit tokens</h3>
            <p className={styles.sectionDescription}>
              Specify the token amounts for your liquidity contribution.
            </p>
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
                  <span className={styles.feeBadge}>
                    {V3_FEE_TIER_LABELS[selectedFeeTier]}
                  </span>
                </div>
                {amountA && amountB && (
                  <div className={styles.poolRatio}>
                    <div>
                      Initial Price: 1 {tokenA.symbol} ={' '}
                      {currentPrice.toFixed(6)} {tokenB.symbol}
                    </div>
                    <div>
                      Range: {priceRangeSelection.type === 'full' ? 'Full Range' : 'Custom Range'}
                    </div>
                    <div>Fee Tier: {V3_FEE_TIER_LABELS[selectedFeeTier]}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {renderActionButton()}

          <TransactionSteps steps={transactionSteps} />
        </>
      )}
    </>
  );
};
