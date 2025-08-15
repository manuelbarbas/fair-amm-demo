import React, { useState , useMemo} from "react";
import TokenSelector from "../../../components/TokenSelector/TokenSelector";
import TokenInputContainer from "../../../components/TokenInputContainer/TokenInputContainer";
import { usePool } from "../hooks/usePool";
import { useTransactionSettings } from "../../../hooks/useTransactionSettings";
// 1. Import the CSS module
import styles from "./PoolCreate.module.css";
import { InfoIcon } from "../../../components/UI";

export const PoolCreate: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedVersion, setSelectedVersion] = useState("v2");

   const defaultPoolSettings = useMemo(
      () => ({
        slippage: { isAuto: true, value: 0.5 },
        deadline: 20,
        biteEncryption: true,
      }),
      []
    );
  
    const poolSettings = useTransactionSettings({
      storageKey: "poolTransactionSettings",
      defaultSettings: defaultPoolSettings,
    });
  

  const {
    tokenA,
    tokenB,
    amountA,
    amountB,
    balanceA,
    balanceB,
    needsApprovalA,
    needsApprovalB,
    isConfirming,
    canCreatePool,
    setTokenA,
    setTokenB,
    setAmountA,
    setAmountB,
    handleApproveTokenA,
    handleApproveTokenB,
    handleCreatePool,
    setMaxAmountA,
    setMaxAmountB,
  } = usePool(poolSettings.settings);

  const v2FeeTier = 0.3;
  const isStep1Complete = tokenA && tokenB;

  const handleReset = () => {
    setCurrentStep(1);
    setTokenA(null);
    setTokenB(null);
    setAmountA("");
    setAmountB("");
  };

  const handleContinue = () => {
    if (isStep1Complete) {
      setCurrentStep(2);
    }
  };

  const renderActionButton = () => {
    if (currentStep === 1) {
      return (
        <button
          className={`${styles.continueButton} ${
            !isStep1Complete ? styles.disabled : ""
          }`}
          disabled={!isStep1Complete}
          onClick={handleContinue}
        >
          Continue
        </button>
      );
    }

    if (needsApprovalA) {
      return (
        <button
          className={styles.createPoolButton}
          onClick={handleApproveTokenA}
          disabled={isConfirming}
        >
          {isConfirming ? "Approving..." : `Approve ${tokenA?.symbol}`}
        </button>
      );
    }

    if (needsApprovalB) {
      return (
        <button
          className={styles.createPoolButton}
          onClick={handleApproveTokenB}
          disabled={isConfirming}
        >
          {isConfirming ? "Approving..." : `Approve ${tokenB?.symbol}`}
        </button>
      );
    }

    return (
      <button
        className={`${styles.createPoolButton} ${
          !canCreatePool ? styles.disabled : ""
        }`}
        disabled={!canCreatePool || isConfirming}
        onClick={handleCreatePool}
      >
        {isConfirming ? "Creating Pool..." : "Create Pool"}
      </button>
    );
  };

  // 2. Replace all className strings with {styles.className}
  return (
    <div className={styles.poolCreateWrapper}>
      <div className={styles.poolHeader}>
        <div className={styles.poolHeaderLeft}>
          <h1>New position</h1>
        </div>
        <div className={styles.poolHeaderRight}>
          <button className={styles.resetButton} onClick={handleReset}>
            ↻ Reset
          </button>
          <div className={styles.versionDropdown}>
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className={styles.versionSelect}
            >
              <option value="v2">v2 position</option>
              <option value="v3" disabled>
                v3 position
              </option>
              <option value="v4" disabled>
                v4 position
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.poolCreateContainer}>
        <div>
          <div className={styles.poolSteps}>
            <div
              className={`${styles.poolStep} ${
                currentStep === 1
                  ? styles.active
                  : currentStep > 1
                  ? styles.completed
                  : ""
              }`}
            >
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <div className={styles.settingLabel}>
                  <p>step 1</p>
                  <div className={styles.infoIconContainer}>
                    <div className={styles.infoIcon}>
                      <InfoIcon/>
                    </div>
                    <div className={styles.infoTooltip}>
                      Choose the tokens you want to provide liquidity for.
                    </div>
                  </div>
                </div>
                <h4>Select token pair and fees</h4>
              </div>
            </div>

            <div
              className={`${styles.poolStep} ${
                currentStep === 2 ? styles.active : ""
              } ${currentStep < 2 ? styles.disabled : ""}`}
            >
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <div className={styles.settingLabel}>
                  <p>step 2</p>
                  <div className={styles.infoIconContainer}>
                    <div className={styles.infoIcon}>
                      <InfoIcon/>
                    </div>
                    <div className={styles.infoTooltip}>
                      Specify the amount of each token to deposit.
                    </div>
                  </div>
                </div>
                <h4>Set price range and deposit amounts</h4>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.poolCreateRight}>
          <div className={styles.poolForm}>
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
                        onTokenSelect={setTokenA}
                        otherSelectedToken={tokenB}
                      />
                    </div>
                    <div className={styles.tokenSelectorContainer}>
                      <TokenSelector
                        selectedToken={tokenB}
                        onTokenSelect={setTokenB}
                        otherSelectedToken={tokenA}
                      />
                    </div>
                  </div>
                </div>
                <div className={styles.formSection}>
                  <h3>Fee tier</h3>
                  <p className={styles.sectionDescription}>
                    The amount earned providing liquidity.
                  </p>
                  <div className={styles.feeTierContainer}>
                    <div className={styles.feeTierSelected}>
                      <div className={styles.feeTierInfo}>
                        <span className={styles.feeTierPercentage}>
                          0.30% fee tier
                        </span>
                      </div>
                      <div className={styles.feeTierDescription}>
                        The % you will earn in fees
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
                      onAmountChange={setAmountA}
                      onMaxClick={setMaxAmountA}
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
                      onAmountChange={setAmountB}
                      onMaxClick={setMaxAmountB}
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
                            Initial Price: 1 {tokenA.symbol} ={" "}
                            {(
                              parseFloat(amountB) / parseFloat(amountA)
                            ).toFixed(6)}{" "}
                            {tokenB.symbol}
                          </div>
                          <div>Your Pool Share: 100%</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {renderActionButton()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
