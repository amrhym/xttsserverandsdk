# XTTS SDK Testing Guide

Complete guide for testing the npm package and generating API keys.

## Table of Contents

1. [Server Setup & API Key Generation](#server-setup--api-key-generation)
2. [Testing the npm Package](#testing-the-npm-package)
3. [Quick Test Scripts](#quick-test-scripts)
4. [Troubleshooting](#troubleshooting)

---

## Server Setup & API Key Generation

### 1. Start the XTTS Server

First, ensure your XTTS server is running:

```bash
cd /home/ubuntu/xtts-minimax-proxy/packages/server
npm run start

# Or with PM2 for production:
pm2 start npm --name "xtts-server" -- run start
```

The server should start on `ws://localhost:8765` by default.

### 2. Generate an API Key

The server includes a built-in API key generation endpoint.

**Option A: Using curl**

```bash
# Generate a new API key
curl -X POST http://localhost:8765/api/generate-key \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Client",
    "description": "Testing the npm package"
  }'
```

**Response:**
```json
{
  "apiKey": "xtts_1234567890abcdef",
  "name": "Test Client",
  "description": "Testing the npm package",
  "createdAt": "2025-10-24T12:00:00.000Z",
  "expiresAt": null,
  "rateLimit": {
    "requestsPerMinute": 60,
    "requestsPerDay": 10000
  }
}
```

**Option B: Using Node.js script**

Create `generate-key.js`:

```javascript
const http = require('http');

const data = JSON.stringify({
  name: 'Test Client',
  description: 'Testing the npm package'
});

const options = {
  hostname: 'localhost',
  port: 8765,
  path: '/api/generate-key',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('\n✓ API Key Generated Successfully!\n');
    console.log('API Key:', response.apiKey);
    console.log('Name:', response.name);
    console.log('Rate Limit:', response.rateLimit);
    console.log('\nSave this API key - you\'ll need it to test the SDK!\n');
  });
});

req.on('error', (error) => {
  console.error('Error generating API key:', error);
});

req.write(data);
req.end();
```

Run it:
```bash
node generate-key.js
```

### 3. List Existing API Keys

```bash
# List all API keys
curl http://localhost:8765/api/keys
```

### 4. Revoke an API Key

```bash
# Revoke a specific key
curl -X DELETE http://localhost:8765/api/keys/xtts_1234567890abcdef
```

---

## Testing the npm Package

### Method 1: Quick Test in a New Project

Create a fresh test project to verify the npm package works correctly:

```bash
# Create test directory
mkdir ~/test-xtts-sdk
cd ~/test-xtts-sdk

# Initialize npm project
npm init -y

# Install the published package
npm install xtts-sdk

# Install TypeScript (optional, for TS examples)
npm install -D typescript @types/node ts-node
```

### Method 2: Test Locally Before Publishing

If you want to test the package locally before/after publishing:

```bash
# In the SDK directory
cd /home/ubuntu/xtts-minimax-proxy/packages/sdk
npm pack

# This creates: xtts-sdk-1.0.0.tgz

# In your test directory
mkdir ~/test-xtts-sdk-local
cd ~/test-xtts-sdk-local
npm init -y
npm install /home/ubuntu/xtts-minimax-proxy/packages/sdk/xtts-sdk-1.0.0.tgz
```

---

## Quick Test Scripts

### Test 1: Basic Synthesis (JavaScript)

Create `test-basic.js`:

```javascript
const { XTTSClient } = require('xtts-sdk');

async function testBasicSynthesis() {
  console.log('Testing XTTS SDK - Basic Synthesis\n');

  // Replace with your generated API key
  const API_KEY = 'xtts_1234567890abcdef';

  const client = new XTTSClient({
    apiKey: API_KEY,
    serverUrl: 'ws://localhost:8765', // or wss://xttsws.xcai.io for production
    voice: 'en-US-1',
    autoReconnect: true,
  });

  // Set up event listeners
  client.on('connected', () => {
    console.log('✓ Connected to server');
  });

  client.on('disconnected', (code, reason) => {
    console.log(`✗ Disconnected: ${code} - ${reason}`);
  });

  client.on('error', (error) => {
    console.error('✗ Error:', error);
  });

  try {
    // Connect to server
    console.log('Connecting to server...');
    await client.connect();

    // Synthesize speech
    console.log('\nSynthesizing: "Hello, this is a test of the XTTS SDK!"\n');
    const result = await client.synthesize({
      text: 'Hello, this is a test of the XTTS SDK!',
      timeout: 30000,
    });

    console.log('✓ Synthesis complete!');
    console.log(`  Audio size: ${result.audioData.length} bytes`);
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Request ID: ${result.requestId}`);

    // Optionally save to file
    const fs = require('fs');
    fs.writeFileSync('output.mp3', result.audioData);
    console.log('\n✓ Audio saved to output.mp3');

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    client.disconnect();
    console.log('\n✓ Test complete');
  }
}

testBasicSynthesis();
```

Run it:
```bash
# Replace API_KEY in the file first!
node test-basic.js
```

### Test 2: Streaming Synthesis (JavaScript)

Create `test-streaming.js`:

```javascript
const { XTTSClient } = require('xtts-sdk');
const fs = require('fs');

async function testStreaming() {
  console.log('Testing XTTS SDK - Streaming Synthesis\n');

  const API_KEY = 'xtts_1234567890abcdef'; // Replace with your key

  const client = new XTTSClient({
    apiKey: API_KEY,
    serverUrl: 'ws://localhost:8765',
    voice: 'en-US-1',
  });

  client.on('connected', () => {
    console.log('✓ Connected to server\n');
  });

  try {
    await client.connect();

    const chunks = [];
    let chunkCount = 0;

    console.log('Streaming: "This is a streaming test. Audio arrives in chunks."\n');

    const requestId = client.synthesizeStream({
      text: 'This is a streaming test. Audio arrives in chunks.',
      onChunk: (chunk) => {
        chunkCount++;
        chunks.push(chunk);
        console.log(`  Received chunk ${chunkCount}: ${chunk.length} bytes`);
      },
      onComplete: () => {
        console.log(`\n✓ Stream complete! Received ${chunkCount} chunks`);

        // Combine chunks
        const totalAudio = Buffer.concat(chunks);
        console.log(`  Total audio size: ${totalAudio.length} bytes`);

        // Save to file
        fs.writeFileSync('output-stream.mp3', totalAudio);
        console.log('✓ Audio saved to output-stream.mp3');

        client.disconnect();
      },
      onError: (error) => {
        console.error('✗ Stream error:', error.message);
        client.disconnect();
      },
      timeout: 30000,
    });

    console.log(`Request ID: ${requestId}\n`);

  } catch (error) {
    console.error('Test failed:', error.message);
    client.disconnect();
  }
}

testStreaming();
```

Run it:
```bash
node test-streaming.js
```

### Test 3: File Synthesis (JavaScript)

Create `test-file.js`:

```javascript
const { XTTSClient } = require('xtts-sdk');

async function testFileSynthesis() {
  console.log('Testing XTTS SDK - File Synthesis\n');

  const API_KEY = 'xtts_1234567890abcdef'; // Replace with your key

  const client = new XTTSClient({
    apiKey: API_KEY,
    serverUrl: 'ws://localhost:8765',
    voice: 'en-US-1',
  });

  client.on('connected', () => {
    console.log('✓ Connected to server\n');
  });

  try {
    await client.connect();

    console.log('Synthesizing directly to file: output-direct.mp3\n');

    const result = await client.synthesizeToFile({
      text: 'This audio is being written directly to a file without buffering in memory.',
      filePath: './output-direct.mp3',
      onProgress: (bytesWritten, chunksReceived) => {
        console.log(`  Progress: ${bytesWritten} bytes, ${chunksReceived} chunks`);
      },
      timeout: 30000,
    });

    console.log('\n✓ File synthesis complete!');
    console.log(`  File: ${result.filePath}`);
    console.log(`  Size: ${result.bytesWritten} bytes`);
    console.log(`  Chunks: ${result.chunksReceived}`);
    console.log(`  Duration: ${result.duration}ms`);

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    client.disconnect();
    console.log('\n✓ Test complete');
  }
}

testFileSynthesis();
```

Run it:
```bash
node test-file.js
```

### Test 4: TypeScript Example

Create `test-typescript.ts`:

```typescript
import { XTTSClient, XTTSConfig, SynthesisResult } from 'xtts-sdk';

async function testTypeScript(): Promise<void> {
  console.log('Testing XTTS SDK - TypeScript\n');

  const config: XTTSConfig = {
    apiKey: 'xtts_1234567890abcdef', // Replace with your key
    serverUrl: 'ws://localhost:8765',
    voice: 'en-US-1',
    autoReconnect: true,
    reconnectDelay: 1000,
    maxReconnectAttempts: 5,
  };

  const client = new XTTSClient(config);

  client.on('connected', () => {
    console.log('✓ Connected to server');
  });

  client.on('error', (error) => {
    console.error('✗ Error:', error);
  });

  try {
    await client.connect();

    const result: SynthesisResult = await client.synthesize({
      text: 'TypeScript types make development safer and easier!',
      timeout: 30000,
    });

    console.log('\n✓ Synthesis complete!');
    console.log(`  Audio size: ${result.audioData.length} bytes`);
    console.log(`  Request ID: ${result.requestId}`);

  } catch (error) {
    console.error('Test failed:', (error as Error).message);
  } finally {
    client.disconnect();
  }
}

testTypeScript();
```

Run it:
```bash
npx ts-node test-typescript.ts
```

### Test 5: Complete Feature Test

Create `test-all-features.js`:

```javascript
const { XTTSClient } = require('xtts-sdk');
const fs = require('fs');

async function testAllFeatures() {
  console.log('='.repeat(60));
  console.log('XTTS SDK - Complete Feature Test');
  console.log('='.repeat(60));

  const API_KEY = 'xtts_1234567890abcdef'; // Replace with your key

  const client = new XTTSClient({
    apiKey: API_KEY,
    serverUrl: 'ws://localhost:8765',
    voice: 'en-US-1',
    autoReconnect: true,
  });

  // Event monitoring
  const events = {
    connected: 0,
    disconnected: 0,
    error: 0,
    audioData: 0,
  };

  client.on('connected', () => {
    events.connected++;
    console.log('\n[EVENT] Connected');
  });

  client.on('disconnected', (code, reason) => {
    events.disconnected++;
    console.log(`\n[EVENT] Disconnected: ${code} - ${reason}`);
  });

  client.on('error', (error) => {
    events.error++;
    console.log(`\n[EVENT] Error: ${error.message}`);
  });

  client.on('audioData', (data) => {
    events.audioData++;
  });

  try {
    // Test 1: Connection
    console.log('\n[TEST 1] Connection');
    console.log('-'.repeat(60));
    await client.connect();
    console.log('✓ Connected successfully');

    const state = client.getConnectionState();
    console.log(`  State: ${state.state}`);
    console.log(`  Connected: ${state.isConnected}`);
    console.log(`  Server: ${state.serverUrl}`);

    // Test 2: Basic synthesis
    console.log('\n[TEST 2] Basic Synthesis');
    console.log('-'.repeat(60));
    const result1 = await client.synthesize({
      text: 'Test one: Basic synthesis.',
    });
    console.log(`✓ Audio size: ${result1.audioData.length} bytes`);
    console.log(`  Duration: ${result1.duration}ms`);

    // Test 3: Streaming synthesis
    console.log('\n[TEST 3] Streaming Synthesis');
    console.log('-'.repeat(60));
    const chunks = [];

    await new Promise((resolve, reject) => {
      client.synthesizeStream({
        text: 'Test two: Streaming synthesis.',
        onChunk: (chunk) => {
          chunks.push(chunk);
          console.log(`  Chunk ${chunks.length}: ${chunk.length} bytes`);
        },
        onComplete: () => {
          console.log(`✓ Stream complete: ${chunks.length} chunks`);
          resolve();
        },
        onError: reject,
      });
    });

    // Test 4: File synthesis
    console.log('\n[TEST 4] File Synthesis');
    console.log('-'.repeat(60));
    const result3 = await client.synthesizeToFile({
      text: 'Test three: File synthesis.',
      filePath: './test-output.mp3',
      onProgress: (bytes, chunks) => {
        console.log(`  Progress: ${bytes} bytes, ${chunks} chunks`);
      },
    });
    console.log(`✓ File saved: ${result3.filePath}`);
    console.log(`  Size: ${result3.bytesWritten} bytes`);

    // Test 5: Concurrent requests
    console.log('\n[TEST 5] Concurrent Requests');
    console.log('-'.repeat(60));
    const promises = [
      client.synthesize({ text: 'Request one.' }),
      client.synthesize({ text: 'Request two.' }),
      client.synthesize({ text: 'Request three.' }),
    ];

    const results = await Promise.all(promises);
    console.log(`✓ All ${results.length} requests completed`);
    results.forEach((r, i) => {
      console.log(`  Request ${i + 1}: ${r.audioData.length} bytes`);
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✓ All tests passed!');
    console.log('\nEvents received:');
    console.log(`  Connected: ${events.connected}`);
    console.log(`  Disconnected: ${events.disconnected}`);
    console.log(`  Errors: ${events.error}`);
    console.log(`  Audio data: ${events.audioData}`);

    // Cleanup
    fs.unlinkSync('./test-output.mp3');
    console.log('\n✓ Cleanup complete');

  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    client.disconnect();
    console.log('='.repeat(60));
  }
}

testAllFeatures();
```

Run it:
```bash
node test-all-features.js
```

---

## Troubleshooting

### Issue: "Connection refused" or "ECONNREFUSED"

**Solution:**
1. Verify the server is running:
   ```bash
   pm2 list
   # or
   netstat -an | grep 8765
   ```

2. Check if the server is listening:
   ```bash
   curl http://localhost:8765/health
   ```

3. Make sure the server URL in your client matches:
   ```javascript
   serverUrl: 'ws://localhost:8765'  // For local testing
   // or
   serverUrl: 'wss://xttsws.xcai.io' // For production
   ```

### Issue: "Authentication failed" or 401 error

**Solution:**
1. Verify your API key is correct
2. Check that the key hasn't been revoked:
   ```bash
   curl http://localhost:8765/api/keys
   ```
3. Generate a new key if needed

### Issue: "Module not found: xtts-sdk"

**Solution:**
1. Ensure the package is installed:
   ```bash
   npm list xtts-sdk
   ```

2. Reinstall if needed:
   ```bash
   npm install xtts-sdk
   ```

3. Check that you're in the correct directory

### Issue: Timeout errors

**Solution:**
1. Increase the timeout value:
   ```javascript
   await client.synthesize({
     text: 'Your text',
     timeout: 60000, // Increase to 60 seconds
   });
   ```

2. Check server logs for issues:
   ```bash
   pm2 logs xtts-server
   ```

### Issue: Audio playback issues

**Solution:**
1. Verify the audio format matches your player requirements
2. Check the file size is not zero:
   ```bash
   ls -lh output.mp3
   ```

3. Test with a different audio player:
   ```bash
   ffplay output.mp3
   # or
   mpg123 output.mp3
   ```

### Issue: TypeScript type errors

**Solution:**
1. Ensure @types/node is installed:
   ```bash
   npm install -D @types/node
   ```

2. Check your tsconfig.json includes:
   ```json
   {
     "compilerOptions": {
       "esModuleInterop": true,
       "moduleResolution": "node"
     }
   }
   ```

---

## Testing Checklist

Use this checklist to verify the SDK is working correctly:

- [ ] Server is running and accessible
- [ ] API key generated successfully
- [ ] Can connect to server
- [ ] Basic synthesis works
- [ ] Streaming synthesis works
- [ ] File synthesis works
- [ ] Concurrent requests work
- [ ] Events are firing correctly
- [ ] Error handling works
- [ ] Auto-reconnection works
- [ ] TypeScript types are available
- [ ] Audio files play correctly

---

## Next Steps

Once testing is complete:

1. **Deploy to Production**: Use the public endpoint `wss://xttsws.xcai.io`
2. **Monitor Usage**: Check API key usage and rate limits
3. **Scale**: Add more server instances if needed
4. **Documentation**: Share the README with your team
5. **Support**: Report issues at https://github.com/amrhym/xttsserverandsdk/issues

---

## Quick Reference

**Install Package:**
```bash
npm install xtts-sdk
```

**Generate API Key:**
```bash
curl -X POST http://localhost:8765/api/generate-key \
  -H "Content-Type: application/json" \
  -d '{"name": "My App"}'
```

**Basic Usage:**
```javascript
const { XTTSClient } = require('xtts-sdk');
const client = new XTTSClient({
  apiKey: 'YOUR_API_KEY',
  serverUrl: 'ws://localhost:8765',
});
await client.connect();
const result = await client.synthesize({ text: 'Hello!' });
```

**Check Server Status:**
```bash
pm2 status xtts-server
pm2 logs xtts-server
```

---

*For more information, see the complete [API Documentation](https://github.com/amrhym/xttsserverandsdk).*
