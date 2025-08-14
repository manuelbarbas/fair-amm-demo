import { useState, useEffect } from 'react';

export interface SwapSettingsData {
  slippage: {
    isAuto: boolean;
    value: number;
  };
  deadline: number; // in minutes
  biteEncryption: boolean;
}

export const DEFAULT_SETTINGS: SwapSettingsData = {
  slippage: {
    isAuto: true,
    value: 0.5,
  },
  deadline: 20,
  biteEncryption: true,
};

export const useSwapSettings = (initialSettings?: SwapSettingsData) => {
  const [settings, setSettings] = useState<SwapSettingsData>(
    initialSettings || DEFAULT_SETTINGS
  );
  const [isOpen, setIsOpen] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('swapSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (error) {
        console.warn('Failed to parse saved settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('swapSettings', JSON.stringify(settings));
  }, [settings]);

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

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
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
    resetToDefaults,
    setSettings,
    
    // Computed values
    effectiveSlippage,
    slippageMultiplier,
  };
};
