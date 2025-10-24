/**
 * Example 5: Auto-Reconnection
 *
 * Demonstrates:
 * - Auto-reconnect configuration
 * - Connection state tracking
 * - Handling connection loss
 * - Manual reconnection
 */

import { XTTSClient, ConnectionState } from '../src';

async function main() {
  const client = new XTTSClient({
    apiKey: process.env.XTTS_API_KEY || 'your-api-key',
    voice: 'emma',
    autoReconnect: true, // Enable auto-reconnect
    connectionTimeout: 10000
  });

  // Track connection state changes
  client.on('connected', () => {
    const state = client.getConnectionState();
    console.log('✅ Connected');
    console.log('   State:', state.state);
    console.log('   Server:', state.serverUrl);
    console.log('   Auto-reconnect:', state.autoReconnect);
  });

  client.on('disconnected', (code, reason) => {
    const state = client.getConnectionState();
    console.log('❌ Disconnected');
    console.log('   Code:', code);
    console.log('   Reason:', reason);
    console.log('   State:', state.state);
    console.log('   Will reconnect:', state.autoReconnect && code !== 1000);
  });

  client.on('reconnecting', (attempt, maxAttempts, delay) => {
    console.log(`🔄 Reconnecting...`);
    console.log(`   Attempt: ${attempt}/${maxAttempts}`);
    console.log(`   Delay: ${delay}ms`);
    console.log(`   Backoff: exponential (${Math.pow(2, attempt - 1)}x base delay)`);
  });

  client.on('error', (error) => {
    if (error.code === 503) {
      console.log('⚠️  Max reconnection attempts reached');
      console.log('   Consider manual intervention or retry later');
    }
  });

  try {
    console.log('Initial connection...');
    await client.connect();

    // Check connection state
    let state = client.getConnectionState();
    console.log('\nConnection State:');
    console.log(JSON.stringify(state, null, 2));

    // Perform synthesis
    console.log('\nPerforming synthesis...');
    const audio = await client.synthesize({
      text: 'Testing auto-reconnect functionality.'
    });
    console.log(`Synthesis successful: ${audio.length} bytes`);

    // Demonstrate manual reconnection
    console.log('\nTesting manual reconnection...');
    client.disconnect();

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Manually reconnect
    console.log('Manually reconnecting...');
    await client.reconnect();

    state = client.getConnectionState();
    console.log('Reconnected! Attempts reset to:', state.reconnectAttempts);

    // Another synthesis to confirm
    const audio2 = await client.synthesize({
      text: 'Successfully reconnected!'
    });
    console.log(`Second synthesis successful: ${audio2.length} bytes`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
    console.log('\nFinal disconnect');
  }
}

main();
