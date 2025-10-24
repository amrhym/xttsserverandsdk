#!/usr/bin/env node

/**
 * Test WebSocket connection to xttsws.xcai.io
 */

const { XTTSClient } = require('xtts-sdk');

async function testPublicEndpoint() {
  console.log('\n' + '='.repeat(70));
  console.log('Testing XTTS Public WebSocket Endpoint');
  console.log('='.repeat(70));
  console.log('\nEndpoint: wss://xttsws.xcai.io');
  console.log('API Key: xtts_k9L2m...qR8sT\n');

  const client = new XTTSClient({
    apiKey: 'xtts_k9L2mN8pQ4rT6vX1wY3zA5bC7dE9fH0jK2lM4nP6qR8sT',
    serverUrl: 'wss://xttsws.xcai.io',
    voice: 'en-US-1',
    autoReconnect: false,
  });

  let connected = false;

  client.on('connected', () => {
    connected = true;
    console.log('✓ Connected to public endpoint!');
  });

  client.on('disconnected', (code, reason) => {
    console.log(`✗ Disconnected: ${code} - ${reason}`);
  });

  client.on('error', (error) => {
    console.error(`✗ Error: ${error.message} (code: ${error.code})`);
  });

  try {
    console.log('[TEST 1] Connecting to wss://xttsws.xcai.io...');
    await client.connect();

    if (!connected) {
      throw new Error('Failed to connect');
    }

    // Wait for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n[TEST 2] Synthesizing test audio...');
    const result = await client.synthesize({
      text: 'Hello! This is a test of the public XTTS endpoint.',
      timeout: 30000,
    });

    console.log(`✓ Synthesis successful!`);
    console.log(`  Audio size: ${result.audioData.length} bytes`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Request ID: ${result.requestId}`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Public endpoint test PASSED!');
    console.log('='.repeat(70));
    console.log('\nThe public endpoint wss://xttsws.xcai.io is working correctly!\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ Test FAILED');
    console.error('='.repeat(70));
    console.error('\nError:', error.message);
    console.error('\nPossible issues:');
    console.error('  1. Server not running (check: npx pm2 status xtts-server)');
    console.error('  2. Nginx not configured correctly');
    console.error('  3. SSL certificate issue');
    console.error('  4. Firewall blocking connection\n');
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

testPublicEndpoint();
