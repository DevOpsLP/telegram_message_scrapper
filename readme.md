# Trading Bot Documentation

This documentation provides a detailed explanation of the trading bot's code, its functionality, and setup instructions. The bot listens to Telegram messages for trade signals, places orders on Binance Futures, and manages trailing stop losses via WebSocket connections.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
    - [.env File](#env-file)
    - [Obtain Telegram API Credentials](#obtain-telegram-api-credentials)
    - [Obtain Binance API Credentials](#obtain-binance-api-credentials)
- [Code Overview](#code-overview)
  - [1. index.ts](#1-indexts)
  - [2. websocket.ts](#2-websocketts)
  - [3. parseMessage.ts](#3-parsemessagets)
  - [4. order_management.ts](#4-order_managementts)
  - [5. types.ts](#5-typests)
- [Functionality](#functionality)
  - [Telegram Integration](#telegram-integration)
  - [Trade Signal Parsing](#trade-signal-parsing)
  - [Order Placement](#order-placement)
  - [WebSocket Connection](#websocket-connection)
  - [Trailing Stop Loss Logic](#trailing-stop-loss-logic)
- [Important Notes](#important-notes)
- [License](#license)

## Overview

This trading bot automates the process of executing trade signals received via Telegram. It connects to a specified Telegram channel, listens for new messages containing trade signals, parses these signals, and then places corresponding orders on Binance Futures. The bot also manages trailing stop losses using WebSocket connections to adjust orders as the market price changes.

## Prerequisites

- **Node.js** (v14 or higher recommended)
- **npm** or **yarn** package manager
- A **Binance** account with API key and secret
- A **Telegram** account with API ID and hash
- Basic knowledge of **TypeScript** and **Node.js**

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/yourrepository.git
cd yourrepository
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables
***.env File***

Create a ***.env*** file in the root directory of your project with the following content:
```bash
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
```

Replace `your_telegram_api_id`, `your_telegram_api_hash`, `your_binance_api_key`, and `your_binance_api_secret` with your actual credentials.

***Obtain Telegram API Credentials***.

To interact with the Telegram API, you need to obtain an API ID and API Hash:

Go to [my.telegram.org](https://my.telegram.org) and log in with your Telegram account.
Fill in the required details to create a new application.
You will receive an API ID and an API Hash. 
Use these in your .env file.

***.Obtain Binance API Credentials***.

To interact with the Binance API, you need to create API keys:

Log in to your Binance account.
Navigate to the API Management section.
Create a new API key and secret. Make sure to enable Futures Trading permissions.
Use these credentials in your .env file.

***Change the BALANCE in the order_management.ts file***.

```typescript
import { MarginType, USDMClient } from 'binance';
import * as dotenv from 'dotenv';
import { TradeSignal } from './types';

// rest of the code

const BALANCE = 7; // Change this value to the desired one
````

## Code Overview

### 1. index.ts

This is the main entry point of the application. It performs the following tasks:

- **Telegram Client Connection**: Connects to the Telegram client using the provided API credentials.
- **Session Management**: Saves and loads the session to avoid re-authentication.
- **Event Handling**: Listens for new messages in a specified Telegram channel.
- **Message Parsing**: Parses incoming messages to extract trade signals.
- **Order Placement**: Places initial orders on Binance using the parsed trade signals.
- **Event Emission**: Emits events for further processing (e.g., trailing stop loss adjustments).

### 2. websocket.ts

This module manages WebSocket connections to Binance Futures for real-time market data:

- **Event Listening**: Listens for events emitted by `index.ts` when new trade signals are processed.
- **WebSocket Connections**: Establishes WebSocket connections for each trading pair to receive price updates.
- **Trailing Stop Loss Logic**: Implements trailing stop loss logic based on market price movements.
- **Order Modification**: Modifies existing stop loss orders using Binance's `modifyOrder` API.
- **Connection Management**: Keeps the script running and maintains active WebSocket connections.

### 3. parseMessage.ts

This module contains the `parseMessage` function, which:

- **Message Parsing**: Parses raw message text received from Telegram.
- **Data Extraction**: Extracts trading information such as pair, direction, leverage, entry price, targets, and stop loss.
- **Validation**: Validates that all required information is present before returning a `TradeSignal` object.

### 4. order_management.ts

This module contains the `placeOrder` function, which:

- **Leverage and Margin Setup**: Sets leverage and margin type on Binance Futures according to the trade signal.
- **Quantity Calculation**: Calculates the order quantity based on the balance and leverage.
- **Order Placement**: Places initial limit orders.
- **Stop Loss and Take Profit Orders**: Places associated stop loss and take profit orders.
- **Response Handling**: Returns the stop loss order response for further processing.

### 5. types.ts

This module defines TypeScript interfaces and types used throughout the application:

- **TradeSignal**: Defines the structure of a trade signal.
- **OrderResponse**: Defines the structure of the order response from Binance.

## Functionality

### Telegram Integration

- **Authentication**: The bot connects to the Telegram API using the `telegram` package and authenticates using the API credentials provided in the `.env` file.
- **Session Persistence**: Saves the session after the first successful login to avoid repeated authentication prompts.
- **Channel Monitoring**: Listens to a specific Telegram channel for new messages containing trade signals.

### Trade Signal Parsing

- **Message Processing**: When a new message is received, it is processed to extract relevant trading information.
- **Regex Parsing**: Uses regular expressions to identify and extract key components like pair, direction, leverage, entry price, targets, and stop loss.
- **Error Handling**: If the message does not contain all required fields, it logs an error and skips processing.

### Order Placement

- **Binance Client Setup**: Sets up a Binance Futures client using API credentials from the `.env` file.
- **Leverage and Margin Configuration**: Adjusts leverage and margin type based on the trade signal.
- **Order Execution**: Places the initial limit order, along with corresponding stop loss and take profit orders.
- **Order Response**: Returns the response from the stop loss order for further processing.

### WebSocket Connection

- **Event Handling**: Listens for new trade signals emitted by `index.ts`.
- **Real-time Price Updates**: Establishes WebSocket connections for each trading pair to receive real-time market price updates.
- **Connection Tracking**: Manages active WebSocket connections to prevent duplicate connections for the same trading pair.

### Trailing Stop Loss Logic

- **Price Monitoring**: Monitors the market price and compares it against predefined targets.
- **Stop Loss Adjustment**: Adjusts the stop loss order when the price reaches certain targets using the `modifyOrder` API.
- **Final Target Handling**: Introduces a delay before closing all positions when the final target is reached to ensure all orders are executed properly.
- **Order Cancellation**: Cancels all open orders for a symbol when the final target is achieved.

## Important Notes

- **API Permissions**: Ensure that your Binance API keys have the necessary permissions for futures trading.
- **Security**: Keep your API keys secure and do not share them publicly.
- **Balance Configuration**: The bot uses a fixed balance (`BALANCE = 7`) for order calculations; adjust this according to your trading strategy and risk management.
- **Testing**: It's highly recommended to test the bot using a testnet or in a controlled environment before deploying it with real funds.
- **Error Handling**: The bot includes basic error handling, but you may want to enhance it to cover more edge cases and exceptions.
