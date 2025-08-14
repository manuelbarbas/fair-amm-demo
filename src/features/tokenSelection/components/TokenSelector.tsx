import React from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { getTokens, getTokenIcon, getAllTokensWithChain, chainMetadata } from '../../../config/config'
import './tokenSelector.css'

interface Token {
  address: `0x${string}`
  decimals: number
  symbol: string
  name: string
  chainId?: number // Add chainId to token interface
}

interface TokenSelectorProps {
  selectedToken: Token | null
  onTokenSelect: (token: Token) => void
  otherSelectedToken?: Token | null // The other token in the pair for smart swapping
  onTokenSwap?: () => void // Callback to swap the two tokens
}


// Helper function to shorten address
const shortenAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const TokenSelector: React.FC<TokenSelectorProps> = ({ 
  selectedToken, 
  onTokenSelect, 
  otherSelectedToken, 
  onTokenSwap 
}) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [selectedChain, setSelectedChain] = React.useState<number | 'all'>('all')
  const currentChainId = useChainId()
  const { switchChain } = useSwitchChain()
  
  const allTokens = getAllTokensWithChain()
  
  // Filter tokens based on selected chain
  const filteredTokens = selectedChain === 'all' 
    ? allTokens
    : allTokens.filter(token => token.chainId === selectedChain)

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const handleSelect = async (token: Token & { chainId: number }) => {
    if (otherSelectedToken && 
        token.symbol === otherSelectedToken.symbol &&
        (token.chainId === otherSelectedToken.chainId || 
         (!otherSelectedToken.chainId && token.chainId === currentChainId))) {
      if (onTokenSwap) {
        console.log('Smart swapping tokens:', token.symbol, 'with', otherSelectedToken.symbol)
        onTokenSwap()
        setIsOpen(false)
        return
      }
    }
    
    // If token is on different chain, switch chain first
    if (token.chainId !== currentChainId) {
      try {
        await switchChain({ chainId: token.chainId })
      } catch (error) {
        console.error('Failed to switch chain:', error)
        // Still proceed with token selection even if chain switch fails
      }
    }
    
    onTokenSelect(token)
    setIsOpen(false)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false)
    }
  }

  return (
    <div className="token-selector">
      <div className="selected-token" onClick={handleToggle}>
        {selectedToken ? (
          <>
            <img 
              src={getTokenIcon(selectedToken.symbol)} 
              alt={selectedToken.symbol} 
              className="token-icon"
            />
            <span className="token-symbol">{selectedToken.symbol}</span>
          </>
        ) : (
          <span>Select Token</span>
        )}
        <span className="arrow">▼</span>
      </div>
      
      {/* Modal Overlay */}
      {isOpen && (
        <div className="token-modal-overlay" onClick={handleBackdropClick}>
          <div className="token-modal" onClick={(e) => e.stopPropagation()}>
            <div className="token-modal-header">
              <div className="search-container">
                <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 21L16.514 16.506L21 21ZM19 10.5C19 15.194 15.194 19 10.5 19C5.806 19 2 15.194 2 10.5C2 5.806 5.806 2 10.5 2C15.194 2 19 5.806 19 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input 
                  type="text" 
                  placeholder="Search token name or paste address"
                  className="token-search-input"
                />
              </div>
              <button className="close-button" onClick={() => setIsOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            {/* Chain Filter */}
            <div className="chain-filter">
              <button 
                className={`chain-filter-button ${selectedChain === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedChain('all')}
              >
                All
              </button>
              {chainMetadata.map(chain => (
                <button
                  key={chain.id}
                  className={`chain-filter-button ${selectedChain === chain.id ? 'active' : ''}`}
                  onClick={() => setSelectedChain(chain.id)}
                >
                  <span className="chain-badge">{chain.symbol.charAt(0)}</span>
                  {chain.name}
                </button>
              ))}
            </div>
            
            {/* Token List */}
            <div className="token-list">
              <div className="token-list-header">
                <span>Most popular</span>
              </div>
              
              <div className="token-options">
                {filteredTokens.map((token) => (
                  <div
                    key={`${token.chainId}-${token.address}`}
                    className="token-modal-option"
                    onClick={() => handleSelect(token)}
                  >
                    <div className="token-modal-option-left">
                      <img 
                        src={getTokenIcon(token.symbol)} 
                        alt={token.symbol} 
                        className="token-modal-icon"
                      />
                      <div className="token-modal-info">
                        <div className="token-modal-name">{token.name}</div>
                        <div className="token-modal-details">
                          <span className="token-modal-symbol">{token.symbol}</span>
                          <span className="token-modal-chain">{token.chainName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="token-modal-address">
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
  )
}

export default TokenSelector
