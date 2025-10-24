/**
 * Type definitions for XTTS Client SDK
 */

/**
 * Connection state enum
 */
export enum ConnectionState {
  /** Not connected to server */
  DISCONNECTED = 'disconnected',
  /** Currently connecting to server */
  CONNECTING = 'connecting',
  /** Connected and ready for synthesis */
  CONNECTED = 'connected',
  /** Attempting to reconnect after connection loss */
  RECONNECTING = 'reconnecting',
}

/**
 * Detailed connection state information
 */
export interface ConnectionInfo {
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

/**
 * Configuration for XTTSClient
 */
export interface XTTSClientConfig {
  /**
   * API key for authentication (generated from XTTS server)
   */
  apiKey: string;

  /**
   * Voice identifier for TTS synthesis
   */
  voice: string;

  /**
   * WebSocket server URL
   * @default 'wss://xttsws.xcai.io'
   */
  serverUrl?: string;

  /**
   * Optional timeout for connection in milliseconds
   * @default 10000
   */
  connectionTimeout?: number;

  /**
   * Optional auto-reconnect on connection loss
   * @default false
   */
  autoReconnect?: boolean;
}

/**
 * Audio chunk data received from server
 */
export interface AudioChunk {
  /**
   * Audio data as Buffer
   */
  audio: Buffer;

  /**
   * Optional request ID for correlation
   */
  requestId?: string;
}

/**
 * Completion data received from server
 */
export interface CompletionData {
  /**
   * Final audio chunk as Buffer
   */
  audio: Buffer;

  /**
   * Optional request ID for correlation
   */
  requestId?: string;
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
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

/**
 * Error data from server or client
 */
export interface ErrorData {
  /**
   * Error code (HTTP-style codes)
   */
  code: number;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Optional request ID for correlation
   */
  requestId?: string;

  /**
   * Error category for classification
   */
  category?: ErrorCategory;

  /**
   * Original error object if available
   */
  originalError?: Error;
}

/**
 * Event map for XTTSClient EventEmitter
 */
export interface XTTSClientEvents {
  /**
   * Emitted when WebSocket connection is established and ready
   */
  connected: () => void;

  /**
   * Emitted when WebSocket connection is closed
   */
  disconnected: (code: number, reason: string) => void;

  /**
   * Emitted when client is attempting to reconnect
   */
  reconnecting: (attempt: number, maxAttempts: number, delay: number) => void;

  /**
   * Emitted when an audio chunk is received (streaming)
   */
  audioChunk: (chunk: AudioChunk) => void;

  /**
   * Emitted when synthesis is complete (final audio chunk)
   */
  complete: (data: CompletionData) => void;

  /**
   * Emitted when an error occurs
   */
  error: (error: ErrorData) => void;
}

/**
 * Synthesis options for text-to-speech
 */
export interface SynthesisOptions {
  /**
   * Text to synthesize
   */
  text: string;

  /**
   * Optional request ID for correlation
   */
  requestId?: string;

  /**
   * Optional timeout for synthesis operation in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Internal type for tracking pending synthesis requests
 * @internal
 */
export interface PendingSynthesisRequest {
  requestId: string;
  audioChunks: Buffer[];
  resolve: (audio: Buffer) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Streaming synthesis options
 */
export interface StreamSynthesisOptions {
  /**
   * Text to synthesize
   */
  text: string;

  /**
   * Optional request ID for correlation
   */
  requestId?: string;

  /**
   * Callback invoked for each audio chunk received
   */
  onChunk: (chunk: Buffer) => void;

  /**
   * Callback invoked when synthesis is complete
   * @param finalChunk - The last audio chunk
   */
  onComplete: (finalChunk: Buffer) => void;

  /**
   * Callback invoked if an error occurs
   */
  onError: (error: Error) => void;

  /**
   * Optional timeout for synthesis operation in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Internal type for tracking streaming synthesis requests
 * @internal
 */
export interface PendingStreamRequest {
  requestId: string;
  onChunk: (chunk: Buffer) => void;
  onComplete: (finalChunk: Buffer) => void;
  onError: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * File synthesis options
 */
export interface FileSynthesisOptions {
  /**
   * Text to synthesize
   */
  text: string;

  /**
   * Output file path (absolute or relative)
   */
  filePath: string;

  /**
   * Optional request ID for correlation
   */
  requestId?: string;

  /**
   * Optional progress callback
   * @param bytesWritten - Total bytes written to file so far
   * @param chunksReceived - Number of chunks received
   */
  onProgress?: (bytesWritten: number, chunksReceived: number) => void;

  /**
   * Optional timeout for synthesis operation in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Internal type for tracking file synthesis requests
 * @internal
 */
export interface PendingFileRequest {
  requestId: string;
  filePath: string;
  fileHandle: any; // fs.FileHandle from fs.promises
  bytesWritten: number;
  chunksReceived: number;
  onProgress?: (bytesWritten: number, chunksReceived: number) => void;
  resolve: (result: FileSynthesisResult) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Result from file synthesis
 */
export interface FileSynthesisResult {
  /**
   * Path to the written file
   */
  filePath: string;

  /**
   * Total bytes written
   */
  bytesWritten: number;

  /**
   * Number of chunks received
   */
  chunksReceived: number;

  /**
   * Request ID used
   */
  requestId: string;
}
