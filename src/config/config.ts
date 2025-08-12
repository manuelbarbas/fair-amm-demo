import { createWeb3Modal } from '@web3modal/wagmi/react'
import { http, createConfig } from 'wagmi'
import { defineChain } from 'viem'
import type { Chain } from 'viem'
import { QueryClient } from '@tanstack/react-query'

// Import chain configurations
import biteTestnetConfig from './chains/bite_testnet.json'
import fairTestnetConfig from './chains/fair_testnet.json'

// Types
export interface TokenConfig {
  address: `0x${string}`
  decimals: number
  symbol: string
  name: string
}

export interface ChainConfig {
  id: number
  name: string
  displayName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: {
    default: {
      http: string[]
    }
  }
  blockExplorers: {
    default: {
      name: string
      url: string
    }
  }
  router: string
  tokens: Record<string, TokenConfig>
}

// Load all chain configurations
const chainConfigurations: ChainConfig[] = [
  biteTestnetConfig,
  fairTestnetConfig
]

// Create chain definitions dynamically
export const chains: Chain[] = chainConfigurations.map(config => 
  defineChain({
    id: config.id,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: config.rpcUrls,
    blockExplorers: config.blockExplorers,
  })
)

// Create transports dynamically
const transports = chainConfigurations.reduce((acc, config) => {
  acc[config.id] = http()
  return acc
}, {} as Record<number, any>)

// Create Wagmi config
export const config = createConfig({
  chains: chains as [Chain, ...Chain[]],
  transports,
})

// Create query client
export const queryClient = new QueryClient()

// Project ID from WalletConnect
const projectId = '5640f8ac273351a13f937edd31bc51f6'

// Create Web3Modal
createWeb3Modal({
  wagmiConfig: config,
  projectId,
  enableAnalytics: true,
})

// Dynamic chain configs - generated from JSON files
export const chainConfigs = chainConfigurations.reduce((acc, config) => {
  acc[config.id] = {
    name: config.displayName,
    router: config.router as `0x${string}`,
    tokens: Object.fromEntries(
      Object.entries(config.tokens).map(([key, token]) => [
        key,
        {
          ...token,
          address: token.address as `0x${string}`,
        },
      ])
    ),
  }
  return acc
}, {} as Record<number, any>)

// Generate chain metadata for UI components
export const chainMetadata = chainConfigurations.map(config => ({
  id: config.id,
  name: config.displayName,
  symbol: config.nativeCurrency.symbol,
  nativeSymbol: config.nativeCurrency.symbol,
}))

// Helper functions to get chain-specific data
export const getChainConfig = (chainId: number) => {
  return chainConfigs[chainId as keyof typeof chainConfigs]
}

export const getTokens = (chainId: number) => {
  return getChainConfig(chainId)?.tokens || {}
}

export const getRouter = (chainId: number) => {
  return getChainConfig(chainId)?.router
}

// Get chain by ID
export const getChainById = (chainId: number) => {
  return chains.find(chain => chain.id === chainId)
}

// Get all available tokens across all chains
export const getAllTokensWithChain = () => {
  const allTokens: Array<TokenConfig & { chainId: number; chainName: string }> = []
  
  chainMetadata.forEach(chain => {
    const chainTokens = getTokens(chain.id)
    Object.values(chainTokens).forEach(token => {
      allTokens.push({
        ...token,
        chainId: chain.id,
        chainName: chain.name,
      })
    })
  })
  
  return allTokens
}

// This piece needs to be directly set on the chain details json
import fairTokenIcon from '../assets/fair_token.png'
import sklTokenIcon from '../assets/skl_token.png'
import usdcTokenIcon from '../assets/usdc_token.png'

// Dynamic token icon mapping
export const getTokenIcon = (symbol: string): string => {
  const iconMap: Record<string, string> = {
    'WFAIR': fairTokenIcon,
    'WBITE': fairTokenIcon,
    'SKL': sklTokenIcon,
    'USDC': usdcTokenIcon,
  }
  
  return iconMap[symbol] || fairTokenIcon // fallback
}

// Check if token is native wrapped token
export const isNativeWrappedToken = (symbol: string): boolean => {
  const nativeTokens = chainMetadata.map(chain => `W${chain.nativeSymbol}`)
  return nativeTokens.includes(symbol)
}

// Get native tokens for all chains
export const getNativeTokens = (): string[] => {
  return chainMetadata.map(chain => `W${chain.nativeSymbol}`)
}

// Backward compatibility - defaults to first available chain
export const defaultChain = chains[0]
export const tokens = chainConfigs[defaultChain.id]?.tokens || {}
export const UNISWAP_V2_ROUTER = chainConfigs[defaultChain.id]?.router
