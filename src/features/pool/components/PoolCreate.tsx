import React, { useState, useMemo } from "react";
import { useChainId } from "wagmi";
import { useTransactionSettings } from "../../../hooks/useTransactionSettings";
import { useSharedPoolLogic } from "../hooks/useSharedPoolLogic";
import { useV2PoolLogic } from "../hooks/useV2PoolLogic";
import { useV3PoolLogic } from "../hooks/useV3PoolLogic";
import { V2PoolCreate } from "./V2PoolCreate";
import { V3PoolCreate } from "./V3PoolCreate";
import { getRouter, getV3NFTPositionManagerAddress } from "../../../config/config";
import { InfoIcon } from "../../../components/UI";
import styles from "./PoolCreate.module.css";

export const PoolCreate: React.FC = () => {
  const chainId = useChainId();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedVersion, setSelectedVersion] = useState<"v2" | "v3">("v2");
  const [, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isConfirming, setIsConfirming] = useState(false);

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

  // Get appropriate approval target based on version
  // V2: Approve tokens to V2 Router
  // V3: Approve tokens to Permit2 contract (universal approval system)
  const approvalTarget = selectedVersion === 'v2' 
    ? getRouter(chainId)  // V2 Router for direct approvals
    : getV3NFTPositionManagerAddress(chainId);  // V3 Position Manager requires token allowances

  // Shared logic (always needed)
  const shared = useSharedPoolLogic({ 
    poolSettings: poolSettings.settings, 
    routerAddress: approvalTarget  // V2: router, V3: Permit2
  });

  // Version-specific logic (always call both hooks, let them handle internal logic)
  const v2Logic = useV2PoolLogic({ 
    sharedState: shared.state, 
    sharedActions: shared.actions,
    poolSettings: poolSettings.settings, 
    setHash, 
    setIsConfirming,
    isActive: selectedVersion === 'v2'
  });
    
  const v3Logic = useV3PoolLogic({ 
    sharedState: shared.state, 
    poolSettings: poolSettings.settings, 
    setHash, 
    setIsConfirming,
    isActive: selectedVersion === 'v3'
  });

  // Version-specific logic is used directly in component props below

  // Extract shared state and actions
  const {
    tokenA,
    tokenB,
    amountA,
    amountB,
    balanceA,
    balanceB,
  } = shared.state;

  const {
    setTokenA,
    setTokenB,
    setAmountA,
    setAmountB,
    handleApproveTokenA,
    handleApproveTokenB,
    setMaxAmountA,
    setMaxAmountB,
    needsApprovalA,
    needsApprovalB,
    canCreatePool,
  } = shared.actions;

  const isStep1Complete = tokenA && tokenB;

  const handleReset = () => {
    setCurrentStep(1);
    setTokenA(null);
    setTokenB(null);
    setAmountA("");
    setAmountB("");
    // V3 state will be reset automatically when switching versions or in the V3 hook
  };

  const handleContinue = () => {
    if (isStep1Complete) {
      setCurrentStep(2);
    }
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
              onChange={(e) => setSelectedVersion(e.target.value as "v2" | "v3")}
              className={styles.versionSelect}
            >
              <option value="v2">v2 position</option>
              <option value="v3">v3 position</option>
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
            {selectedVersion === "v2" ? (
              <V2PoolCreate
                currentStep={currentStep}
                onContinue={handleContinue}
                tokenA={tokenA}
                tokenB={tokenB}
                onTokenASelect={setTokenA}
                onTokenBSelect={setTokenB}
                amountA={amountA}
                amountB={amountB}
                onAmountAChange={setAmountA}
                onAmountBChange={setAmountB}
                onMaxAmountA={setMaxAmountA}
                onMaxAmountB={setMaxAmountB}
                balanceA={balanceA}
                balanceB={balanceB}
                onCreatePool={v2Logic.actions.handleCreatePool}
                isConfirming={isConfirming}
                isSequenceRunning={v2Logic.state.isSequenceRunning}
                transactionSteps={v2Logic.state.transactionSteps}
              />
            ) : (
              <V3PoolCreate
                currentStep={currentStep}
                onContinue={handleContinue}
                tokenA={tokenA}
                tokenB={tokenB}
                onTokenASelect={setTokenA}
                onTokenBSelect={setTokenB}
                amountA={amountA}
                amountB={amountB}
                onAmountAChange={setAmountA}
                onAmountBChange={setAmountB}
                onMaxAmountA={setMaxAmountA}
                onMaxAmountB={setMaxAmountB}
                balanceA={balanceA}
                balanceB={balanceB}
                needsApprovalA={needsApprovalA}
                needsApprovalB={needsApprovalB}
                onApproveA={handleApproveTokenA}
                onApproveB={handleApproveTokenB}
                canCreatePool={canCreatePool}
                onCreatePool={v3Logic.actions.handleCreatePool}
                isConfirming={isConfirming}
                selectedFeeTier={v3Logic.state.selectedFeeTier}
                onFeeTierChange={v3Logic.actions.setSelectedFeeTier}
                priceRangeSelection={v3Logic.state.priceRangeSelection}
                onPriceRangeChange={v3Logic.actions.setPriceRangeSelection}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
