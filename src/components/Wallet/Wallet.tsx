import React, { useState, useRef, useEffect } from "react";
import { useAccount, useDisconnect, useChainId } from "wagmi";
import { getChainById } from "../../config/config";
// 1. Import the CSS module
import styles from "./Wallet.module.css";
import { SmallWallet, ArrowUp, DocsIcon, DisconnectIcon } from "../UI";

const WalletButton: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentChain = getChainById(chainId);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
  };

  const handleDocsClick = () => {
    window.open("https://docs.skale.space/", "_blank");
    setIsDropdownOpen(false);
  };

  if (!isConnected || !address) {
    // This uses Web3Modal's global styling, which is correct.
    return (
      <div>
        <w3m-button />
      </div>
    );
  }

  // 2. Replace all className strings with {styles.className}
  return (
    <div className={styles.walletButtonContainer} ref={dropdownRef}>
      <button
        className={styles.connectedWalletButton}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className={styles.walletConnectionInfo}>
          {currentChain && (
            <span className={styles.chainName}>{currentChain.name}</span>
          )}
          <div className={styles.walletIconConnected}>
            <SmallWallet />
          </div>
          <span className={styles.walletAddress}>{formatAddress(address)}</span>
        </div>
        <ArrowUp
          className={`${styles.dropdownArrow} ${
            isDropdownOpen ? styles.open : ""
          }`}
        />
      </button>

      {isDropdownOpen && (
        <div className={styles.walletDropdown}>
          <div className={styles.walletDropdownItem}>
            <div className={styles.walletAddressFull}>
              <span>Connected to:</span>
              <span
                className={styles.addressText}
                onClick={() => navigator.clipboard.writeText(address)}
              >
                {address}
              </span>
            </div>
          </div>
          <div className={styles.walletDropdownDivider}></div>
          <button
            className={styles.walletDropdownButton}
            onClick={handleDocsClick}
          >
            <DocsIcon />
            Docs
          </button>
          <button
            className={`${styles.walletDropdownButton} ${styles.disconnect}`}
            onClick={handleDisconnect}
          >
            <DisconnectIcon />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletButton;
