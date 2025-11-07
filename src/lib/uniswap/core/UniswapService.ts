import { TradeType } from '@uniswap/sdk-core';
import type { Currency } from '@uniswap/sdk-core';
import { CurrencyAmount, Token } from '@uniswap/sdk-core';
import type { PublicClient, WalletClient } from 'viem';
import { parseUnits } from 'viem';

// Import quote services
import { V2QuoteService } from '../quotes/V2QuoteService';
import { V3QuoteService } from '../quotes/V3QuoteService';

// Import swap services
import { V2SwapService } from '../swaps/V2SwapService';
import { V3SwapService } from '../swaps/V3SwapService';

// Import types
import type { 
  IUniswapService,
  UnifiedQuote,
  UniversalSwapOptions,
  BestQuoteResult,
  V2Quote,
  V3Quote,
  UniswapServiceConfig
} from './types';
import type { TokenConfig } from '../../../config/config';

export class UniswapService implements IUniswapService {
  private v2QuoteService: V2QuoteService;
  private v3QuoteService: V3QuoteService;
  private v2SwapService: V2SwapService;
  private v3SwapService: V3SwapService;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private chainId: number;

  constructor(config: UniswapServiceConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.chainId = config.chainId;

    // Initialize quote services
    this.v2QuoteService = new V2QuoteService(config.publicClient);
    this.v3QuoteService = new V3QuoteService(config.publicClient);
    
    // Initialize swap services
    this.v2SwapService = new V2SwapService(config.publicClient, config.walletClient);
    this.v3SwapService = new V3SwapService(config.publicClient, config.walletClient);
  }

  // Alternative constructor for backward compatibility
  static create(publicClient: PublicClient, walletClient?: WalletClient): UniswapService {
    const chainId = publicClient.chain?.id;
    if (!chainId) {
      throw new Error('Chain ID not found on public client');
    }

    return new UniswapService({
      publicClient,
      walletClient,
      chainId
    });
  }

  async getQuote(
    amount: CurrencyAmount<Currency>,
    toToken: Currency,
    tradeType: TradeType = TradeType.EXACT_INPUT
  ): Promise<BestQuoteResult | null> {
    try {
      console.log(
        `Getting quotes from all versions for ${
          amount.toSignificant(6)
        } ${amount.currency.symbol} -> ${toToken.symbol}`
      );

      // Convert currencies to tokens for the quote services
      const fromToken = this.currencyToToken(amount.currency);
      const toTokenAsToken = this.currencyToToken(toToken);
      
      if (!fromToken || !toTokenAsToken) {
        console.error('Could not convert currencies to tokens');
        return null;
      }
      
      // Create token amount with converted token
      const tokenAmount = CurrencyAmount.fromRawAmount(fromToken, amount.quotient);

      // Get quotes from V2 and V3 in parallel
      const [v2Quote, v3Quote] = await Promise.allSettled([
        this.v2QuoteService.getQuote(tokenAmount, toTokenAsToken, this.chainId),
        this.v3QuoteService.getQuote(tokenAmount, toTokenAsToken, this.chainId),
      ]);

      // Collect successful quotes
      const validQuotes: UnifiedQuote[] = [];
      
      if (v2Quote.status === 'fulfilled' && v2Quote.value) {
        validQuotes.push(v2Quote.value);
      }
      if (v3Quote.status === 'fulfilled' && v3Quote.value) {
        validQuotes.push(v3Quote.value);
      }

      if (validQuotes.length === 0) {
        console.log('No routes found across any Uniswap version.');
        return null;
      }

      // Select the best quote
      const bestQuote = this.selectBestQuote(validQuotes);
      
      console.log(
        `Best quote: ${bestQuote.quote.version.toUpperCase()} with output ${
          bestQuote.quote.amountOut.toString()
        }. Reason: ${bestQuote.reason}`
      );

      return bestQuote;
    } catch (error) {
      console.error('Error getting quotes:', error);
      return null;
    }
  }

