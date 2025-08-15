import { useState, useEffect, useMemo } from 'react';

export interface TransactionSettingsData {
  slippage: {
    isAuto: boolean;
    value: number;
  };
  deadline: number; // in minutes
  biteEncryption: boolean;
  [key: string]: any; // Allow for transaction-type specific settings
}

export const DEFAULT_TRANSACTION_SETTINGS: TransactionSettingsData = {
  slippage: {
    isAuto: true,
    value: 0.5,
  },
  deadline: 20,
  biteEncryption: true,
};

export interface TransactionSettingsConfig {
  storageKey: string;
  defaultSettings?: Partial<TransactionSettingsData>;
}

export const useTransactionSettings = (config: TransactionSettingsConfig) => {
  const { storageKey, defaultSettings = {} } = config;
  
  const finalDefaultSettings = useMemo(() => ({ 
    ...DEFAULT_TRANSACTION_SETTINGS, 
    ...defaultSettings 
  }), [defaultSettings]);

  const [settings, setSettings] = useState<TransactionSettingsData>(finalDefaultSettings);
  const [isOpen, setIsOpen] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(storageKey);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...finalDefaultSettings, ...parsed });
      } catch (error) {
        console.warn(`Failed to parse saved settings for ${storageKey}:`, error);
      }
    }
  }, [storageKey, finalDefaultSettings]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [storageKey, settings]);

  const openSettings = () => setIsOpen(true);
  const closeSettings = () => setIsOpen(false);

  const updateSlippage = (isAuto: boolean, value?: number) => {
    setSettings(prev => ({
      ...prev,
      slippage: {
        isAuto,
        value: isAuto ? 0.5 : (value ?? prev.slippage.value),
      },
    }));
  };

  const updateDeadline = (minutes: number) => {
    setSettings(prev => ({
      ...prev,
      deadline: Math.max(1, Math.min(60, minutes)), // Clamp between 1-60 minutes
    }));
  };

  const toggleBiteEncryption = () => {
    setSettings(prev => ({
      ...prev,
      biteEncryption: !prev.biteEncryption,
    }));
  };

  const updateCustomSetting = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetToDefaults = () => {
    setSettings(finalDefaultSettings);
  };

  // Computed values
  const effectiveSlippage = settings.slippage.isAuto ? 0.5 : settings.slippage.value;
  const slippageMultiplier = (100 - effectiveSlippage) / 100; // For calculating minimum amounts

  return {
    // State
    settings,
    isOpen,
    
    // Actions
    openSettings,
    closeSettings,
    updateSlippage,
    updateDeadline,
    toggleBiteEncryption,
    updateCustomSetting,
    resetToDefaults,
    setSettings,
    
    // Computed values
    effectiveSlippage,
    slippageMultiplier,
  };
};
