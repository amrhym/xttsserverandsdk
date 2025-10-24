# XTTS SDK Examples

This directory contains comprehensive examples demonstrating all features of the XTTS SDK.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the SDK:
   ```bash
   npm run build
   ```

3. Set your API key:
   ```bash
   export XTTS_API_KEY="your-api-key-from-server"
   ```

## Running Examples

Each example can be run with ts-node:

```bash
npx ts-node examples/01-basic-synthesis.ts
```

Or compile and run:

```bash
npx tsc examples/01-basic-synthesis.ts
node examples/01-basic-synthesis.js
```

## Examples Overview

### 01-basic-synthesis.ts
**Basic Synthesis**

The simplest example showing:
- Connecting to XTTS server
- Basic text-to-speech synthesis
- Saving audio to file
- Error handling and cleanup

Perfect for: Getting started, simple TTS needs

```bash
npx ts-node examples/01-basic-synthesis.ts
```

---

### 02-streaming-synthesis.ts
**Streaming Synthesis**

Demonstrates callback-based streaming:
- Real-time audio chunk delivery
- onChunk, onComplete, onError callbacks
- Memory-efficient processing
- Stream collection and saving

Perfect for: Real-time playback, long texts, memory constraints

```bash
npx ts-node examples/02-streaming-synthesis.ts
```

---

### 03-file-synthesis.ts
**File Synthesis**

Direct file writing without buffering:
- Most memory-efficient approach
- Progress tracking with onProgress callback
- Direct disk writes
- Detailed statistics

Perfect for: Very long texts, batch processing, low memory environments

```bash
npx ts-node examples/03-file-synthesis.ts
```

---

### 04-event-handling.ts
**Event Handling**

Comprehensive event system demonstration:
- All connection events (connected, disconnected, reconnecting)
- Audio events (audioChunk, complete)
- Error events with categorization
- Error category handling patterns

Perfect for: Advanced integrations, monitoring, debugging

```bash
npx ts-node examples/04-event-handling.ts
```

---

### 05-auto-reconnect.ts
**Auto-Reconnection**

Connection resilience features:
- Auto-reconnect configuration
- Connection state tracking
- Exponential backoff demonstration
- Manual reconnection
- Connection state inspection

Perfect for: Production deployments, unreliable networks

```bash
npx ts-node examples/05-auto-reconnect.ts
```

---

### 06-concurrent-requests.ts
**Concurrent Requests**

Parallel synthesis operations:
- Multiple concurrent synthesis requests
- Request ID tracking and correlation
- Promise.all() pattern
- Performance metrics
- Bulk file generation

Perfect for: Batch processing, high-throughput applications

```bash
npx ts-node examples/06-concurrent-requests.ts
```

## Common Patterns

### Pattern 1: Simple One-off Synthesis

```typescript
const client = new XTTSClient({ apiKey, voice });
await client.connect();
const audio = await client.synthesize({ text: 'Hello' });
await writeFile('output.mp3', audio);
client.disconnect();
```

### Pattern 2: Streaming to Audio Player

```typescript
client.synthesizeStream({
  text: 'Long text...',
  onChunk: (chunk) => audioPlayer.write(chunk),
  onComplete: () => audioPlayer.end(),
  onError: (err) => audioPlayer.destroy(err)
});
```

### Pattern 3: Batch Processing

```typescript
const texts = ['Text 1', 'Text 2', 'Text 3'];
const results = await Promise.all(
  texts.map((text, i) =>
    client.synthesizeToFile({
      text,
      filePath: `output-${i}.mp3`
    })
  )
);
```

### Pattern 4: With Auto-Reconnect

```typescript
const client = new XTTSClient({
  apiKey,
  voice,
  autoReconnect: true
});

client.on('reconnecting', (attempt, max, delay) => {
  console.log(`Reconnecting ${attempt}/${max}...`);
});

await client.connect();
// Connection is now resilient to temporary disconnects
```

## Environment Variables

- `XTTS_API_KEY` - Your API key from the XTTS server (required)
- `XTTS_SERVER_URL` - Custom server URL (optional, defaults to wss://xttsws.xcai.io)
- `XTTS_VOICE` - Voice to use (optional, defaults to 'emma')

Example:
```bash
export XTTS_API_KEY="your-api-key"
export XTTS_SERVER_URL="wss://custom-server.com"
export XTTS_VOICE="sam"
```

## Output Files

Examples will create audio files in the current directory:
- `output-basic.mp3` - From basic synthesis example
- `output-streaming.mp3` - From streaming example
- `output-file.mp3` - From file synthesis example
- `output-request-1.mp3` etc. - From concurrent requests example

## Error Handling

All examples include proper error handling. Common errors:

- **Authentication errors (401/403)**: Check your API key
- **Connection errors (503/504)**: Server may be down or unreachable
- **Validation errors (400/422)**: Check your parameters
- **Timeout errors (408)**: Increase timeout or check network

## Tips

1. **For Development**: Use auto-reconnect and event listeners
2. **For Production**: Add proper error recovery and logging
3. **For Long Texts**: Use `synthesizeToFile()` to avoid memory issues
4. **For Real-time**: Use `synthesizeStream()` with audio player
5. **For Batch Jobs**: Use concurrent requests with `Promise.all()`

## Troubleshooting

**Connection timeout**:
```typescript
const client = new XTTSClient({
  apiKey,
  voice,
  connectionTimeout: 30000 // Increase to 30 seconds
});
```

**Synthesis timeout**:
```typescript
await client.synthesize({
  text,
  timeout: 60000 // Increase to 60 seconds
});
```

**Memory issues with long texts**:
```typescript
// Use file synthesis instead of buffer synthesis
await client.synthesizeToFile({
  text: veryLongText,
  filePath: 'output.mp3'
});
```

## Next Steps

After trying these examples:

1. Read the [API Documentation](../API.md)
2. Check the [README](../README.md) for advanced usage
3. Review the [TypeScript definitions](../src/types.ts)
4. Explore the [test suite](../test) for more patterns

## Support

- 📖 [Full Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/yourusername/xtts-minimax-proxy/issues)
- 💬 [Discussions](https://github.com/yourusername/xtts-minimax-proxy/discussions)
