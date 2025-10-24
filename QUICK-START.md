# XTTS SDK Quick Start Guide

Complete guide to get started with testing the XTTS SDK in 5 minutes.

## Prerequisites

- Node.js 16+ installed
- The XTTS server project cloned and ready

## Step 1: Start the Server

```bash
cd /home/ubuntu/xtts-minimax-proxy/packages/server
npm install
npm run start
```

The server will start on `ws://localhost:8765` and provide both WebSocket and HTTP API endpoints.

## Step 2: Generate an API Key

In a new terminal:

```bash
cd /home/ubuntu/xtts-minimax-proxy/packages/server
node scripts/generate-api-key.js "Test Client"
```

You'll see output like:

```
======================================================================
✓ API Key Generated Successfully!
======================================================================

Name: Test Client

API Key: xtts_AbC123XyZ...

Created: 10/24/2025, 12:00:00 PM
Expires: Never

Rate Limits:
  - 60 requests per minute
  - 10000 requests per day

======================================================================

IMPORTANT: Save this API key securely!
```

**Copy the API key** - you'll need it for testing!

## Step 3: Quick Test (Local npm Package)

Test the published npm package:

```bash
cd /home/ubuntu
node quick-test-xtts.js YOUR_API_KEY_HERE
```

Replace `YOUR_API_KEY_HERE` with the key from Step 2.

Expected output:

```
======================================================================
XTTS SDK Quick Test
======================================================================

Configuration:
  API Key: xtts_AbC12...Z789
  Server: ws://localhost:8765

[TEST 1] Connecting...
✓ Connected to server

[TEST 2] Basic synthesis...
✓ Synthesis complete
  Audio size: 45632 bytes
  Duration: 1234ms
  Request ID: req_abc123
✓ Audio saved to ./test-output.mp3

[TEST 3] Streaming synthesis...
  Chunk 1: 8192 bytes
  Chunk 2: 8192 bytes
  Chunk 3: 8192 bytes
  Chunk 4: 5432 bytes
✓ Stream complete: 4 chunks, 30008 bytes

[TEST 4] Connection state...
✓ State: connected
  Connected: true
  Auto-reconnect: true

======================================================================
✅ All tests passed!
======================================================================
```

## Step 4: Test from a Fresh Project

Create a new test project:

```bash
mkdir ~/test-xtts-app
cd ~/test-xtts-app
npm init -y
npm install xtts-sdk
```

Create `test.js`:

```javascript
const { XTTSClient } = require('xtts-sdk');

async function test() {
  const client = new XTTSClient({
    apiKey: 'YOUR_API_KEY_HERE',
    serverUrl: 'ws://localhost:8765',
    voice: 'en-US-1',
  });

  client.on('connected', () => console.log('Connected!'));

  await client.connect();

  const result = await client.synthesize({
    text: 'Hello from XTTS SDK!',
  });

  console.log(`Audio size: ${result.audioData.length} bytes`);

  client.disconnect();
}

test();
```

Run it:

```bash
node test.js
```

## Common API Key Commands

### List all API keys

```bash
cd /home/ubuntu/xtts-minimax-proxy/packages/server
node scripts/generate-api-key.js --list
```

### Generate with description

```bash
node scripts/generate-api-key.js "Production App" "Main API key for production"
```

### Delete an API key

```bash
node scripts/generate-api-key.js --delete xtts_YOUR_KEY_HERE
```

### Check server health

```bash
curl http://localhost:8765/health
```

## API Key Management via HTTP

You can also manage keys via HTTP API:

### Generate key

```bash
curl -X POST http://localhost:8765/api/generate-key \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "description": "Test key"
  }'
```

### List keys

```bash
curl http://localhost:8765/api/keys
```

### Delete key

```bash
curl -X DELETE http://localhost:8765/api/keys/xtts_YOUR_KEY
```

## Troubleshooting

### Server won't start

1. Check if port 8765 is already in use:
   ```bash
   netstat -an | grep 8765
   ```

2. Kill any existing process:
   ```bash
   pkill -f "node.*server"
   ```

3. Try again:
   ```bash
   cd /home/ubuntu/xtts-minimax-proxy/packages/server
   npm run start
   ```

### "Connection refused"

- Make sure the server is running
- Check the server URL matches (ws://localhost:8765)
- Verify firewall rules if using remote server

### "Authentication failed"

- Verify your API key is correct
- Check if the key is active:
  ```bash
  node scripts/generate-api-key.js --list
  ```
- Generate a new key if needed

### Audio file is empty or corrupted

- Check server logs for errors
- Verify Minimax credentials are configured
- Test with shorter text first

## Next Steps

- Read the full documentation: [TESTING-GUIDE.md](TESTING-GUIDE.md)
- Explore examples: `packages/sdk/examples/`
- Check API reference: `packages/sdk/API.md`
- View server configuration: `packages/server/.env.example`

## Production Deployment

For production use:

1. Use the public endpoint: `wss://xttsws.xcai.io`
2. Enable SSL/TLS
3. Set up proper monitoring
4. Configure rate limits
5. See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for details

## Support

- GitHub Issues: https://github.com/amrhym/xttsserverandsdk/issues
- Documentation: https://github.com/amrhym/xttsserverandsdk

---

**That's it!** You're now ready to use the XTTS SDK. Happy coding! 🚀