  private selectBestQuote(quotes: UnifiedQuote[]): BestQuoteResult {
    // Sort by output amount (descending)
    const sortedByOutput = [...quotes].sort((a, b) => {
      if (a.amountOut > b.amountOut) return -1;
      if (a.amountOut < b.amountOut) return 1;
      return 0;
    });

    const bestByOutput = sortedByOutput[0];
    
    // In a production system, you might want more sophisticated selection:
    // - Consider gas costs
    // - Consider price impact
    // - Consider reliability/liquidity
    // - User preferences
    
    // For now, we'll just pick the highest output amount
    let reason = `Highest output amount (${bestByOutput.amountOut.toString()})`;
    
    // Add some context about why this version won
    if (quotes.length > 1) {
      const versions = quotes.map(q => q.version).join(', ');
      reason += `. Compared against: ${versions}`;
    }
    
    return {
      quote: bestByOutput,
      reason,
    };
  }

  private currencyToToken(currency: Currency): Token | null {
    if (currency instanceof Token) {
      return currency;
    }
    
    // Handle native currency by using a placeholder token address
    if (currency.isNative) {
      return new Token(
        this.chainId,
        '0x0000000000000000000000000000000000000000', // Use zero address for native
        currency.decimals,
        currency.symbol || 'ETH',
        currency.name || 'Ether'
      );
    }
    
    return null;
  }

  /**
   * Convert TokenConfig to Uniswap SDK Token
   * This eliminates the need for consumers to do this conversion
   */
  static tokenConfigToToken(tokenConfig: TokenConfig, chainId: number): Token {
    return new Token(
      chainId,
      tokenConfig.address,
      tokenConfig.decimals,
      tokenConfig.symbol,
      tokenConfig.name
    );
  }

  /**
   * Helper method for getting quotes with TokenConfig (more convenient for consumers)
   */
  async getQuoteFromTokenConfig(
    fromTokenConfig: TokenConfig,
    toTokenConfig: TokenConfig,
    amount: string,
    tradeType: TradeType = TradeType.EXACT_INPUT
  ): Promise<BestQuoteResult | null> {
    const fromToken = UniswapService.tokenConfigToToken(fromTokenConfig, this.chainId);
    const toToken = UniswapService.tokenConfigToToken(toTokenConfig, this.chainId);
    
    const currencyAmount = CurrencyAmount.fromRawAmount(
      fromToken,
      parseUnits(amount, fromToken.decimals).toString()
    );
    
    return this.getQuote(currencyAmount, toToken, tradeType);
  }

  async executeSwap(
    quote: UnifiedQuote,
    options: UniversalSwapOptions
  ): Promise<`0x${string}`> {
    if (!this.walletClient || !this.walletClient.account) {
      throw new Error('Wallet client not connected');
    }

    try {
      console.log(`Executing ${quote.version.toUpperCase()} swap via direct routing`);
      
      // Route to the appropriate swap service
      let txHash: `0x${string}`;
      
      switch (quote.version) {
        case 'v2':
          // Update wallet client for swap services
          this.v2SwapService = new V2SwapService(this.publicClient, this.walletClient);
          txHash = await this.v2SwapService.executeSwap(
            quote as V2Quote,
            {
              slippageTolerance: options.slippageTolerance,
              deadline: options.deadline,
              recipient: options.recipient,
              amountIn: options.amountIn,
            },
            this.chainId
          );
          break;
          
        case 'v3':
          // Update wallet client for swap services
          this.v3SwapService = new V3SwapService(this.publicClient, this.walletClient);
          txHash = await this.v3SwapService.executeSwap(
            quote as V3Quote,
            {
              slippageTolerance: options.slippageTolerance,
              deadline: options.deadline,
              recipient: options.recipient,
              amountIn: options.amountIn,
            },
            this.chainId
          );
          break;
          
        default:
          throw new Error(`Unsupported quote version: ${(quote as any).version}`);
      }

      console.log('Swap transaction sent:', txHash);
      return txHash;
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }


  // Utility methods for external use
  updateWalletClient(walletClient: WalletClient): void {
    this.walletClient = walletClient;
    // Update swap services with new wallet client
    this.v2SwapService = new V2SwapService(this.publicClient, walletClient);
    this.v3SwapService = new V3SwapService(this.publicClient, walletClient);
  }

  getChainId(): number {
    return this.chainId;
  }

  getSupportedVersions(): string[] {
    return ['v2', 'v3'];
  }
}
