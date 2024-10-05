import { TradeSignal } from "./types";

export function parseMessage(messageText: string): TradeSignal | null {
  try {
    // Split the message into lines and trim each line
    const lines = messageText.split('\n').map((line) => line.trim());

    // Initialize an object to hold the parsed data
    const tradeSignal: Partial<TradeSignal> = {
      targets: [],
      stopLoss: 'Not defined', // Set default stop loss value as "Not defined"
    };

    // Regular expressions for parsing
    const pairRegex = /📩Pair:\s*(\w+)/;
    const directionRegex = /📉|📈Direction:\s*(\w+)/;
    const leverageRegex = /💯Leverage:\s*(\w+)\s*(\d+)x/;
    const entryRegex = /📊Entry:\s*([\d.]+)/;
    const targetRegex = /✅Target\d*:\s*([\d.]+)/;
    const stopLossRegex = /⛔Stop Loss:\s*([\d.]+)/;

    // Parse each line
    for (const line of lines) {
      let match: any;

      if ((match = pairRegex.exec(line))) {
        tradeSignal.pair = match[1];
      } else if ((match = directionRegex.exec(line))) {
        tradeSignal.direction = match[1];
      } else if ((match = leverageRegex.exec(line))) {
        tradeSignal.marginType = match[1];
        tradeSignal.leverage = parseInt(match[2], 10);
      } else if ((match = entryRegex.exec(line))) {
        tradeSignal.entry = parseFloat(match[1]);
      } else if ((match = targetRegex.exec(line))) {
        const targetValue = match[1];
        const parsedTarget = parseFloat(targetValue);
        if (!isNaN(parsedTarget)) {
          tradeSignal.targets?.push(parsedTarget);
        }
      } else if ((match = stopLossRegex.exec(line))) {
        const stopLossValue = match[1];
        if (!isNaN(parseFloat(stopLossValue))) {
          tradeSignal.stopLoss = parseFloat(stopLossValue);
        }
      }
    }

    // Validate required fields
    if (
      tradeSignal.pair &&
      tradeSignal.direction &&
      tradeSignal.marginType &&
      tradeSignal.leverage !== undefined &&
      tradeSignal.entry !== undefined &&
      tradeSignal.targets && tradeSignal.targets.length > 0
    ) {
      return tradeSignal as TradeSignal;
    } else {
      console.error('Incomplete trade signal data.');
      return null;
    }
  } catch (error) {
    console.error('Error parsing message:', error);
    return null;
  }
}
