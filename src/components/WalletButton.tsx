import React, { useState, useRef, useEffect } from 'react';
import { useAccount, useDisconnect, useChainId } from 'wagmi';
import { getChainById } from '../config/config';

const WalletButton: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Get current chain information
  const currentChain = getChainById(chainId);

  // Format address to show first 6 and last 4 characters
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDisconnect = () => {
    disconnect();
    setIsDropdownOpen(false);
  };

  const handleDocsClick = () => {
    window.open('https://docs.skale.space/', '_blank');
    setIsDropdownOpen(false);
  };

  if (!isConnected || !address) {
    return (
      <div className="wallet-button-container">
        <w3m-button />
      </div>
    );
  }

  return (
    <div className="wallet-button-container" ref={dropdownRef}>
      {/* Decorative depth circles */}
      
      <button 
        className="connected-wallet-button"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <div className="wallet-connection-info">
          {currentChain && (
            <span className="chain-name">{currentChain.name}</span>
          )}
          <div className="wallet-icon-connected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 8.5H3C2.45 8.5 2 8.95 2 9.5V17.5C2 18.88 3.12 20 4.5 20H19.5C20.88 20 22 18.88 22 17.5V9.5C22 8.95 21.55 8.5 21 8.5Z" fill="currentColor"/>
              <path d="M4.5 4C3.12 4 2 5.12 2 6.5V7.5H22V6.5C22 5.12 20.88 4 19.5 4H4.5Z" fill="currentColor"/>
              <circle cx="18" cy="14" r="1.5" fill="#fff"/>
            </svg>
          </div>
          <span className="wallet-address">{formatAddress(address)}</span>
        </div>
        <svg 
          className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`} 
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M7 10L12 15L17 10H7Z" fill="currentColor"/>
        </svg>
      </button>

      {isDropdownOpen && (
        <div className="wallet-dropdown">
          <div className="wallet-dropdown-item">
            <div className="wallet-address-full">
              <span>Connected to:</span>
              <span className="address-text" onClick={() => navigator.clipboard.writeText(address)}>
                {address}
              </span>
            </div>
          </div>
          <div className="wallet-dropdown-divider"></div>
          <button 
            className="wallet-dropdown-button"
            onClick={handleDocsClick}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20Z" fill="currentColor"/>
            </svg>
            Docs
          </button>
          <button 
            className="wallet-dropdown-button disconnect"
            onClick={handleDisconnect}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
            </svg>
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletButton;
