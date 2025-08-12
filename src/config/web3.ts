import { createWeb3Modal } from '@web3modal/wagmi/react'
import { http, createConfig } from 'wagmi'
import { defineChain } from 'viem'
import { QueryClient } from '@tanstack/react-query'

// Define BITE testnet chain
export const biteTestnet = defineChain({
  id: 1289306510,
  name: 'BITE Testnet',
  nativeCurrency: {
    name: 'Bite',
    symbol: 'BITE',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-v1.skalenodes.com/v1/warm-huge-striped-skale'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BITE Explorer',
      url: 'https://warm-huge-striped-skale.explorer.testnet-v1.skalenodes.com:10001',
    },
  },
})

// Define FAIR testnet chain
export const fairTestnet = defineChain({
  id: 1328435889,
  name: 'FAIR Testnet',
  nativeCurrency: {
    name: 'fair',
    symbol: 'FAIR',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-v1.skalenodes.com/v1/idealistic-dual-miram'],
    },
  },
  blockExplorers: {
    default: {
      name: 'FAIR Explorer',
      url: 'https://idealistic-dual-miram.explorer.testnet-v1.skalenodes.com',
    },
  },
})

// Create Wagmi config
export const config = createConfig({
  chains: [biteTestnet, fairTestnet],
  transports: {
    [biteTestnet.id]: http(),
    [fairTestnet.id]: http(),
  },
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

// Chain configurations
export const chainConfigs = {
  [biteTestnet.id]: {
    name: 'BITE Testnet',
    router: '0xe9De5e77AAF276f981523F48bA80f63A212f099e' as `0x${string}`,
    tokens: {
      SKL: {
        address: '0xc197C7C8Df1685911c29C2394b4f7D46Eaf900C4' as `0x${string}`,
        decimals: 18,
        symbol: 'SKL',
        name: 'SKALE',
      },
      USDC: {
        address: '0x05BD86b5e9A6a8E838ef50cAEB96a502271349D0' as `0x${string}`,
        decimals: 6,
        symbol: 'USDC',
        name: 'USDC',
      },
      WBITE: {
        address: '0x389E0Ec8a0226E96528761b5954830727d892117' as `0x${string}`,
        decimals: 18,
        symbol: 'WBITE',
        name: 'Wrapped BITE',
      },
    },
  },
  [fairTestnet.id]: {
    name: 'FAIR Testnet',
    router: '0x05BD86b5e9A6a8E838ef50cAEB96a502271349D0' as `0x${string}`,
    tokens: {
      SKL: {
        address: '0x2770Fc13a45be852Db0bB90A85D463C03CCa4fA6' as `0x${string}`,
        decimals: 18,
        symbol: 'SKL',
        name: 'SKALE',
      },
      USDC: {
        address: '0x389E0Ec8a0226E96528761b5954830727d892117' as `0x${string}`,
        decimals: 6,
        symbol: 'USDC',
        name: 'USDC',
      },
      WFAIR: {
        address: '0x4706C664ab84B7d6b9a7911cFB47b1f81335b208' as `0x${string}`,
        decimals: 18,
        symbol: 'WFAIR',
        name: 'Wrapped FAIR',
      },
    },
  },
}

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

// Backward compatibility - defaults to BITE testnet
export const tokens = chainConfigs[biteTestnet.id].tokens
export const UNISWAP_V2_ROUTER = chainConfigs[biteTestnet.id].router
