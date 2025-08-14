import React, { useState } from "react";
import TokenSelector from "../../tokenSelection/components/TokenSelector";
import { usePool } from "../hooks/usePool";
import { type TransactionSettingsData } from "../../settings/hooks/useTransactionSettings";
import { formatUnits } from "viem";
import TransactionSettings from "../../settings/components/TransactionSettings";
import "./poolCreate.css";

interface PoolCreateProps {
  poolSettings: {
    settings: TransactionSettingsData;
    openSettings: () => void;
    closeSettings: () => void;
    isOpen: boolean;
  };
}

const PoolCreate: React.FC<PoolCreateProps> = ({ poolSettings }) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedVersion, setSelectedVersion] = useState("v2");
  const [showSettings, setShowSettings] = useState(false);

  const {
    // State
    tokenA,
    tokenB,
    amountA,
    amountB,
    selectedFeeTier,
    priceRangeOption,
    balanceA,
    balanceB,
    isApprovedA,
    isApprovedB,
    quote,
    isConfirming,
    isLoadingQuote,

    // Computed
    canCreatePool,
    needsApprovalA,
    needsApprovalB,

    // Actions
    setTokenA,
    setTokenB,
    setAmountA,
    setAmountB,
    setSelectedFeeTier,
    setPriceRangeOption,
    handleApproveTokenA,
    handleApproveTokenB,
    handleCreatePool,
    handleTokenSwap,
    setMaxAmountA,
    setMaxAmountB,
  } = usePool(poolSettings.settings);

  // Fixed 0.3% fee for V2 pools
  const v2FeeTier = 0.3;

  // Step 1 completion check
  const isStep1Complete = tokenA && tokenB;

  // Reset function
  const handleReset = () => {
    setCurrentStep(1);
    setTokenA(null);
    setTokenB(null);
    setAmountA("");
    setAmountB("");
  };

  // Continue to step 2
  const handleContinue = () => {
    if (isStep1Complete) {
      setCurrentStep(2);
    }
  };

  const renderActionButton = () => {
    if (currentStep === 1) {
      return (
        <button
          className={`continue-button ${isStep1Complete ? "" : "disabled"}`}
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
          className="create-pool-button"
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
          className="create-pool-button"
          onClick={handleApproveTokenB}
          disabled={isConfirming}
        >
          {isConfirming ? "Approving..." : `Approve ${tokenB?.symbol}`}
        </button>
      );
    }

    return (
      <button
        className={`create-pool-button ${canCreatePool ? "" : "disabled"}`}
        disabled={!canCreatePool || isConfirming}
        onClick={handleCreatePool}
      >
        {isConfirming ? "Creating Pool..." : "Create Pool"}
      </button>
    );
  };

  return (
    <div className="pool-create-wrapper">
      {/* Pool Header */}
      <div className="pool-header">
        <div className="pool-header-left">
          <h1>New position</h1>
        </div>
        <div className="pool-header-right">
          <button className="reset-button" onClick={handleReset}>
            ↻ Reset
          </button>
          <div className="version-dropdown">
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="version-select"
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
          <button
            className="settings-button"
            onClick={() => setShowSettings(!showSettings)}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <TransactionSettings settingsHook={poolSettings} transactionType="pool" />
        </div>
      )}

      <div className="pool-create-container">
        {/* Left Section - Steps */}
        <div>
          <div className="pool-steps">
            <div
              className={`pool-step ${
                currentStep === 1
                  ? "active"
                  : currentStep > 1
                  ? "completed"
                  : ""
              }`}
            >
              <div className="step-number">1</div>
              <div className="step-content">
                <div className="setting-label">
                  <p>step 1</p>
                  <div className="info-icon-container">
                    <div className="info-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M9,9h0a3,3,0,0,1,6,0c0,2-3,3-3,3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12,17h.01"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div className="info-tooltip">
                      Choose the tokens you want to provide liquidity for. You
                      can select tokens on all supported networks.
                    </div>
                  </div>
                </div>
                <h4>Select token pair and fees</h4>
              </div>
            </div>

            <div
              className={`pool-step ${currentStep === 2 ? "active" : ""} ${
                currentStep < 2 ? "disabled" : ""
              }`}
            >
              <div className="step-number">2</div>
              <div className="step-content">
                <div className="setting-label">
                  <p>step 2</p>
                  <div className="info-icon-container">
                    <div className="info-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M9,9h0a3,3,0,0,1,6,0c0,2-3,3-3,3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12,17h.01"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                    <div className="info-tooltip">
                      Specify the amount of each token to deposit. This will
                      determine your share of the pool and the initial trading
                      price.
                    </div>
                  </div>
                </div>
                <h4>Set price range and deposit amounts</h4>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Form Content */}
        <div className="pool-create-right">
          <div className="pool-form">
            {currentStep === 1 && (
              <>
                <div className="form-section">
                  <h3>Select pair</h3>
                  <p className="section-description">
                    Choose the tokens you want to provide liquidity for. You can
                    select tokens on all supported networks.
                  </p>

                  <div className="token-pair-selectors">
                    <div className="token-selector-container">
                      <TokenSelector
                        selectedToken={tokenA}
                        onTokenSelect={setTokenA}
                        otherSelectedToken={tokenB}
                        onTokenSwap={() => {}}
                      />
                    </div>
                    <div className="token-selector-container">
                      <TokenSelector
                        selectedToken={tokenB}
                        onTokenSelect={setTokenB}
                        otherSelectedToken={tokenA}
                        onTokenSwap={() => {}}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Fee tier</h3>
                  <p className="section-description">
                    The amount earned providing liquidity. Choose an amount that
                    suits your risk tolerance and strategy.
                  </p>

                  <div className="fee-tier-container">
                    <div className="fee-tier-selected">
                      <div className="fee-tier-info">
                        <span className="fee-tier-percentage">
                          0.30% fee tier
                        </span>
                        <span className="fee-tier-detail">Highest TVL</span>
                        <span className="fee-tier-rewards">
                          🟣 4.54% reward APR
                        </span>
                      </div>
                      <div className="fee-tier-description">
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
                <div className="form-section">
                  <h3>Deposit amounts</h3>
                  <div className="token-pair-container">
                    <div className="token-input-container">
                      <div className="token-input-row">
                        <div className="token-input-content">
                          <input
                            className="amount-input"
                            type="number"
                            value={amountA}
                            onChange={(e) => setAmountA(e.target.value)}
                            placeholder="0"
                          />
                          <TokenSelector
                            selectedToken={tokenA}
                            onTokenSelect={() => {}} // Disabled in step 2
                            otherSelectedToken={tokenB}
                            onTokenSwap={() => {}} // Disabled in step 2
                          />
                        </div>
                        {tokenA && (
                          <div className="token-balance-info">
                            <span className="balance-text">
                              Balance:{" "}
                              {tokenA
                                ? formatUnits(balanceA, tokenA.decimals)
                                : "0.00"}{" "}
                              {tokenA.symbol}
                            </span>
                            <button
                              className="max-button"
                              onClick={setMaxAmountA}
                            >
                              MAX
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="plus-container">
                      <div className="plus-icon">+</div>
                    </div>

                    <div className="token-input-container">
                      <div className="token-input-row">
                        <div className="token-input-content">
                          <input
                            className="amount-input"
                            type="number"
                            value={amountB}
                            onChange={(e) => setAmountB(e.target.value)}
                            placeholder="0"
                          />
                          <TokenSelector
                            selectedToken={tokenB}
                            onTokenSelect={() => {}} // Disabled in step 2
                            otherSelectedToken={tokenA}
                            onTokenSwap={() => {}} // Disabled in step 2
                          />
                        </div>
                        {tokenB && (
                          <div className="token-balance-info">
                            <span className="balance-text">
                              Balance:{" "}
                              {tokenB
                                ? formatUnits(balanceB, tokenB.decimals)
                                : "0.00"}{" "}
                              {tokenB.symbol}
                            </span>
                            <button
                              className="max-button"
                              onClick={setMaxAmountB}
                            >
                              MAX
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pool Preview */}
                {tokenA && tokenB && (
                  <div className="form-section">
                    <h3>Pool Preview</h3>
                    <div className="pool-preview">
                      <div className="pool-pair">
                        <span>
                          {tokenA.symbol} / {tokenB.symbol}
                        </span>
                        <span className="fee-badge">{v2FeeTier}%</span>
                      </div>
                      {amountA && amountB && (
                        <div className="pool-ratio">
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

export default PoolCreate;
