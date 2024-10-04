import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { Api } from 'telegram/tl';
import * as readline from 'readline';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import bigInt, { BigInteger } from 'big-integer';
import { parseMessage } from './parseMessage';
import { placeOrder } from './order_management';
import { tradeSignalEmitter } from './websocket'; // Import event emitter
import { OrderResponse } from './types';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let sessionString: string | undefined;

try {
  sessionString = fs.readFileSync('session.data', 'utf8');
  console.log('Session loaded from session.data');
} catch (e) {
  console.log('No saved session found.');
}

const apiId: number = parseInt(process.env.TELEGRAM_API_ID || '', 10);
const apiHash: string = process.env.TELEGRAM_API_HASH || '';

if (isNaN(apiId) || !apiHash) {
  console.error('Error: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in the .env file.');
  process.exit(1);
}

const originalChannelIdString: string = '-1002230847160';
const channelIdStringWithoutPrefix = originalChannelIdString.replace('-100', '');
const channelId: BigInteger = bigInt(channelIdStringWithoutPrefix);

const stringSession = new StringSession(sessionString || '');
const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

async function main(): Promise<void> {
  try {
    if (!sessionString) {
      await client.start({
        phoneNumber: async () => {
          return new Promise<string>((resolve) => {
            rl.question('Please enter your phone number: ', (input) => {
              resolve(input);
            });
          });
        },
        password: async () => {
          return new Promise<string>((resolve) => {
            rl.question('Please enter your 2FA password (if enabled): ', (input) => {
              resolve(input);
            });
          });
        },
        phoneCode: async () => {
          return new Promise<string>((resolve) => {
            rl.question('Please enter the code you received: ', (input) => {
              resolve(input);
            });
          });
        },
        onError: (err: Error) => {
          console.log('An error occurred during authentication:', err);
        },
      });
      sessionString = stringSession.save();
      fs.writeFileSync('session.data', sessionString);
      console.log('Session saved!');
      rl.close();
    } else {
      await client.connect();
    }

    console.log('Connected!');

    const channel = (await client.getEntity(
      new Api.InputPeerChannel({
        channelId: channelId,
        accessHash: bigInt(0), // Placeholder, will be fetched automatically
      })
    )) as Api.Channel;

    client.addEventHandler(
        async (event: NewMessageEvent) => {
          const message = event.message;
      
          if (message.peerId instanceof Api.PeerChannel) {
            const peerChannel = message.peerId as Api.PeerChannel;
            if (peerChannel.channelId.equals(channel.id)) {
              const messageText = message.message;
              console.log('New message received from the channel:');
              console.log(messageText);
      
              const tradeSignal = parseMessage(messageText);
      
              if (tradeSignal) {
                console.log('Parsed Trade Signal:', tradeSignal);
      
                try {
                  // Place the order and get the order response
                  const stopLossResponse: OrderResponse = await placeOrder(tradeSignal);
                  
                  // Emit an event with both the tradeSignal and the stopLossResponse
                  tradeSignalEmitter.emit('newTradeSignal', { tradeSignal, orderResponse: stopLossResponse });
                } catch (error) {
                  console.error('Failed to place order:', error);
                }
              } else {
                console.log('Failed to parse trade signal.');
              }
            }
          }
        },
        new NewMessage({})
      );
      

    setInterval(async () => {
      try {
        await client.getMe();
        console.log('Connection is alive');
      } catch (error) {
        console.error('Connection seems to be lost:', error);
        try {
          await client.connect();
          console.log('Reconnected successfully');
        } catch (reconnectError) {
          console.error('Failed to reconnect:', reconnectError);
        }
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Error connecting to Telegram:', error);
  }
}

main();
