import React from 'react';
import { useTransactionSettings } from '../../hooks/useTransactionSettings';
import { SettingsIcon } from '../UI/SettingsIcon';
import TransactionSettings from './transaction/TransactionSettings';
import styles from './Settings.module.css'; // You would create a new CSS module for this

interface SettingsProps {
  settingsHook: ReturnType<typeof useTransactionSettings>;
  transactionType: 'swap' | 'pool'; // Make this more specific if needed
}

export const Settings: React.FC<SettingsProps> = ({ settingsHook, transactionType }) => {
  return (
    <div className={styles.settingsContainer}>
      <button
        className={styles.settingsIconButton}
        onClick={settingsHook.openSettings}
        title="Transaction settings"
      >
        <SettingsIcon />
      </button>
      <TransactionSettings 
        settingsHook={settingsHook} 
        transactionType={transactionType} 
      />
    </div>
  );
};