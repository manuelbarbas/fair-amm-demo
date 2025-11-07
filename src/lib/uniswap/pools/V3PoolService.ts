import type { PublicClient, WalletClient } from 'viem';
import { ERC20_ABI } from '../../../abi/ERC20';
import { UNISWAP_V3_POSITION_MANAGER_ABI } from '../../../abi/V3PositionManager';
import { getV3NFTPositionManagerAddress, isNativeToken } from '../../../config/config';
import type { V3PoolCreationParams, V3PoolQuote, BasePoolOptions, V3FeeTier } from './types';
import { readContract, writeContract } from '../../../hooks/useContracts';

// V3 math utilities
const Q96 = 2n ** 96n;

export class V3PoolService {
  constructor(
    private publicClient: PublicClient,
    private walletClient?: WalletClient
  ) {}

  /**
   * Get token balance (native or ERC20)
   */
  async getTokenBalance(
    token: { address: `0x${string}`; decimals: number },
    user: `0x${string}`
  ): Promise<bigint> {
    if (isNativeToken(token as any)) {
      return this.publicClient.getBalance({ address: user });
    }
    return (await readContract(
      this.publicClient,
      ERC20_ABI,
      token.address,
      'balanceOf',
      [user]
    )) as bigint;
  }

  /**
   * Get token allowance for NFT Position Manager
   */
  async getTokenAllowance(
    token: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`
  ): Promise<bigint> {
    return (await readContract(
      this.publicClient,
      ERC20_ABI,
      token,
      'allowance',
      [owner, spender]
    )) as bigint;
  }

  /**
   * Approve token for NFT Position Manager
   */
  async approveToken(
    token: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint,
    isBite?: boolean
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client not available');
    }
    return writeContract(
      this.walletClient,
      ERC20_ABI,
      token,
      'approve',
      [spender, amount],
      !!isBite
    );
  }

  /**
   * Get quote for V3 position (simplified for now)
   */
  async getQuote(
    params: Omit<V3PoolCreationParams, 'amountAMin' | 'amountBMin'>
  ): Promise<V3PoolQuote | null> {
    try {
      // For now, return a simplified quote
      // In production, you'd want to:
      // 1. Check if pool exists
      // 2. Get current price if it exists
      // 3. Calculate liquidity amounts based on price range
      // 4. Estimate gas costs

      const priceRange = this.calculatePriceRange(params.tickLower, params.tickUpper);

      return {
        version: 'v3',
        fee: params.fee,
        amountA: params.amountADesired,
        amountB: params.amountBDesired,
        liquidityAmount: params.amountADesired + params.amountBDesired, // Simplified
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        sqrtPriceX96: params.sqrtPriceX96 || this.calculateCurrentPrice(params.amountADesired, params.amountBDesired),
        priceRange,
        share: 100, // For new positions
      };
    } catch (error) {
      console.error('Error getting V3 quote:', error);
      return null;
    }
  }

  /**
   * Create V3 liquidity position (alias for createPool)
   */
  async createPosition(
    params: V3PoolCreationParams,
    options: BasePoolOptions & { chainId?: number; biteEncryption?: boolean }
  ): Promise<`0x${string}`> {
    // Default chainId if not provided (fallback to mainnet for now)
    const chainId = (options as any).chainId || 1;
    
    return this.createPool(params, {
      ...options,
      user: options.recipient,
      chainId,
      biteEncryption: (options as any).biteEncryption || false,
    });
  }

  /**
   * Create V3 liquidity position
   */
  async createPool(
    params: V3PoolCreationParams,
    options: BasePoolOptions & {
      user: `0x${string}`;
      chainId: number;
      biteEncryption?: boolean;
    }
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client not available');
    }

    const positionManager = getV3NFTPositionManagerAddress(options.chainId);
    if (!positionManager) {
      throw new Error('V3 NFT Position Manager not configured for chain');
    }

    const deadline = BigInt(options.deadline);

    // Handle native token wrapping if needed
    const isTokenANative = isNativeToken(params.tokenA as any);
    const isTokenBNative = isNativeToken(params.tokenB as any);

    // Determine token order (token0 < token1 in V3)
    const token0Address = params.tokenA.address.toLowerCase() < params.tokenB.address.toLowerCase() 
      ? params.tokenA.address 
      : params.tokenB.address;
    
    const token1Address = params.tokenA.address.toLowerCase() < params.tokenB.address.toLowerCase() 
      ? params.tokenB.address 
      : params.tokenA.address;

    const amount0Desired = params.tokenA.address.toLowerCase() < params.tokenB.address.toLowerCase() 
      ? params.amountADesired 
      : params.amountBDesired;
    
    const amount1Desired = params.tokenA.address.toLowerCase() < params.tokenB.address.toLowerCase() 
      ? params.amountBDesired 
      : params.amountADesired;

    const amount0Min = params.tokenA.address.toLowerCase() < params.tokenB.address.toLowerCase() 
      ? params.amountAMin 
      : params.amountBMin;
    
    const amount1Min = params.tokenA.address.toLowerCase() < params.tokenB.address.toLowerCase() 
      ? params.amountBMin 
      : params.amountAMin;

    const mintParams = {
      token0: token0Address,
      token1: token1Address,
      fee: params.fee,
      tickLower: 304500,
      tickUpper: 318420,
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      recipient: options.user,
      deadline,
    };

    // Calculate ETH value if native token is involved
    let value = 0n;
    if (isTokenANative) {
      value = params.amountADesired;
    } else if (isTokenBNative) {
      value = params.amountBDesired;
    }

    return writeContract(
      this.walletClient,
      UNISWAP_V3_POSITION_MANAGER_ABI,
      positionManager,
      'mint',
      [mintParams],
      !!options.biteEncryption,
      value
    );
  }

  /**
   * Calculate price range from ticks
   */
  private calculatePriceRange(tickLower: number, tickUpper: number): { minPrice: number; maxPrice: number } {
    const minPrice = Math.pow(1.0001, tickLower);
    const maxPrice = Math.pow(1.0001, tickUpper);
    
    return { minPrice, maxPrice };
  }

  /**
   * Calculate current price based on token amounts (simplified)
   */
  private calculateCurrentPrice(amountA: bigint, amountB: bigint): bigint {
    // This is a simplified calculation
    // In production, you'd use proper V3 price calculation
    if (amountA === 0n) return 0n;
    
    const ratio = Number(amountB) / Number(amountA);
    const price = Math.sqrt(ratio);
    
    // Convert to sqrtPriceX96 format
    return BigInt(Math.floor(price * Number(Q96)));
  }

  /**
   * Convert price to tick (helper for UI)
   */
  static priceToTick(price: number): number {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }

  /**
   * Convert tick to price (helper for UI)
   */
  static tickToPrice(tick: number): number {
    return Math.pow(1.0001, tick);
  }

  /**
   * Get common V3 fee tiers with descriptions
   */
  static getFeeTiers(): Array<{ fee: V3FeeTier; label: string; description: string }> {
    return [
      { fee: 100, label: '0.01%', description: 'Best for very stable pairs' },
      { fee: 500, label: '0.05%', description: 'Best for stable pairs' },
      { fee: 3000, label: '0.3%', description: 'Best for most pairs' },
      { fee: 10000, label: '1%', description: 'Best for exotic pairs' },
    ];
  }

  /**
   * Get full range ticks (covers all possible prices)
   */
  static getFullRangeTicks() {
    return {
      tickLower: 304500,
      tickUpper: 318420,
    };
  }

  /**
   * Check if tokens need to be sorted (token0 < token1)
   */
  static sortTokens(tokenA: string, tokenB: string): { token0: string; token1: string; swapped: boolean } {
    const swapped = tokenA.toLowerCase() > tokenB.toLowerCase();
    return {
      token0: swapped ? tokenB : tokenA,
      token1: swapped ? tokenA : tokenB,
      swapped,
    };
  }
}
