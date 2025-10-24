# XTTS SDK API Documentation

Complete API reference for the XTTS SDK.

## Table of Contents

- [XTTSClient](#xttsclient)
  - [Constructor](#constructor)
  - [Connection Methods](#connection-methods)
  - [Synthesis Methods](#synthesis-methods)
  - [Event Methods](#event-methods)
  - [Static Methods](#static-methods)
- [TypeScript Types](#typescript-types)
  - [Interfaces](#interfaces)
  - [Enums](#enums)
  - [Type Aliases](#type-aliases)

---

## XTTSClient

Main client class for interacting with XTTS WebSocket server.

### Constructor

#### `new XTTSClient(config: XTTSClientConfig)`

Creates a new XTTS client instance.

**Parameters:**

- `config` (XTTSClientConfig) - Client configuration object

**Throws:**

- `Error` if required configuration is missing or invalid

**Example:**

```typescript
const client = new XTTSClient({
  apiKey: 'your-api-key',
  voice: 'emma',
  serverUrl: 'wss://xttsws.xcai.io', // optional
  connectionTimeout: 10000, // optional
  autoReconnect: false // optional
});
```

---

### Connection Methods

#### `connect(): Promise<void>`

Connects to the XTTS WebSocket server.

**Returns:** Promise that resolves when connected and ready

**Throws:**
- `Error` if connection fails or times out

**Example:**

```typescript
await client.connect();
console.log('Connected!');
```

---

#### `disconnect(code?: number, reason?: string): void`

Disconnects from the XTTS WebSocket server.

**Parameters:**

- `code` (number, optional) - WebSocket close code (default: 1000 - Normal Closure)
- `reason` (string, optional) - Human-readable close reason (default: 'Client disconnect')

**Example:**

```typescript
client.disconnect();
// or with custom code/reason
client.disconnect(1001, 'Going away');
```

---

#### `isConnected(): boolean`

Checks if the client is currently connected to the server.

**Returns:** boolean - `true` if connected and ready, `false` otherwise

**Example:**

```typescript
if (client.isConnected()) {
  console.log('Ready to synthesize');
}
```

---

#### `getConnectionState(): ConnectionInfo`

Gets detailed information about the current connection state.

**Returns:** ConnectionInfo object with full state details

**Example:**

```typescript
const state = client.getConnectionState();
console.log(`State: ${state.state}`);
console.log(`Reconnect attempts: ${state.reconnectAttempts}`);
console.log(`Server: ${state.serverUrl}`);
```

---

#### `reconnect(): Promise<void>`

Manually triggers reconnection to the server.

**Returns:** Promise that resolves when reconnected

**Throws:**
- `Error` if already connected
- `Error` if reconnection already in progress

**Example:**

```typescript
try {
  await client.reconnect();
  console.log('Reconnected successfully');
} catch (error) {
  console.error('Reconnection failed:', error);
}
```

---

### Synthesis Methods

#### `synthesize(options: SynthesisOptions): Promise<Buffer>`

Synthesizes text to speech and returns complete audio as a buffer.

**Parameters:**

- `options` (SynthesisOptions) - Synthesis configuration

**Returns:** Promise<Buffer> - Complete audio data

**Throws:**
- `Error` if not connected
- `Error` if text is empty
- `Error` if synthesis fails or times out

**Example:**

```typescript
const audioBuffer = await client.synthesize({
  text: 'Hello, world!',
  requestId: 'optional-id', // optional
  timeout: 30000 // optional, default: 30000ms
});

await fs.writeFile('output.mp3', audioBuffer);
```

---

#### `synthesizeStream(options: StreamSynthesisOptions): string`

Streams synthesis with callbacks for each audio chunk.

**Parameters:**

- `options` (StreamSynthesisOptions) - Stream synthesis configuration with callbacks

**Returns:** string - Request ID for tracking

**Throws:**
- `Error` if not connected
- `Error` if text is empty
- `Error` if callbacks are missing

**Example:**

```typescript
const requestId = client.synthesizeStream({
  text: 'Stream this text',

  onChunk: (chunk: Buffer) => {
    console.log(`Received ${chunk.length} bytes`);
    audioPlayer.write(chunk);
  },

  onComplete: (finalChunk: Buffer) => {
    console.log('Stream complete');
    audioPlayer.end();
  },

  onError: (error: Error) => {
    console.error('Stream failed:', error);
  },

  requestId: 'optional-id', // optional
  timeout: 30000 // optional
});
```

---

#### `cancelStream(requestId: string): void`

Cancels an active streaming synthesis request.

**Parameters:**

- `requestId` (string) - ID of the stream to cancel

**Example:**

```typescript
const requestId = client.synthesizeStream({...});

// Cancel after 5 seconds
setTimeout(() => {
  client.cancelStream(requestId);
}, 5000);
```

---

#### `synthesizeToFile(options: FileSynthesisOptions): Promise<FileSynthesisResult>`

Synthesizes text directly to a file without buffering in memory.

**Parameters:**

- `options` (FileSynthesisOptions) - File synthesis configuration

**Returns:** Promise<FileSynthesisResult> - Synthesis result with file stats

**Throws:**
- `Error` if not connected
- `Error` if text or filePath is empty
- `Error` if file cannot be opened
- `Error` if synthesis fails or times out

**Example:**

```typescript
const result = await client.synthesizeToFile({
  text: 'Save this to file',
  filePath: '/path/to/output.mp3',

  onProgress: (bytesWritten, chunksReceived) => {
    console.log(`Progress: ${bytesWritten} bytes`);
  },

  requestId: 'optional-id', // optional
  timeout: 30000 // optional
});

console.log(`Wrote ${result.bytesWritten} bytes`);
```

---

### Event Methods

#### `on<K>(event: K, listener: XTTSClientEvents[K]): this`

Adds an event listener.

**Parameters:**

- `event` (keyof XTTSClientEvents) - Event name
- `listener` (Function) - Event handler function

**Returns:** this (for chaining)

**Example:**

```typescript
client.on('connected', () => {
  console.log('Connected!');
});

client.on('error', (error) => {
  console.error('Error:', error);
});
```

---

#### `once<K>(event: K, listener: XTTSClientEvents[K]): this`

Adds a one-time event listener that automatically removes itself after firing.

**Parameters:**

- `event` (keyof XTTSClientEvents) - Event name
- `listener` (Function) - Event handler function

**Returns:** this (for chaining)

**Example:**

```typescript
client.once('connected', () => {
  console.log('Connected for the first time!');
});
```

---

#### `off<K>(event: K, listener: XTTSClientEvents[K]): this`

Removes an event listener.

**Parameters:**

- `event` (keyof XTTSClientEvents) - Event name
- `listener` (Function) - Event handler function to remove

**Returns:** this (for chaining)

**Example:**

```typescript
const handler = () => console.log('Connected');
client.on('connected', handler);

// Later...
client.off('connected', handler);
```

---

### Static Methods

#### `XTTSClient.getVersion(): string`

Gets the SDK version.

**Returns:** string - SDK version

**Example:**

```typescript
const version = XTTSClient.getVersion();
console.log(`SDK version: ${version}`);
```

---

## TypeScript Types

### Interfaces

#### XTTSClientConfig

Client configuration interface.

```typescript
interface XTTSClientConfig {
  /** API key for authentication (generated from XTTS server) */
  apiKey: string;

  /** Voice identifier for TTS synthesis */
  voice: string;

  /** WebSocket server URL (default: 'wss://xttsws.xcai.io') */
  serverUrl?: string;

  /** Connection timeout in milliseconds (default: 10000) */
  connectionTimeout?: number;

  /** Enable auto-reconnect on connection loss (default: false) */
  autoReconnect?: boolean;
}
```

---

#### SynthesisOptions

Options for `synthesize()` method.

```typescript
interface SynthesisOptions {
  /** Text to synthesize */
  text: string;

  /** Optional request ID for correlation */
  requestId?: string;

  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number;
}
```

---

#### StreamSynthesisOptions

Options for `synthesizeStream()` method.

```typescript
interface StreamSynthesisOptions {
  /** Text to synthesize */
  text: string;

  /** Callback for each audio chunk */
  onChunk: (chunk: Buffer) => void;

  /** Callback for final audio chunk */
  onComplete: (finalChunk: Buffer) => void;

  /** Callback for errors */
  onError: (error: Error) => void;

  /** Optional request ID for correlation */
  requestId?: string;

  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number;
}
```

---

#### FileSynthesisOptions

Options for `synthesizeToFile()` method.

```typescript
interface FileSynthesisOptions {
  /** Text to synthesize */
  text: string;

  /** Path to output file */
  filePath: string;

  /** Optional progress callback */
  onProgress?: (bytesWritten: number, chunksReceived: number) => void;

  /** Optional request ID for correlation */
  requestId?: string;

  /** Optional timeout in milliseconds (default: 30000) */
  timeout?: number;
}
```

---

#### FileSynthesisResult

Result from `synthesizeToFile()` method.

```typescript
interface FileSynthesisResult {
  /** Path to output file */
  filePath: string;

  /** Total bytes written */
  bytesWritten: number;

  /** Total chunks received */
  chunksReceived: number;

  /** Request ID used */
  requestId: string;
}
```

---

#### ConnectionInfo

Detailed connection state information.

```typescript
interface ConnectionInfo {
  /** Current connection state */
  state: ConnectionState;

  /** Whether client is connected and ready */
  isConnected: boolean;

  /** Number of reconnection attempts made */
  reconnectAttempts: number;

  /** Maximum number of reconnection attempts allowed */
  maxReconnectAttempts: number;

  /** Whether auto-reconnect is enabled */
  autoReconnect: boolean;

  /** Server URL being used */
  serverUrl: string;
}
```

---

#### ErrorData

Error information emitted in error events.

```typescript
interface ErrorData {
  /** Error code (HTTP-style codes) */
  code: number;

  /** Human-readable error message */
  message: string;

  /** Optional request ID for correlation */
  requestId?: string;

  /** Error category for classification */
  category?: ErrorCategory;

  /** Original error object if available */
  originalError?: Error;
}
```

---

#### AudioChunk

Audio chunk data received from server.

```typescript
interface AudioChunk {
  /** Audio data as Buffer */
  audio: Buffer;

  /** Optional request ID for correlation */
  requestId?: string;
}
```

---

#### CompletionData

Completion data received from server.

```typescript
interface CompletionData {
  /** Final audio chunk as Buffer */
  audio: Buffer;

  /** Optional request ID for correlation */
  requestId?: string;
}
```

---

#### XTTSClientEvents

Event map for type-safe event listeners.

```typescript
interface XTTSClientEvents {
  /** Emitted when WebSocket connection is established and ready */
  connected: () => void;

  /** Emitted when WebSocket connection is closed */
  disconnected: (code: number, reason: string) => void;

  /** Emitted when client is attempting to reconnect */
  reconnecting: (attempt: number, maxAttempts: number, delay: number) => void;

  /** Emitted when an audio chunk is received */
  audioChunk: (chunk: AudioChunk) => void;

  /** Emitted when synthesis is complete */
  complete: (data: CompletionData) => void;

  /** Emitted when an error occurs */
  error: (error: ErrorData) => void;
}
```

---

### Enums

#### ConnectionState

Connection state enumeration.

```typescript
enum ConnectionState {
  /** Not connected to server */
  DISCONNECTED = 'disconnected',

  /** Currently connecting to server */
  CONNECTING = 'connecting',

  /** Connected and ready for synthesis */
  CONNECTED = 'connected',

  /** Attempting to reconnect after connection loss */
  RECONNECTING = 'reconnecting',
}
```

---

#### ErrorCategory

Error category enumeration for classification.

```typescript
enum ErrorCategory {
  /** Network/connection errors */
  CONNECTION = 'connection',

  /** Authentication/authorization errors */
  AUTH = 'auth',

  /** Invalid request parameters */
  VALIDATION = 'validation',

  /** Server-side processing errors */
  SERVER = 'server',

  /** Client-side errors (parsing, callbacks, etc.) */
  CLIENT = 'client',

  /** Timeout errors */
  TIMEOUT = 'timeout',
}
```

---

## Error Codes

Common error codes and their meanings:

| Code | Category | Description |
|------|----------|-------------|
| 400 | VALIDATION | Bad Request - Invalid parameters |
| 401 | AUTH | Unauthorized - Invalid API key |
| 403 | AUTH | Forbidden - Insufficient permissions |
| 404 | CLIENT | Not Found |
| 408 | TIMEOUT | Request Timeout |
| 422 | VALIDATION | Unprocessable Entity - Invalid data |
| 500 | SERVER | Internal Server Error |
| 502 | SERVER | Bad Gateway |
| 503 | CONNECTION | Service Unavailable |
| 504 | CONNECTION | Gateway Timeout |

---

## WebSocket Protocol

The SDK communicates with the server using JSON messages over WebSocket.

### Client → Server Messages

#### Connect
```json
{
  "action": "connect",
  "voice": "emma"
}
```

#### Speak
```json
{
  "action": "speak",
  "voice": "emma",
  "text": "Hello, world!",
  "requestId": "req-123"
}
```

#### Disconnect
```json
{
  "action": "disconnect",
  "voice": "emma"
}
```

### Server → Client Messages

#### Ready
```json
{
  "type": "ready"
}
```

#### Audio
```json
{
  "type": "audio",
  "data": {
    "audio": "<base64-encoded-audio>"
  },
  "requestId": "req-123"
}
```

#### Complete
```json
{
  "type": "complete",
  "data": {
    "audio": "<base64-encoded-audio>"
  },
  "requestId": "req-123"
}
```

#### Error
```json
{
  "type": "error",
  "data": {
    "code": 400,
    "message": "Error description"
  },
  "requestId": "req-123"
}
```
