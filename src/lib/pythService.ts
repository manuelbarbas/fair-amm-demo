/**
 * Pyth Network service for fetching real-time price feeds
 * Documentation: https://docs.pyth.network/price-feeds/api-reference
 */

const PYTH_BASE_URL = 'https://hermes.pyth.network';

// Price feed IDs for supported tokens
export const PRICE_FEED_IDS = {
  ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  SKL: '0x597d2ae7e4b92165d40f03ae57895e3e8245762a177b6db3274e4322b78f5b82',
  // USDC and USDT are both pegged to 1 USD
  USDC: null,
  USDT: null,
  // FAIR token hardcoded to 5 USD (no price feed available yet)
  FAIR: null,
} as const;

// Token symbols that have fixed USD values
export const FIXED_USD_PRICES = {
  USDC: 1.0,
  USDT: 1.0,
  FAIR: 5.0,
} as const;

export interface PythPriceData {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
}

export interface TokenPrice {
  symbol: string;
  price: number; // Price in USD
  timestamp: number;
  source: 'pyth' | 'fixed';
}

/**
 * Convert Pyth price data to a readable number
 */
const convertPythPrice = (priceStr: string, expo: number): number => {
  const price = parseInt(priceStr);
  return price * Math.pow(10, expo);
};

/**
 * Fetch price for a single token
 */
export const fetchTokenPrice = async (symbol: string): Promise<TokenPrice | null> => {
  // Check if token has a fixed price
  if (symbol in FIXED_USD_PRICES) {
    return {
      symbol,
      price: FIXED_USD_PRICES[symbol as keyof typeof FIXED_USD_PRICES],
      timestamp: Date.now(),
      source: 'fixed',
    };
  }

  // Check if token has a Pyth price feed
  const priceId = PRICE_FEED_IDS[symbol as keyof typeof PRICE_FEED_IDS];
  if (!priceId) {
    console.warn(`No price feed available for token: ${symbol}`);
    return null;
  }

  try {
    const url = `${PYTH_BASE_URL}/api/latest_price_feeds?ids[]=${priceId}&verbose=true`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Pyth API error: ${response.status} ${response.statusText}`);
    }

    const data: PythPriceData[] = await response.json();
    
    if (data.length === 0 || !data[0]?.price) {
      throw new Error(`No price data returned for ${symbol}`);
    }

    const priceData = data[0];
    const price = convertPythPrice(priceData.price.price, priceData.price.expo);
    
    return {
      symbol,
      price,
      timestamp: priceData.price.publish_time * 1000, // Convert to milliseconds
      source: 'pyth',
    };
  } catch (error) {
    console.error(`Failed to fetch price for ${symbol}:`, error);
    return {
      symbol,
      price: 0,
      timestamp: Date.now(),
      source: 'pyth',
    };
  }
};

/**
 * Calculate USD value for a token amount
 */
export const calculateUSDValue = (amount: string | number, tokenPrice: number): number => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount) || numAmount <= 0) return 0;
  return numAmount * tokenPrice;
};

/**
 * Check if a token has price support (either fixed or Pyth feed)
 */
export const hasPriceSupport = (symbol: string): boolean => {
  return symbol in FIXED_USD_PRICES || symbol in PRICE_FEED_IDS;
};
