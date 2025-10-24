#!/usr/bin/env node

/**
 * Quick Test Script for XTTS SDK
 *
 * Tests the published npm package with your generated API key
 *
 * Usage:
 *   node quick-test-xtts.js YOUR_API_KEY
 */

const { XTTSClient } = require('xtts-sdk');
const fs = require('fs');

// Get API key from command line
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('\n❌ Error: API key required\n');
  console.log('Usage: node quick-test-xtts.js YOUR_API_KEY\n');
  console.log('Generate an API key first:');
  console.log('  cd /home/ubuntu/xtts-minimax-proxy/packages/server');
  console.log('  node scripts/generate-api-key.js "Test Client"\n');
  process.exit(1);
}

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:8765';

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('XTTS SDK Quick Test');
  console.log('='.repeat(70));
  console.log('\nConfiguration:');
  console.log(`  API Key: ${apiKey.substring(0, 10)}...${apiKey.slice(-4)}`);
  console.log(`  Server: ${SERVER_URL}`);
  console.log('');

  const client = new XTTSClient({
    apiKey,
    serverUrl: SERVER_URL,
    voice: 'en-US-1',
    autoReconnect: true,
  });

  // Track events
  let connected = false;

  client.on('connected', () => {
    connected = true;
    console.log('✓ Connected to server');
  });

  client.on('disconnected', (code, reason) => {
    console.log(`✗ Disconnected: ${code} - ${reason}`);
  });

  client.on('error', (error) => {
    console.error(`✗ Error: ${error.message} (code: ${error.code})`);
  });

  try {
    // Test 1: Connection
    console.log('[TEST 1] Connecting...');
    await client.connect();

    if (!connected) {
      throw new Error('Connection failed - no connected event received');
    }

    // Wait a bit for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));

    // Test 2: Basic Synthesis
    console.log('\n[TEST 2] Basic synthesis...');
    const result = await client.synthesize({
      text: 'Hello! This is a test of the XTTS SDK.',
      timeout: 30000,
    });

    console.log(`✓ Synthesis complete`);
    console.log(`  Audio size: ${result.audioData.length} bytes`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Request ID: ${result.requestId}`);

    // Save audio file
    const outputFile = './test-output.mp3';
    fs.writeFileSync(outputFile, result.audioData);
    console.log(`✓ Audio saved to ${outputFile}`);

    // Test 3: Streaming Synthesis
    console.log('\n[TEST 3] Streaming synthesis...');
    const chunks = [];

    await new Promise((resolve, reject) => {
      client.synthesizeStream({
        text: 'This is a streaming test.',
        onChunk: (chunk) => {
          chunks.push(chunk);
          console.log(`  Chunk ${chunks.length}: ${chunk.length} bytes`);
        },
        onComplete: () => {
          resolve();
        },
        onError: (error) => {
          reject(error);
        },
        timeout: 30000,
      });
    });

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    console.log(`✓ Stream complete: ${chunks.length} chunks, ${totalSize} bytes`);

    // Test 4: Connection State
    console.log('\n[TEST 4] Connection state...');
    const state = client.getConnectionState();
    console.log(`✓ State: ${state.state}`);
    console.log(`  Connected: ${state.isConnected}`);
    console.log(`  Auto-reconnect: ${state.autoReconnect}`);

    // Success
    console.log('\n' + '='.repeat(70));
    console.log('✅ All tests passed!');
    console.log('='.repeat(70));
    console.log('\nThe XTTS SDK is working correctly!\n');
    console.log('Next steps:');
    console.log('  1. Install in your project: npm install xtts-sdk');
    console.log('  2. Import and use:');
    console.log('     const { XTTSClient } = require("xtts-sdk");');
    console.log('     const client = new XTTSClient({ apiKey: "..." });');
    console.log('  3. See examples at: packages/sdk/examples/');
    console.log('');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ Test failed');
    console.error('='.repeat(70));
    console.error('\nError:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Is the server running?');
    console.error('     cd /home/ubuntu/xtts-minimax-proxy/packages/server');
    console.error('     npm run start');
    console.error('');
    console.error('  2. Is your API key valid?');
    console.error('     node scripts/generate-api-key.js --list');
    console.error('');
    console.error('  3. Check server logs:');
    console.error('     tail -f logs/server.log');
    console.error('');
    process.exit(1);
  } finally {
    // Cleanup
    client.disconnect();
  }
}

// Run the tests
runTests();
