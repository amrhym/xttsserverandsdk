# XTTS SDK

TypeScript/JavaScript client library for connecting to XTTS WebSocket text-to-speech proxy server with complete provider obfuscation.

[![npm version](https://img.shields.io/npm/v/xtts-sdk.svg)](https://www.npmjs.com/package/xtts-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

## Features

- 🔐 **Complete Provider Obfuscation** - Client never knows which TTS provider is being used
- 🚀 **WebSocket-based Real-time Streaming** - Low-latency audio delivery
- 📦 **Multiple Output Modes** - Buffer collection, callback streaming, or direct file writing
- 🔄 **Auto-reconnection** - Configurable automatic reconnection with exponential backoff
- 📊 **Connection State Management** - Track connection lifecycle with detailed state info
- ⚠️ **Comprehensive Error Handling** - Categorized errors with full context
- 💪 **Fully Typed** - Complete TypeScript definitions
- ✅ **Battle-tested** - 146+ unit tests with 100% coverage

## Installation

```bash
npm install xtts-sdk
```

```bash
yarn add xtts-sdk
```

```bash
pnpm add xtts-sdk
```

## Quick Start

```typescript
import { XTTSClient } from 'xtts-sdk';

// Create client (connects to wss://xttsws.xcai.io by default)
const client = new XTTSClient({
  apiKey: 'your-api-key-from-server',
  voice: 'emma'
});

// Connect to server
await client.connect();

// Synthesize speech (collects all audio into buffer)
const audioBuffer = await client.synthesize({
  text: 'Hello, world!'
});

// Save to file
const fs = require('fs').promises;
await fs.writeFile('output.mp3', audioBuffer);

// Disconnect
client.disconnect();
```

## Usage

### Configuration

```typescript
import { XTTSClient } from 'xtts-sdk';

const client = new XTTSClient({
  // Required: API key from XTTS server
  apiKey: 'your-api-key',

  // Required: Voice identifier
  voice: 'emma',

  // Optional: Custom server URL (defaults to wss://xttsws.xcai.io)
  serverUrl: 'wss://custom-server.com',

  // Optional: Connection timeout in ms (default: 10000)
  connectionTimeout: 15000,

  // Optional: Auto-reconnect on connection loss (default: false)
  autoReconnect: true
});
```

### Connection Management

```typescript
// Connect to server
await client.connect();

// Check connection status
if (client.isConnected()) {
  console.log('Connected!');
}

// Get detailed connection state
const state = client.getConnectionState();
console.log(state);
// {
//   state: 'connected',
//   isConnected: true,
//   reconnectAttempts: 0,
//   maxReconnectAttempts: 5,
//   autoReconnect: true,
//   serverUrl: 'wss://xttsws.xcai.io'
// }

// Manual reconnection
await client.reconnect();

// Disconnect
client.disconnect();
```

### Synthesis Methods

#### 1. Buffer Collection (Simple)

Collects all audio chunks into a single buffer. Best for small to medium texts.

```typescript
const audioBuffer = await client.synthesize({
  text: 'Hello, this is a test.',
  requestId: 'optional-request-id', // Optional
  timeout: 30000 // Optional timeout in ms (default: 30000)
});

// audioBuffer is a Node.js Buffer containing the complete audio
await fs.writeFile('output.mp3', audioBuffer);
```

#### 2. Streaming with Callbacks (Memory Efficient)

Receive audio chunks as they arrive. Best for long texts or real-time playback.

```typescript
const requestId = client.synthesizeStream({
  text: 'This is a longer piece of text that will be streamed in chunks.',

  // Called for each audio chunk
  onChunk: (chunk: Buffer) => {
    console.log(`Received chunk: ${chunk.length} bytes`);
    // Process or play chunk immediately
  },

  // Called when synthesis completes
  onComplete: (finalChunk: Buffer) => {
    console.log('Synthesis complete!');
  },

  // Called on error
  onError: (error: Error) => {
    console.error('Synthesis failed:', error);
  },

  timeout: 30000 // Optional
});

// Cancel streaming if needed
client.cancelStream(requestId);
```

#### 3. Direct File Writing (Most Efficient)

Write audio directly to disk without buffering. Best for very long texts.

```typescript
const result = await client.synthesizeToFile({
  text: 'This text will be written directly to a file.',
  filePath: '/path/to/output.mp3',

  // Optional progress tracking
  onProgress: (bytesWritten, chunksReceived) => {
    console.log(`Progress: ${bytesWritten} bytes, ${chunksReceived} chunks`);
  },

  timeout: 30000 // Optional
});

console.log(result);
// {
//   filePath: '/path/to/output.mp3',
//   bytesWritten: 245760,
//   chunksReceived: 12,
//   requestId: 'req-...'
// }
```

### Event Handling

```typescript
import { ErrorCategory } from 'xtts-sdk';

// Connection events
client.on('connected', () => {
  console.log('Connected to XTTS server');
});

client.on('disconnected', (code: number, reason: string) => {
  console.log(`Disconnected: ${code} - ${reason}`);
});

client.on('reconnecting', (attempt: number, maxAttempts: number, delay: number) => {
  console.log(`Reconnecting (${attempt}/${maxAttempts}) in ${delay}ms...`);
});

// Audio events (for event-based streaming)
client.on('audioChunk', ({ audio, requestId }) => {
  console.log(`Audio chunk: ${audio.length} bytes`);
});

client.on('complete', ({ audio, requestId }) => {
  console.log('Synthesis complete');
});

// Error events
client.on('error', (errorData) => {
  console.error(`Error [${errorData.category}]:`, errorData.message);

  // Handle different error categories
  switch (errorData.category) {
    case ErrorCategory.AUTH:
      console.error('Authentication failed - check API key');
      break;
    case ErrorCategory.VALIDATION:
      console.error('Invalid request parameters');
      break;
    case ErrorCategory.CONNECTION:
      console.error('Connection issue - may auto-reconnect');
      break;
    case ErrorCategory.TIMEOUT:
      console.error('Request timed out');
      break;
    case ErrorCategory.SERVER:
      console.error('Server error');
      break;
    case ErrorCategory.CLIENT:
      console.error('Client-side error');
      break;
  }
});
```

### Connection States

The SDK tracks connection state through the `ConnectionState` enum:

- `DISCONNECTED` - Not connected to server
- `CONNECTING` - Currently connecting
- `CONNECTED` - Connected and ready
- `RECONNECTING` - Attempting to reconnect after connection loss

### Error Categories

Errors are automatically categorized for easier handling:

- `AUTH` - Authentication/authorization errors (401, 403)
- `VALIDATION` - Invalid request parameters (400, 422)
- `TIMEOUT` - Request timeout (408)
- `CONNECTION` - Network/connection issues (503, 504)
- `SERVER` - Server-side errors (500+)
- `CLIENT` - Client-side errors (parsing, callbacks, etc.)

## Advanced Examples

### Auto-reconnection with Error Handling

```typescript
const client = new XTTSClient({
  apiKey: 'your-api-key',
  voice: 'emma',
  autoReconnect: true
});

client.on('reconnecting', (attempt, maxAttempts, delay) => {
  console.log(`Reconnection attempt ${attempt}/${maxAttempts} in ${delay}ms`);
});

client.on('connected', () => {
  console.log('Connected - ready to synthesize');
});

client.on('error', (error) => {
  if (error.category === ErrorCategory.CONNECTION) {
    console.log('Connection error - auto-reconnect will handle this');
  } else if (error.category === ErrorCategory.AUTH) {
    console.error('Auth error - check API key');
    client.disconnect();
  }
});

await client.connect();
```

### Concurrent Synthesis Requests

```typescript
await client.connect();

// Multiple concurrent syntheses
const requests = [
  client.synthesize({ text: 'First sentence' }),
  client.synthesize({ text: 'Second sentence' }),
  client.synthesize({ text: 'Third sentence' })
];

const results = await Promise.all(requests);
console.log(`Generated ${results.length} audio files`);
```

### Streaming to Audio Player

```typescript
import { Readable } from 'stream';

const chunks: Buffer[] = [];

client.synthesizeStream({
  text: 'Stream this text to an audio player',

  onChunk: (chunk) => {
    chunks.push(chunk);
    // Feed chunk to audio player
    audioPlayer.write(chunk);
  },

  onComplete: (finalChunk) => {
    chunks.push(finalChunk);
    audioPlayer.end();

    // Optionally save complete audio
    const completeAudio = Buffer.concat(chunks);
    fs.writeFileSync('complete.mp3', completeAudio);
  },

  onError: (error) => {
    console.error('Stream failed:', error);
    audioPlayer.destroy(error);
  }
});
```

### Progress Tracking for Long Texts

```typescript
const longText = `...very long text...`;

const startTime = Date.now();

const result = await client.synthesizeToFile({
  text: longText,
  filePath: 'long-audio.mp3',

  onProgress: (bytesWritten, chunksReceived) => {
    const elapsed = Date.now() - startTime;
    const rate = bytesWritten / (elapsed / 1000); // bytes per second
    console.log(`Progress: ${(bytesWritten / 1024).toFixed(2)} KB @ ${(rate / 1024).toFixed(2)} KB/s`);
  }
});

console.log(`Total: ${(result.bytesWritten / 1024).toFixed(2)} KB in ${result.chunksReceived} chunks`);
```

## API Reference

### XTTSClient

#### Constructor

```typescript
new XTTSClient(config: XTTSClientConfig)
```

#### Methods

- `connect(): Promise<void>` - Connect to XTTS server
- `disconnect(code?: number, reason?: string): void` - Disconnect from server
- `isConnected(): boolean` - Check if connected
- `getConnectionState(): ConnectionInfo` - Get detailed connection state
- `reconnect(): Promise<void>` - Manually trigger reconnection
- `synthesize(options: SynthesisOptions): Promise<Buffer>` - Synthesize speech to buffer
- `synthesizeStream(options: StreamSynthesisOptions): string` - Stream synthesis with callbacks
- `cancelStream(requestId: string): void` - Cancel active stream
- `synthesizeToFile(options: FileSynthesisOptions): Promise<FileSynthesisResult>` - Synthesize directly to file
- `on<K>(event: K, listener: XTTSClientEvents[K]): this` - Add event listener
- `once<K>(event: K, listener: XTTSClientEvents[K]): this` - Add one-time event listener
- `off<K>(event: K, listener: XTTSClientEvents[K]): this` - Remove event listener

#### Static Methods

- `XTTSClient.getVersion(): string` - Get SDK version

### Types

All TypeScript types are fully exported:

```typescript
import {
  XTTSClient,
  XTTSClientConfig,
  XTTSClientEvents,
  SynthesisOptions,
  StreamSynthesisOptions,
  FileSynthesisOptions,
  FileSynthesisResult,
  ConnectionState,
  ConnectionInfo,
  ErrorCategory,
  ErrorData,
  AudioChunk,
  CompletionData
} from 'xtts-sdk';
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0 (for TypeScript projects)

## License

MIT

## Support

- 📖 [Documentation](https://github.com/yourusername/xtts-minimax-proxy#readme)
- 🐛 [Issue Tracker](https://github.com/yourusername/xtts-minimax-proxy/issues)
- 💬 [Discussions](https://github.com/yourusername/xtts-minimax-proxy/discussions)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
