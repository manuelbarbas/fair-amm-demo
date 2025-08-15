import React, { useState } from 'react';
import { useChainId, useSwitchChain } from 'wagmi';
import { getAllTokensWithChain, chainMetadata, getTokenIcon } from '../../config/config';
// 1. Import the CSS module correctly
import styles from './TokenSelector.module.css';

interface Token {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
  name: string;
  chainId?: number;
  chainName?: string;
}

interface TokenSelectorProps {
  selectedToken: Token | null;
  onTokenSelect: (token: Token) => void;
  otherSelectedToken?: Token | null;
  onTokenSwap?: () => void;
}

// Helper function to shorten address
const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const TokenSelector: React.FC<TokenSelectorProps> = ({ 
  selectedToken, 
  onTokenSelect, 
  otherSelectedToken, 
  onTokenSwap 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState<number | 'all'>('all');
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  const allTokens = getAllTokensWithChain();
  
  const filteredTokens = selectedChain === 'all' 
    ? allTokens
    : allTokens.filter(token => token.chainId === selectedChain);

  const handleSelect = async (token: Token) => {
    if (otherSelectedToken && 
        token.symbol === otherSelectedToken.symbol &&
        (token.chainId === otherSelectedToken.chainId || 
         (!otherSelectedToken.chainId && token.chainId === currentChainId))) {
      if (onTokenSwap) {
        onTokenSwap();
        setIsOpen(false);
        return;
      }
    }
    
    if (token.chainId && token.chainId !== currentChainId) {
      try {
        await switchChain({ chainId: token.chainId });
      } catch (error) {
        console.error('Failed to switch chain:', error);
      }
    }
    
    onTokenSelect(token);
    setIsOpen(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  // 2. Replace all className strings with {styles.className}
  return (
    <div className={styles.tokenSelector}>
      <div className={styles.selectedToken} onClick={() => setIsOpen(true)}>
        {selectedToken ? (
          <>
            <img 
              src={getTokenIcon(selectedToken.symbol)} 
              alt={selectedToken.symbol} 
              className={styles.tokenIcon}
            />
            <span className={styles.tokenSymbol}>{selectedToken.symbol}</span>
          </>
        ) : (
          <span>Select Token</span>
        )}
        <span className={styles.arrow}>▼</span>
      </div>
      
      {isOpen && (
        <div className={styles.tokenModalOverlay} onClick={handleBackdropClick}>
          <div className={styles.tokenModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.tokenModalHeader}>
              <div className={styles.searchContainer}>
                <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input 
                  type="text" 
                  placeholder="Search token name or paste address"
                  className={styles.tokenSearchInput}
                />
              </div>
              <button className={styles.closeButton} onClick={() => setIsOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            <div className={styles.chainFilter}>
              <button 
                className={`${styles.chainFilterButton} ${selectedChain === 'all' ? styles.active : ''}`}
                onClick={() => setSelectedChain('all')}
              >
                All
              </button>
              {chainMetadata.map(chain => (
                <button
                  key={chain.id}
                  className={`${styles.chainFilterButton} ${selectedChain === chain.id ? styles.active : ''}`}
                  onClick={() => setSelectedChain(chain.id)}
                >
                  <span className={styles.chainBadge}>{chain.symbol.charAt(0)}</span>
                  {chain.name}
                </button>
              ))}
            </div>
            
            <div className={styles.tokenList}>
              <div className={styles.tokenListHeader}>
                <span>Most popular</span>
              </div>
              
              <div className={styles.tokenOptions}>
                {filteredTokens.map((token) => (
                  <div
                    key={`${token.chainId}-${token.address}`}
                    className={styles.tokenModalOption}
                    onClick={() => handleSelect(token)}
                  >
                    <div className={styles.tokenModalOptionLeft}>
                      <img 
                        src={getTokenIcon(token.symbol)} 
                        alt={token.symbol} 
                        className={styles.tokenModalIcon}
                      />
                      <div className={styles.tokenModalInfo}>
                        <div className={styles.tokenModalName}>{token.name}</div>
                        <div className={styles.tokenModalDetails}>
                          <span className={styles.tokenModalSymbol}>{token.symbol}</span>
                          <span className={styles.tokenModalChain}>{token.chainName}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.tokenModalAddress}>
                      {shortenAddress(token.address)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenSelector;
