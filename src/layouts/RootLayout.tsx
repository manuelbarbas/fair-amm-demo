import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';

// Updated import paths
import  WalletButton  from '../components/Wallet/Wallet';
import PreferencesMenu from '../components/Preferences/PreferencesMenu';

// Import CSS Module
import styles from './RootLayout.module.css';

const RootLayout: React.FC = () => {
  return (
    <ThemeProvider>
      <div className={styles.app}>
        <header className={styles.topHeader}>
          <div className={styles.navSection}>
            <NavLink to="/" className={styles.logoLink}>
              <h1>FAIRNESS</h1>
            </NavLink>
            <nav>
              <NavLink 
                to="/" 
                className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}
              >
                Trade
              </NavLink>
              <NavLink 
                to="/pool/create" 
                className={({ isActive }) => isActive ? `${styles.navLink} ${styles.active}` : styles.navLink}
              >
                Pools
              </NavLink>
            </nav>
          </div>
          <div className={styles.controlsSection}>
            <PreferencesMenu />
            <WalletButton />
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
};

export default RootLayout;