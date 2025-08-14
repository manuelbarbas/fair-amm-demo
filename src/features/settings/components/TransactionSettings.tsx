import React, { useState, useRef, useEffect } from 'react';
import { useTransactionSettings } from '../hooks/useTransactionSettings';
import './transactionSettings.css';

export interface TransactionSettingsProps {
  settingsHook: ReturnType<typeof useTransactionSettings>;
  transactionType?: string; // e.g., 'swap', 'pool', etc.
  children?: React.ReactNode; // For transaction-specific settings
}

const TransactionSettings: React.FC<TransactionSettingsProps> = ({ 
  settingsHook, 
  transactionType = 'transaction',
  children 
}) => {
  const {
    settings,
    isOpen,
    closeSettings,
    updateSlippage,
    updateDeadline,
    toggleBiteEncryption,
  } = settingsHook;

  const [customSlippage, setCustomSlippage] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        closeSettings();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeSettings]);

  // Update custom slippage input when settings change
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
      case 'swap':
        return 'Swap deadline';
      case 'pool':
        return 'Pool deadline';
      default:
        return 'Transaction deadline';
    }
  };

  return (
    <div className={`settings-dropdown ${isOpen ? 'open' : ''}`} ref={modalRef}>
      <div className="settings-content">
        {/* Max Slippage */}
        <div className="setting-group">
          <div className="setting-label">
            <span>Max slippage</span>
            <div className="info-icon-container">
              <div className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9,9h0a3,3,0,0,1,6,0c0,2-3,3-3,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12,17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="info-tooltip">
                Your transaction will revert if the price changes more than the slippage percentage
              </div>
            </div>
          </div>
          
          <div className="slippage-options">
            <button
              className={`slippage-option ${settings.slippage.isAuto ? 'active' : ''}`}
              onClick={() => updateSlippage(true)}
            >
              Auto
            </button>
            <div className="custom-slippage">
              <input
                type="number"
                value={settings.slippage.isAuto ? '' : customSlippage}
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                onFocus={() => updateSlippage(false)}
                placeholder="0.5"
                min="0"
                max="50"
                step="0.1"
                className={`slippage-input ${!settings.slippage.isAuto ? 'active' : ''}`}
              />
              <span className="percentage-sign">%</span>
            </div>
          </div>
          
          <div className="current-slippage">
            Current: {settings.slippage.value.toFixed(2)}%
          </div>
        </div>

        {/* Deadline */}
        <div className="setting-group">
          <div className="setting-label">
            <span>{getDeadlineLabel()}</span>
            <div className="info-icon-container">
              <div className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9,9h0a3,3,0,0,1,6,0c0,2-3,3-3,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12,17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="info-tooltip">
                Your transaction will revert if it's pending for more than this period of time. (Maximum: 3 days)
              </div>
            </div>
          </div>
          
          <div className="deadline-input-container">
            <input
              type="number"
              value={settings.deadline}
              onChange={(e) => updateDeadline(parseInt(e.target.value) || 20)}
              min="1"
              max="60"
              className="deadline-input"
            />
            <span className="deadline-unit">minutes</span>
          </div>
        </div>

        {/* BITE Transaction */}
        <div className="setting-group">
          <div className="setting-label">
            <span>BITE Transaction</span>
            <div className="info-icon-container">
              <div className="info-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M9,9h0a3,3,0,0,1,6,0c0,2-3,3-3,3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M12,17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="info-tooltip">
                With BITE enabled you get your transaction encrypted and protected against MEV attacks
              </div>
            </div>
          </div>
          
          <div className="bite-toggle">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.biteEncryption}
                onChange={toggleBiteEncryption}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">
              {settings.biteEncryption ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Custom settings for specific transaction types */}
        {children}
      </div>
    </div>
  );
};

export default TransactionSettings;
