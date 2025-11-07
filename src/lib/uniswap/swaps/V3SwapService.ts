import type { PublicClient, WalletClient } from 'viem';
import { encodeFunctionData, encodePacked } from 'viem';
import { UNISWAP_V3_ROUTER_ABI } from '../../../abi/UniswapV3Router';
import { getV3SwapRouterAddress, getWETHAddress } from '../../../config/config';
import type { V3Quote } from '../quotes/V3QuoteService';

export interface V3SwapOptions {
  slippageTolerance: number; // percentage (e.g., 1 for 1%)
  deadline: number; // timestamp
  recipient: `0x${string}`;
  amountIn: bigint;
}

export class V3SwapService {
  constructor(
    private publicClient: PublicClient,
    private walletClient?: WalletClient
  ) {}

  /**
   * Execute a V3 swap directly through the SwapRouter contract
   */
  async executeSwap(
    quote: V3Quote,
    options: V3SwapOptions,
    chainId: number
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client is required for swap execution');
    }

    const routerAddress = getV3SwapRouterAddress(chainId);
    if (!routerAddress) {
      throw new Error(`V3 SwapRouter not found for chain ${chainId}`);
    }

    // Calculate minimum amount out based on slippage tolerance
    const amountOutMinimum = this.calculateAmountOutMinimum(
      quote.amountOut,
      options.slippageTolerance
    );

    // Determine if this involves native ETH
    const isFromETH = this.isETHAddress(quote.tokenIn);
    const isToETH = this.isETHAddress(quote.tokenOut);

    let data: `0x${string}`;
    let value = 0n;

    if (isFromETH || isToETH) {
      // Use multicall for ETH swaps to handle wrapping/unwrapping
      data = await this.buildMulticallData(
        quote,
        options,
        amountOutMinimum,
        chainId,
        isFromETH,
        isToETH
      );
      if (isFromETH) {
        value = options.amountIn;
      }
    } else {
      // Direct token-to-token swap
      data = this.buildExactInputSingleData(
        quote,
        options,
        amountOutMinimum
      );
    }

    // Execute the transaction
    const txHash = await this.walletClient.sendTransaction({
      account: this.walletClient.account!,
      to: routerAddress,
      data,
      value,
      chain: this.walletClient.chain,
    });

    return txHash;
  }

  /**
   * Build exact input single swap data for token-to-token swaps
   */
  private buildExactInputSingleData(
    quote: V3Quote,
    options: V3SwapOptions,
    amountOutMinimum: bigint
  ): `0x${string}` {
    const params = {
      tokenIn: quote.tokenIn,
      tokenOut: quote.tokenOut,
      fee: quote.fee,
      recipient: options.recipient,
      deadline: BigInt(options.deadline),
      amountIn: options.amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n, // No price limit
    };

    return encodeFunctionData({
      abi: UNISWAP_V3_ROUTER_ABI,
      functionName: 'exactInputSingle',
      args: [params],
    });
  }

  /**
   * Build multicall data for ETH swaps (handles wrapping/unwrapping)
   */
  private async buildMulticallData(
    quote: V3Quote,
    options: V3SwapOptions,
    amountOutMinimum: bigint,
    chainId: number,
    isFromETH: boolean,
    isToETH: boolean
  ): Promise<`0x${string}`> {
    const calls: `0x${string}`[] = [];
    const wethAddress = getWETHAddress(chainId);
    
    if (!wethAddress) {
      throw new Error(`WETH address not found for chain ${chainId}`);
    }

    if (isFromETH) {
      // ETH -> Token: Need to use WETH in the swap
      const params = {
        tokenIn: wethAddress,
        tokenOut: quote.tokenOut,
        fee: quote.fee,
        recipient: (isToETH ? '0x0000000000000000000000000000000000000000' : options.recipient) as `0x${string}`, // If to ETH, send to contract first
        deadline: BigInt(options.deadline),
        amountIn: options.amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      };

      const swapCall = encodeFunctionData({
        abi: UNISWAP_V3_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [params],
      });

      calls.push(swapCall);

      if (isToETH) {
        // Need to unwrap WETH to ETH
        const unwrapCall = encodeFunctionData({
          abi: UNISWAP_V3_ROUTER_ABI,
          functionName: 'unwrapWETH9',
          args: [amountOutMinimum, options.recipient],
        });
        calls.push(unwrapCall);
      }
    } else if (isToETH) {
      // Token -> ETH: Swap to WETH then unwrap
      const params = {
        tokenIn: quote.tokenIn,
        tokenOut: wethAddress,
        fee: quote.fee,
        recipient: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Send to contract for unwrapping
        deadline: BigInt(options.deadline),
        amountIn: options.amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      };

      const swapCall = encodeFunctionData({
        abi: UNISWAP_V3_ROUTER_ABI,
        functionName: 'exactInputSingle',
        args: [params],
      });

      calls.push(swapCall);

      // Unwrap WETH to ETH
      const unwrapCall = encodeFunctionData({
        abi: UNISWAP_V3_ROUTER_ABI,
        functionName: 'unwrapWETH9',
        args: [amountOutMinimum, options.recipient],
      });
      calls.push(unwrapCall);
    }

    // Encode multicall
    return encodeFunctionData({
      abi: UNISWAP_V3_ROUTER_ABI,
      functionName: 'multicall',
      args: [calls],
    });
  }

  /**
   * Calculate minimum amount out based on slippage tolerance
   */
  private calculateAmountOutMinimum(
    amountOut: bigint,
    slippageTolerance: number
  ): bigint {
    const slippageBips = BigInt(Math.floor(slippageTolerance * 100)); // Convert to basis points
    const slippageAmount = (amountOut * slippageBips) / 10000n;
    return amountOut - slippageAmount;
  }

  /**
   * Check if an address represents ETH (zero address)
   */
  private isETHAddress(address: `0x${string}`): boolean {
    return address === '0x0000000000000000000000000000000000000000';
  }

  /**
   * Build V3 path for multi-hop swaps (for future use)
   */
  static buildV3Path(
    tokenIn: `0x${string}`,
    tokenOut: `0x${string}`,
    fee: number
  ): `0x${string}` {
    // V3 path encoding: token0 + fee + token1
    return encodePacked(
      ['address', 'uint24', 'address'],
      [tokenIn, fee, tokenOut]
    );
  }

  /**
   * Get common V3 fee tiers
   */
  static getCommonFeeTiers(): number[] {
    return [
      500,   // 0.05% - stablecoin pairs
      3000,  // 0.3% - standard pairs
      10000, // 1% - exotic pairs
    ];
  }
}
