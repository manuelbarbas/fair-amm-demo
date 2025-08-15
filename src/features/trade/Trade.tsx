import React, { useMemo, useState } from "react";
import { useTransactionSettings } from "../../hooks/useTransactionSettings";
import Swap from "./swap/components/Swap";
import styles from "./Trade.module.css";
import {Settings} from "../../components/Settings/Settings";

// Define the available trading modes
type TradeMode = "swap" | "bridge" | "buy" | "sell";

export const Trade: React.FC = () => {
  const [mode, setMode] = useState<TradeMode>("swap");

  const defaultSwapSettings = useMemo(
    () => ({
      slippage: { isAuto: true, value: 0.5 },
      deadline: 20,
      biteEncryption: true,
    }),
    []
  );

  const swapSettings = useTransactionSettings({
    storageKey: "swapTransactionSettings",
    defaultSettings: defaultSwapSettings,
  });

  const renderContent = () => {
    switch (mode) {
      case "swap":
        // Pass the settings down to the Swap component
        return <Swap settings={swapSettings.settings} />;
      case "bridge":
        return <div>Bridge UI Coming Soon</div>; // Placeholder
      case "buy":
        return <div>Buy UI Coming Soon</div>; // Placeholder
      default:
        return <Swap settings={swapSettings.settings} />;
    }
  };

  return (
    <div className={styles.tradeContainer}>
      {/* Wrapper for nav and settings button */}
      <div className={styles.controlsHeader}>
        <nav className={styles.nav}>
          <button
            onClick={() => setMode("swap")}
            className={mode === "swap" ? styles.active : ""}
          >
            Swap
          </button>
          <button
          >
            Bridge
          </button>
          {/* Add other buttons here */}
          <div className={styles.settings}>
          <Settings settingsHook={swapSettings} transactionType="swap" />
          </div>
        </nav>
      </div>

      <div className={styles.content}>{renderContent()}</div>
    </div>
  );
};
