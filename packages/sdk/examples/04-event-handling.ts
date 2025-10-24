/**
 * Example 4: Event Handling
 *
 * Demonstrates:
 * - All client events
 * - Error categorization
 * - Connection lifecycle events
 * - Event-based audio streaming
 */

import { XTTSClient, ErrorCategory } from '../src';

async function main() {
  const client = new XTTSClient({
    apiKey: process.env.XTTS_API_KEY || 'your-api-key',
    voice: 'emma',
    autoReconnect: true // Enable auto-reconnect for demonstration
  });

  // Connection events
  client.on('connected', () => {
    console.log('📡 Connected to XTTS server');
  });

  client.on('disconnected', (code, reason) => {
    console.log(`📴 Disconnected: ${code} - ${reason}`);
  });

  client.on('reconnecting', (attempt, maxAttempts, delay) => {
    console.log(`🔄 Reconnecting (${attempt}/${maxAttempts}) in ${delay}ms...`);
  });

  // Audio events (for event-based streaming)
  const audioChunks: Buffer[] = [];

  client.on('audioChunk', ({ audio, requestId }) => {
    console.log(`🎵 Audio chunk: ${audio.length} bytes (request: ${requestId})`);
    audioChunks.push(audio);
  });

  client.on('complete', ({ audio, requestId }) => {
    console.log(`✅ Synthesis complete (request: ${requestId})`);
    audioChunks.push(audio);
  });

  // Error events
  client.on('error', (errorData) => {
    console.error(`❌ Error [${errorData.category}]:`, errorData.message);
    console.error(`   Code: ${errorData.code}`);
    if (errorData.requestId) {
      console.error(`   Request: ${errorData.requestId}`);
    }

    // Handle different error categories
    switch (errorData.category) {
      case ErrorCategory.AUTH:
        console.error('   → Authentication issue - check your API key');
        break;

      case ErrorCategory.VALIDATION:
        console.error('   → Invalid request - check your parameters');
        break;

      case ErrorCategory.CONNECTION:
        console.error('   → Connection issue - auto-reconnect may help');
        break;

      case ErrorCategory.TIMEOUT:
        console.error('   → Request timed out - try again');
        break;

      case ErrorCategory.SERVER:
        console.error('   → Server error - contact support if persists');
        break;

      case ErrorCategory.CLIENT:
        console.error('   → Client error - check your code');
        break;
    }

    // Access original error if available
    if (errorData.originalError) {
      console.error('   Original error:', errorData.originalError.stack);
    }
  });

  try {
    console.log('Connecting...');
    await client.connect();

    // Perform synthesis using event-based approach
    console.log('\nStarting synthesis...');
    await client.synthesize({
      text: 'This example demonstrates comprehensive event handling in the XTTS SDK.',
      requestId: 'demo-request'
    });

    console.log(`\nCollected ${audioChunks.length} audio chunks via events`);

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    client.disconnect();
  }
}

main();
