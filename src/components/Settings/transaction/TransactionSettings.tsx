import React, { useState, useRef, useEffect } from "react";
import { useTransactionSettings } from "../../../hooks/useTransactionSettings";
// 1. Import the CSS module
import styles from "./TransactionSettings.module.css";
import {InfoIcon} from "../../UI"

export interface TransactionSettingsProps {
  settingsHook: ReturnType<typeof useTransactionSettings>;
  transactionType?: string;
  children?: React.ReactNode;
}

const TransactionSettings: React.FC<TransactionSettingsProps> = ({
  settingsHook,
  transactionType = "transaction",
  children,
}) => {
  const {
    settings,
    isOpen,
    closeSettings,
    updateSlippage,
    updateDeadline,
    toggleBiteEncryption,
  } = settingsHook;

  const [customSlippage, setCustomSlippage] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        closeSettings();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, closeSettings]);

  useEffect(() => {
    if (!settings.slippage.isAuto) {
      setCustomSlippage(settings.slippage.value.toString());
    }
  }, [settings.slippage]);

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      updateSlippage(false, numValue);
    }
  };

  const getDeadlineLabel = () => {
    switch (transactionType.toLowerCase()) {
      case "swap":
        return "Swap deadline";
      case "pool":
        return "Pool deadline";
      default:
        return "Transaction deadline";
    }
  };

  // 2. Replace all className strings with {styles.className}
  return (
    <div
      className={`${styles.settingsDropdown} ${isOpen ? styles.open : ""}`}
      ref={modalRef}
    >
      <div className={styles.settingsContent}>
        {/* Max Slippage */}
        <div className={styles.settingGroup}>
          <div className={styles.settingLabel}>
            <span>Max slippage</span>
            <div className={styles.infoIconContainer}>
              <div className={styles.infoIcon}>
                <InfoIcon/>
              </div>
              <div className={styles.infoTooltip}>
                Your transaction will revert if the price changes more than the
                slippage percentage
              </div>
            </div>
          </div>

          <div className={styles.slippageOptions}>
            <button
              className={`${styles.slippageOption} ${
                settings.slippage.isAuto ? styles.active : ""
              }`}
              onClick={() => updateSlippage(true)}
            >
              Auto
            </button>
            <div className={styles.customSlippage}>
              <input
                type="number"
                value={settings.slippage.isAuto ? "" : customSlippage}
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                onFocus={() => updateSlippage(false)}
                placeholder="0.5"
                min="0"
                max="50"
                step="0.1"
                className={`${styles.slippageInput} ${
                  !settings.slippage.isAuto ? styles.active : ""
                }`}
              />
              <span className={styles.percentageSign}>%</span>
            </div>
          </div>

          <div className={styles.currentSlippage}>
            Current: {settings.slippage.value.toFixed(2)}%
          </div>
        </div>

        {/* Deadline */}
        <div className={styles.settingGroup}>
          <div className={styles.settingLabel}>
            <span>{getDeadlineLabel()}</span>
            <div className={styles.infoIconContainer}>
              <div className={styles.infoIcon}>
                <InfoIcon/>
              </div>
              <div className={styles.infoTooltip}>
                Your transaction will revert if it's pending for more than this
                period of time.
              </div>
            </div>
          </div>

          <div className={styles.deadlineInputContainer}>
            <input
              type="number"
              value={settings.deadline}
              onChange={(e) => updateDeadline(parseInt(e.target.value) || 20)}
              min="1"
              max="4320" // 3 days in minutes
              className={styles.deadlineInput}
            />
            <span className={styles.deadlineUnit}>minutes</span>
          </div>
        </div>

        {/* BITE Transaction */}
        <div className={styles.settingGroup}>
          <div className={styles.settingLabel}>
            <span>BITE Transaction</span>
            <div className={styles.infoIconContainer}>
              <div className={styles.infoIcon}>
                <InfoIcon/>
              </div>
              <div className={styles.infoTooltip}>
                With BITE enabled you get your transaction encrypted and
                protected against MEV attacks
              </div>
            </div>
          </div>

          <div className={styles.biteToggle}>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={settings.biteEncryption}
                onChange={toggleBiteEncryption}
              />
              <span className={styles.toggleSlider}></span>
            </label>
            <span className={styles.toggleLabel}>
              {settings.biteEncryption ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
};

export default TransactionSettings;
