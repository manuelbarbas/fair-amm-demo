import React from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import TokenSelector from "../../tokenSelection/components/TokenSelector";
import { useSwap } from "../hooks/useSwap";
import type { Token } from "../services/swap";
import type { SwapSettingsData } from "../hooks/useSwapSettings";
import "./swap.css";

interface SwapProps {
  swapSettings: SwapSettingsData;
}

const Swap: React.FC<SwapProps> = ({ swapSettings }) => {
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
    isLoadingQuote,
    setFromToken,
    setToToken,
    setFromAmount,
    handleApprove,
    handleSwap,
    handleSwitchTokens,
    setMaxFromAmount,
    swapService,
  } = useSwap(swapSettings);

  return (
    <div className="swap-container">
      <div className="swap-form">
        <div className="token-inputs-wrapper">
          <div className="token-input-container">
            <div className="token-input-row">
              <div className="token-input-content">
                <input
                  className="amount-input"
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
                  className="balance-display"
                  onClick={setMaxFromAmount}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                    width="18"
                    height="18"
                  >
                    <path
                      fill="currentColor"
                      d="M15.6 4.6H1.85v-.55l12.1-.968v.968h1.65V2.4c0-1.21-.98-2.059-2.177-1.888L2.378 2.089C1.18 2.26.2 3.39.2 4.6v11a2.2 2.2 0 002.2 2.2h13.2a2.2 2.2 0 002.2-2.2V6.8a2.2 2.2 0 00-2.2-2.2zm-1.65 7.707a1.65 1.65 0 01-.63-3.176 1.65 1.65 0 11.63 3.176z"
                    ></path>
                  </svg>
                  <span>
                    {parseFloat(
                      formatUnits(balance, fromToken.decimals)
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="switch-container">
            <button className="switch-button" onClick={handleSwitchTokens}>
              ↕
            </button>
          </div>

          <div className="token-input-container">
            <div className="token-input-row">
              <div className="token-input-content">
                <input
                  className="amount-input"
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
                <div
                  className="balance-display"
                  onClick={() =>
                    setFromAmount(formatUnits(balanceTo, toToken.decimals))
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                    width="18"
                    height="18"
                  >
                    <path
                      fill="currentColor"
                      d="M15.6 4.6H1.85v-.55l12.1-.968v.968h1.65V2.4c0-1.21-.98-2.059-2.177-1.888L2.378 2.089C1.18 2.26.2 3.39.2 4.6v11a2.2 2.2 0 002.2 2.2h13.2a2.2 2.2 0 002.2-2.2V6.8a2.2 2.2 0 00-2.2-2.2zm-1.65 7.707a1.65 1.65 0 01-.63-3.176 1.65 1.65 0 11.63 3.176z"
                    ></path>
                  </svg>
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

      {address && !isApproved && fromAmount ? (
        <button
          className="approve-button"
          onClick={handleApprove}
          disabled={isConfirming}
        >
          {isConfirming ? "Approving..." : `Approve ${fromToken?.symbol}`}
        </button>
      ) : (
        <button
          className="swap-button"
          onClick={handleSwap}
          disabled={!fromAmount || !toAmount || isConfirming}
        >
          {isConfirming ? "Swapping..." : "Swap"}
        </button>
      )}

      {isConfirmed && (
        <div className="success-message">Swap completed successfully!</div>
      )}
    </div>
  );
};

export default Swap;
