import { MarginType, USDMClient } from 'binance';
import * as dotenv from 'dotenv';
import { TradeSignal } from './types';

// Load environment variables from .env file
dotenv.config();
const BALANCE = 7; // USD value of the position

// Read Binance API credentials from environment variables
const API_KEY = process.env.BINANCE_API_KEY || '';
const API_SECRET = process.env.BINANCE_API_SECRET || '';

if (!API_KEY || !API_SECRET) {
  console.error('Error: BINANCE_API_KEY and BINANCE_API_SECRET must be set in the .env file.');
  process.exit(1);
}

// Create a Binance USDM client instance
const client = new USDMClient({
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Function to place an order based on the TradeSignal
export async function placeOrder(tradeSignal: TradeSignal): Promise<any> {
  try {
    const symbol = tradeSignal.pair.toUpperCase();
    const side = tradeSignal.direction.toUpperCase() === 'LONG' ? 'BUY' : 'SELL';

    // Set leverage and margin type
    await client.setLeverage({ symbol, leverage: tradeSignal.leverage });

    // Get symbol information
    const exchangeInfo = await client.getExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find((info) => info.symbol === symbol);

    if (symbolInfo) {
      const entryPrice = tradeSignal.entry.toFixed(symbolInfo.pricePrecision); // Convert entry to string with precision
      const quantity = parseFloat(((BALANCE / parseFloat(entryPrice)) * tradeSignal.leverage).toFixed(symbolInfo.quantityPrecision));

      console.log(`Entry: ${entryPrice} / Quantity: ${quantity}`);

      // Get the last target price from the targets array
      const targetPrice = tradeSignal.targets[tradeSignal.targets.length - 1].toFixed(symbolInfo.pricePrecision);

      // Get the stop loss price from the tradeSignal
      const stopPrice = tradeSignal.stopLoss.toFixed(symbolInfo.pricePrecision);

      console.log(`Target Price: ${targetPrice} / Stop Price: ${stopPrice}`);

      // Place the initial order
      const orderResponse = await client.submitNewOrder({
        symbol,
        side,
        type: 'LIMIT',
        timeInForce: 'GTC',
        quantity: quantity, // Convert quantity to string
        price: parseFloat(entryPrice), // Entry price already formatted as string
      });

      console.log('Initial order placed successfully:', orderResponse);

      // Place take profit order with target price
      const takeProfitResponse = await client.submitNewOrder({
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side for take profit
        type: 'TAKE_PROFIT_MARKET',
        timeInForce: 'GTC',
        quantity: quantity,
        stopPrice: parseFloat(targetPrice), // Use stopPrice field for target price in TAKE_PROFIT_MARKET orders
      });

      console.log('Take profit order placed successfully:', takeProfitResponse);

      // Place stop loss order with stop loss price
      const stopLossResponse = await client.submitNewOrder({
        symbol,
        side: side === 'BUY' ? 'SELL' : 'BUY', // Opposite side for stop loss
        type: 'STOP_MARKET',
        timeInForce: 'GTC',
        quantity: quantity,
        stopPrice: parseFloat(stopPrice), // Use stopPrice field for stop loss price
      });

      console.log('Stop loss order placed successfully:', stopLossResponse);

      return stopLossResponse; // Return all responses as a single object
    } else {
      throw new Error(`Symbol information not found for ${symbol}`);
    }
  } catch (error) {
    console.error('Error placing order:', error);
    throw error; // Ensure error is thrown so caller can handle it
  }
}

