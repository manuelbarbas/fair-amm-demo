import React from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { biteTestnet, fairTestnet } from '../config/web3'

const ChainSwitcher: React.FC = () => {
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const chains = [
    { id: biteTestnet.id, name: 'BITE Testnet', symbol: 'BITE' },
    { id: fairTestnet.id, name: 'FAIR Testnet', symbol: 'FAIR' },
  ]

  const currentChain = chains.find(chain => chain.id === chainId)

  const handleChainSwitch = (newChainId: number) => {
    if (newChainId !== chainId) {
      switchChain({ chainId: newChainId })
    }
  }

  return (
    <div className="chain-switcher">
      <div className="chain-switcher-label">Network</div>
      <div className="chain-switcher-content">
        {chains.map((chain) => (
          <button
            key={chain.id}
            className={`chain-option ${chainId === chain.id ? 'active' : ''}`}
            onClick={() => handleChainSwitch(chain.id)}
            disabled={chainId === chain.id}
          >
            <div className="chain-info">
              <span className="chain-symbol">{chain.symbol}</span>
              <span className="chain-name">{chain.name}</span>
            </div>
          </button>
        ))}
      </div>
      
      {currentChain && (
        <div className="current-chain-info">
          <span>Connected to: {currentChain.name}</span>
        </div>
      )}
    </div>
  )
}

export default ChainSwitcher
