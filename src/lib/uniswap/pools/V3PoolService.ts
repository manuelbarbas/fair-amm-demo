import type { PublicClient, WalletClient } from 'viem';
import { zeroAddress } from 'viem';
import { ERC20_ABI } from '../../../abi/ERC20';
import { UNISWAP_V3_POSITION_MANAGER_ABI } from '../../../abi/V3PositionManager';
import { getV3NFTPositionManagerAddress, isNativeToken } from '../../../config/config';
import type { V3PoolCreationParams, V3PoolQuote, BasePoolOptions, V3FeeTier } from './types';
import { readContract, writeContract } from '../../../hooks/useContracts';

const UNISWAP_V3_FACTORY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'tokenA', type: 'address' },
      { internalType: 'address', name: 'tokenB', type: 'address' },
      { internalType: 'uint24', name: 'fee', type: 'uint24' },
    ],
    name: 'getPool',
    outputs: [{ internalType: 'address', name: 'pool', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const UNISWAP_V3_POOL_ABI = [
  {
    inputs: [],
    name: 'liquidity',
    outputs: [{ internalType: 'uint128', name: '', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

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
    options: BasePoolOptions & {
      chainId?: number;
      biteEncryption?: boolean;
      skipInitialization?: boolean;
      waitForInitializationReceipt?: boolean;
    }
  ): Promise<`0x${string}`> {
    // Default chainId if not provided (fallback to mainnet for now)
    const chainId = options.chainId ?? 1;
    
    return this.createPool(params, {
      ...options,
      user: options.recipient,
      chainId,
      biteEncryption: options.biteEncryption || false,
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
      skipInitialization?: boolean;
      waitForInitializationReceipt?: boolean;
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
    const { token0, token1, swapped } = V3PoolService.sortTokens(
      params.tokenA.address,
      params.tokenB.address
    );
    const token0Address = token0 as `0x${string}`;
    const token1Address = token1 as `0x${string}`;

    const amount0Desired = swapped ? params.amountBDesired : params.amountADesired;
    const amount1Desired = swapped ? params.amountADesired : params.amountBDesired;
    const amount0Min = swapped ? params.amountBMin : params.amountAMin;
    const amount1Min = swapped ? params.amountAMin : params.amountBMin;

    const sqrtPriceForInit = this.resolveInitialSqrtPrice(
      params.sqrtPriceX96,
      amount0Desired,
      amount1Desired
    );

    if (!options.skipInitialization) {
      await this.initializePoolIfNeeded({
        positionManager,
        token0: token0Address,
        token1: token1Address,
        fee: params.fee,
        sqrtPriceX96: sqrtPriceForInit,
        biteEncryption: options.biteEncryption,
        waitForReceipt: options.waitForInitializationReceipt !== false,
      });
    }

    const mintParams = {
      token0: token0Address,
      token1: token1Address,
      fee: params.fee,
      tickLower: params.tickLower,
      tickUpper: params.tickUpper,
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

  private resolveInitialSqrtPrice(
    providedSqrtPrice: bigint | undefined,
    amount0Desired: bigint,
    amount1Desired: bigint
  ): bigint {
    if (providedSqrtPrice && providedSqrtPrice > 0n) {
      return providedSqrtPrice;
    }

    if (amount0Desired === 0n || amount1Desired === 0n) {
      return Q96;
    }

    try {
      const ratio = Number(amount1Desired) / Number(amount0Desired);
      if (!Number.isFinite(ratio) || ratio <= 0) {
        return Q96;
      }
      const sqrtPrice = Math.sqrt(ratio);
      const derived = BigInt(Math.floor(sqrtPrice * Number(Q96)));
      return derived > 0n ? derived : Q96;
    } catch (error) {
      console.warn('Falling back to default sqrtPriceX96:', error);
      return Q96;
    }
  }

  async initializePoolIfNeeded(params: {
    positionManager: `0x${string}`;
    token0: `0x${string}`;
    token1: `0x${string}`;
    fee: V3FeeTier;
    sqrtPriceX96: bigint;
    biteEncryption?: boolean;
    waitForReceipt?: boolean;
  }): Promise<{ executed: boolean; txHash?: `0x${string}` }> {
    if (!this.walletClient) {
      throw new Error('Wallet client not available');
    }

    const sqrtPrice = params.sqrtPriceX96 > 0n ? params.sqrtPriceX96 : Q96;

    const shouldInitialize = await this.needsPoolInitialization({
      positionManager: params.positionManager,
      token0: params.token0,
      token1: params.token1,
      fee: params.fee,
    });

    if (!shouldInitialize) {
      return { executed: false };
    }

    const txHash = await writeContract(
      this.walletClient,
      UNISWAP_V3_POSITION_MANAGER_ABI,
      params.positionManager,
      'createAndInitializePoolIfNecessary',
      [params.token0, params.token1, params.fee, sqrtPrice],
      !!params.biteEncryption
    );

    if (params.waitForReceipt !== false) {
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    }

    return {
      executed: true,
      txHash,
    };
  }

  async needsPoolInitialization(params: {
    positionManager: `0x${string}`;
    token0: `0x${string}`;
    token1: `0x${string}`;
    fee: V3FeeTier;
  }): Promise<boolean> {
    try {
      const factory = (await readContract(
        this.publicClient,
        UNISWAP_V3_POSITION_MANAGER_ABI,
        params.positionManager,
        'factory',
        []
      )) as `0x${string}`;

      if (!factory || factory === zeroAddress) {
        return true;
      }

      const pool = (await readContract(
        this.publicClient,
        UNISWAP_V3_FACTORY_ABI,
        factory,
        'getPool',
        [params.token0, params.token1, params.fee]
      )) as `0x${string}`;

      if (!pool || pool === zeroAddress) {
        return true;
      }

      const liquidity = (await readContract(
        this.publicClient,
        UNISWAP_V3_POOL_ABI,
        pool,
        'liquidity',
        []
      )) as bigint;

      return liquidity === 0n;
    } catch (error) {
      console.warn('Unable to verify V3 pool initialization state. Defaulting to initialize.', error);
      return true;
    }
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
