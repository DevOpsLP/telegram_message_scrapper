// websocket.ts

import { USDMClient, ModifyFuturesOrderParams, OrderSide } from 'binance';
import * as dotenv from 'dotenv';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
export const tradeSignalEmitter = new EventEmitter();
import { OrderResponse, TradeSignal } from './types';

dotenv.config();

const API_KEY = process.env.BINANCE_API_KEY || '';
const API_SECRET = process.env.BINANCE_API_SECRET || '';

if (!API_KEY || !API_SECRET) {
  console.error('Error: BINANCE_API_KEY and BINANCE_API_SECRET must be set in the .env file.');
  process.exit(1);
}

const client = new USDMClient({
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Helper function to introduce a delay
async function delay(ms: number): Promise<void> {
   return new Promise((resolve) => setTimeout(resolve, ms));
}

// Map to track active WebSocket connections and trading pairs along with current target index
const activePairs: Map<string, { tradeSignal: TradeSignal; stopLossOrderId: string; ws: WebSocket; currentTargetIndex: number }> = new Map();

tradeSignalEmitter.on('newTradeSignal', (data: { tradeSignal: TradeSignal; orderResponse: OrderResponse }) => {
  const { tradeSignal, orderResponse } = data;
  const pair = tradeSignal.pair.toUpperCase();

  console.log(`Received new trade signal and order response for ${pair}`);
  console.log(`Stop loss order placed successfully:`, orderResponse);

  if (activePairs.has(pair)) {
    console.log(`WebSocket for ${pair} already exists. Skipping...`);
    return;
  }

  console.log(`Creating a new WebSocket for ${pair}`);
  createWebSocketForPair(tradeSignal, orderResponse); // Pass origClientOrderId
});

// Create a WebSocket for the specific trading pair
function createWebSocketForPair(tradeSignal: TradeSignal, orderResponse: OrderResponse): void {
  const pair = tradeSignal.pair.toLowerCase();
  const wsUrl = `wss://fstream.binance.com/ws/${pair}@markPrice`; // Track mark price changes

  const ws = new WebSocket(wsUrl);
  const stopLossOrderId: string = orderResponse.clientOrderId;
  // Initialize with the stop loss order and set currentTargetIndex to -1 (meaning no target reached yet)
  activePairs.set(tradeSignal.pair, { tradeSignal, stopLossOrderId , ws, currentTargetIndex: -1 });

  ws.on('open', () => {
    console.log(`WebSocket connected for ${tradeSignal.pair}`);
  });

  ws.on('message', (data: WebSocket.Data) => {
    const event = JSON.parse(data.toString());

    if (event.e === 'markPriceUpdate') {
      const currentPrice = parseFloat(event.p);
      console.log(`Price update for ${tradeSignal.pair}: ${currentPrice}`);

      // Handle trailing stop logic based on the current price
      handleTrailingStop(tradeSignal, orderResponse, currentPrice);
    }
  });

  ws.on('close', () => {
    console.log(`WebSocket closed for ${tradeSignal.pair}`);
    activePairs.delete(tradeSignal.pair); // Remove from the map when WebSocket is closed
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for ${tradeSignal.pair}:`, err);
  });
}

// Function to modify the stop loss order using modifyOrder API
async function modifyStopLossOrder(symbol: string, side: OrderSide, origClientOrderId: string, newStopPrice: number, quantity: number) {
  const params: ModifyFuturesOrderParams = {
    symbol,
    origClientOrderId, // Use the original client order ID
    price: newStopPrice,
    side,
    quantity
  };

  try {
    const modifyOrderResponse = await client.modifyOrder(params);
    console.log(`Stop loss order modified successfully for ${symbol}:`, modifyOrderResponse);
  } catch (error) {
    console.error(`Error modifying stop loss order for ${symbol}:`, error);
  }
}

// Handle trailing stop logic and modify stop loss order
async function handleTrailingStop(tradeSignal: TradeSignal, orderResponse: OrderResponse, currentPrice: number): Promise<void> {
  const { direction, targets, entry } = tradeSignal;
  const symbol = tradeSignal.pair.toUpperCase();
  const pairData = activePairs.get(tradeSignal.pair);
  const side = tradeSignal.direction.toUpperCase() == 'LONG' ? 'BUY' : 'SELL'
  if (!pairData) return;

  const { currentTargetIndex } = pairData;
  let newStopLoss: number | null = null;

  if (direction.toUpperCase() === 'LONG') {
    
    // Iterate over targets and check if we need to update stop loss
    for (let i = 0; i < targets.length; i++) {
      if (currentPrice >= targets[i] && i > currentTargetIndex) {
        // Update stop loss to entry for first target, or previous target for others
        newStopLoss = i === 0 ? entry : targets[i - 1];
        console.log(`Updating stop loss for ${symbol} to ${newStopLoss} as target ${i} is reached.`);
        pairData.currentTargetIndex = i; // Update current target index
        break;
      }
    }

    // If the price has reached the last target, close the position
    if (currentTargetIndex < targets.length - 1 && currentPrice >= targets[targets.length - 1]) {
      console.log(`Price reached the final target for ${symbol}. Closing position...`);
      await delay(5000); // Delay for 5 seconds
      client.cancelAllOpenOrders({ symbol })
        .then(response => console.log(`All orders canceled for ${symbol}`, response))
        .catch(error => console.error(`Error canceling orders for ${symbol}:`, error));
    }
  } else if (direction.toUpperCase() === 'SHORT') {
    for (let i = 0; i < targets.length; i++) {
      if (currentPrice <= targets[i] && i > currentTargetIndex) {
        newStopLoss = i === 0 ? entry : targets[i - 1];
        console.log(`Updating stop loss for ${symbol} to ${newStopLoss} as target ${i} is reached.`);
        pairData.currentTargetIndex = i;
        break;
      }
    }

    if (currentTargetIndex < targets.length - 1 && currentPrice <= targets[targets.length - 1]) {
      console.log(`Price reached the final target for ${symbol}. Closing position...`);
      await delay(5000); // Delay for 5 seconds
      client.cancelAllOpenOrders({ symbol })
        .then(response => console.log(`All orders canceled for ${symbol}`, response))
        .catch(error => console.error(`Error canceling orders for ${symbol}:`, error));
    }
  }

  if (newStopLoss !== null) {
    modifyStopLossOrder(symbol, side, orderResponse.clientOrderId, parseFloat(newStopLoss.toFixed(2)), parseFloat(orderResponse.origQty) );
  }
}

// Keep the script running indefinitely
function keepAlive(): void {
  setInterval(async () => {
    // const response = await client.cancelAllOpenOrders({ symbol: "XRPUSDT" })
  }, 1000); // Set an empty interval to keep the event loop alive
}

// Start the keep-alive function
keepAlive();

console.log('websocket.ts: Listening for new trade signals...');
