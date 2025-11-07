import type { PublicClient, WalletClient } from 'viem'
import { encodeFunctionData } from 'viem'
import { ERC20_ABI } from '../../../abi/ERC20'
import { UNISWAP_V2_ROUTER_ABI } from '../../../abi/UniswapV2Router'
import { getV2RouterAddress, isNativeToken } from '../../../config/config'
import type { V2PoolCreationParams, V2PoolQuote, BasePoolOptions } from './types'
import { readContract, writeContract } from '../../../hooks/useContracts'

export class V2PoolService {
  constructor(private publicClient: PublicClient, private walletClient?: WalletClient) {}

  async getTokenBalance(token: { address: `0x${string}`; decimals: number }, user: `0x${string}`): Promise<bigint> {
    if (isNativeToken(token as any)) return this.publicClient.getBalance({ address: user })
    return (await readContract(this.publicClient, ERC20_ABI, token.address, 'balanceOf', [user])) as bigint
  }

  async getTokenAllowance(token: `0x${string}`, owner: `0x${string}`, spender: `0x${string}`): Promise<bigint> {
    return (await readContract(this.publicClient, ERC20_ABI, token, 'allowance', [owner, spender])) as bigint
  }

  async approveToken(token: `0x${string}`, spender: `0x${string}`, amount: bigint, isBite?: boolean): Promise<`0x${string}`> {
    if (!this.walletClient) throw new Error('Wallet client not available')
    return writeContract(this.walletClient, ERC20_ABI, token, 'approve', [spender, amount], !!isBite)
  }

  async getQuote(params: Omit<V2PoolCreationParams, 'amountAMin' | 'amountBMin'>): Promise<V2PoolQuote | null> {
    try {
      // Simplified quote (no reserves yet). In future, fetch reserves and compute amounts.
      return {
        version: 'v2',
        amountA: params.amountADesired,
        amountB: params.amountBDesired,
        liquidityAmount: params.amountADesired + params.amountBDesired,
        share: 100,
        fee: 0.3,
      }
    } catch (e) {
      return null
    }
  }

  async createPool(params: V2PoolCreationParams, options: BasePoolOptions & { user: `0x${string}`; chainId: number; biteEncryption?: boolean }): Promise<`0x${string}`> {
    if (!this.walletClient) throw new Error('Wallet client not available')
    const router = getV2RouterAddress(options.chainId)
    if (!router) throw new Error('V2 router not configured for chain')

    const deadline = BigInt(options.deadline)

    const isTokenANative = isNativeToken(params.tokenA as any)
    const isTokenBNative = isNativeToken(params.tokenB as any)

    if (isTokenANative || isTokenBNative) {
      const [token, amountTokenDesired, amountTokenMin, amountETHMin, ethValue] = isTokenANative
        ? [params.tokenB, params.amountBDesired, params.amountBMin, params.amountAMin, params.amountADesired]
        : [params.tokenA, params.amountADesired, params.amountAMin, params.amountBMin, params.amountBDesired]

      return writeContract(
        this.walletClient,
        UNISWAP_V2_ROUTER_ABI,
        router,
        'addLiquidityETH',
        [token.address, amountTokenDesired, amountTokenMin, amountETHMin, options.user, deadline],
        !!options.biteEncryption,
        ethValue,
      )
    }

    return writeContract(
      this.walletClient,
      UNISWAP_V2_ROUTER_ABI,
      router,
      'addLiquidity',
      [
        params.tokenA.address,
        params.tokenB.address,
        params.amountADesired,
        params.amountBDesired,
        params.amountAMin,
        params.amountBMin,
        options.user,
        deadline,
      ],
      !!options.biteEncryption,
    )
  }
}

