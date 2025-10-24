/**
 * XTTSClient - Core SDK Client for XTTS Proxy
 *
 * EventEmitter-based client for connecting to XTTS WebSocket server.
 * Provides high-level API for text-to-speech synthesis with complete
 * provider obfuscation.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { promises as fs } from 'fs';
import type {
  XTTSClientConfig,
  XTTSClientEvents,
  SynthesisOptions,
  PendingSynthesisRequest,
  StreamSynthesisOptions,
  PendingStreamRequest,
  FileSynthesisOptions,
  PendingFileRequest,
  FileSynthesisResult,
  ConnectionState,
  ConnectionInfo,
} from './types';
import { ConnectionState as ConnectionStateEnum, ErrorCategory } from './types';

/**
 * XTTSClient - Main SDK class
 *
 * @example
 * ```typescript
 * // Connect to public XTTS server (default: wss://xttsws.xcai.io)
 * const client = new XTTSClient({
 *   apiKey: 'your-api-key-from-xtts-server',
 *   voice: 'emma'
 * });
 *
 * // Or specify custom server URL (e.g., for local development)
 * const client = new XTTSClient({
 *   apiKey: 'your-api-key',
 *   voice: 'emma',
 *   serverUrl: 'ws://localhost:8080'
 * });
 *
 * client.on('connected', () => {
 *   console.log('Connected to XTTS server');
 * });
 *
 * client.on('audioChunk', (chunk) => {
 *   // Process audio chunk
 * });
 *
 * await client.connect();
 * await client.synthesize({ text: 'Hello, world!' });
 * ```
 */
export class XTTSClient extends EventEmitter {
  private config: Required<XTTSClientConfig>;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private connectionState: ConnectionState = ConnectionStateEnum.DISCONNECTED;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second
  private isReconnecting: boolean = false;
  private intentionalDisconnect: boolean = false;
  private pendingSynthesis: Map<string, PendingSynthesisRequest> = new Map();
  private pendingStreams: Map<string, PendingStreamRequest> = new Map();
  private pendingFiles: Map<string, PendingFileRequest> = new Map();

  /**
   * Create a new XTTSClient instance
   *
   * @param config - Client configuration
   * @throws {Error} If required configuration is missing or invalid
   */
  constructor(config: XTTSClientConfig) {
    super();

    // Validate required fields
    this.validateConfig(config);

    // Store configuration with defaults
    this.config = {
      apiKey: config.apiKey,
      serverUrl: config.serverUrl ?? 'wss://xttsws.xcai.io',
      voice: config.voice,
      connectionTimeout: config.connectionTimeout ?? 10000,
      autoReconnect: config.autoReconnect ?? false,
    };
  }

  /**
   * Validate client configuration
   *
   * @private
   */
  private validateConfig(config: XTTSClientConfig): void {
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      throw new Error('apiKey is required and must be a non-empty string');
    }

    if (!config.voice || typeof config.voice !== 'string' || config.voice.trim() === '') {
      throw new Error('voice is required and must be a non-empty string');
    }

    // Validate optional serverUrl if provided
    if (config.serverUrl !== undefined) {
      if (typeof config.serverUrl !== 'string' || config.serverUrl.trim() === '') {
        throw new Error('serverUrl must be a non-empty string if provided');
      }

      // Validate WebSocket URL format
      if (!config.serverUrl.startsWith('ws://') && !config.serverUrl.startsWith('wss://')) {
        throw new Error('serverUrl must start with ws:// or wss://');
      }
    }

    // Validate optional timeout
    if (config.connectionTimeout !== undefined) {
      if (typeof config.connectionTimeout !== 'number' || config.connectionTimeout <= 0) {
        throw new Error('connectionTimeout must be a positive number');
      }
    }

    // Validate optional autoReconnect
    if (config.autoReconnect !== undefined && typeof config.autoReconnect !== 'boolean') {
      throw new Error('autoReconnect must be a boolean');
    }
  }

  /**
   * Get current configuration (read-only)
   */
  public getConfig(): Readonly<Required<XTTSClientConfig>> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Check if client is currently connected
   */
  public isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get detailed connection state information
   *
   * @returns ConnectionInfo object with current state and statistics
   */
  public getConnectionState(): ConnectionInfo {
    return {
      state: this.connectionState,
      isConnected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      autoReconnect: this.config.autoReconnect,
      serverUrl: this.config.serverUrl,
    };
  }

  /**
   * Manually trigger reconnection
   *
   * @returns Promise that resolves when reconnected
   * @throws {Error} If already connected or reconnecting
   */
  public async reconnect(): Promise<void> {
    if (this.isConnected()) {
      throw new Error('Already connected. Disconnect first before reconnecting.');
    }

    if (this.isReconnecting) {
      throw new Error('Reconnection already in progress');
    }

    // Reset reconnection attempts for manual reconnect
    this.reconnectAttempts = 0;
    this.intentionalDisconnect = false;

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Attempt to connect
    await this.connect();
  }

  /**
   * Type-safe event emitter methods
   */
  public override on<K extends keyof XTTSClientEvents>(
    event: K,
    listener: XTTSClientEvents[K]
  ): this {
    return super.on(event, listener as any);
  }

  public override once<K extends keyof XTTSClientEvents>(
    event: K,
    listener: XTTSClientEvents[K]
  ): this {
    return super.once(event, listener as any);
  }

  public override off<K extends keyof XTTSClientEvents>(
    event: K,
    listener: XTTSClientEvents[K]
  ): this {
    return super.off(event, listener as any);
  }

  public override emit<K extends keyof XTTSClientEvents>(
    event: K,
    ...args: Parameters<XTTSClientEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Connect to XTTS WebSocket server
   *
   * @returns Promise that resolves when connected and ready
   * @throws {Error} If connection fails or times out
   */
  public async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    return new Promise((resolve, reject) => {
      try {
        // Update connection state
        this.connectionState = ConnectionStateEnum.CONNECTING;

        // Create WebSocket connection with API key in URL
        const url = `${this.config.serverUrl}?apiKey=${encodeURIComponent(this.config.apiKey)}`;
        this.ws = new WebSocket(url);

        // Set up connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.close();
            reject(new Error(`Connection timeout after ${this.config.connectionTimeout}ms`));
          }
        }, this.config.connectionTimeout);

        // WebSocket event handlers
        this.ws.on('open', () => {
          this.handleOpen(resolve);
        });

        this.ws.on('message', (data: Buffer) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          this.handleError(error, reject);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.handleClose(code, reason.toString());
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from XTTS WebSocket server
   *
   * @param code - WebSocket close code (default: 1000 - Normal Closure)
   * @param reason - Human-readable close reason
   */
  public disconnect(code: number = 1000, reason: string = 'Client disconnect'): void {
    this.intentionalDisconnect = true;

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    // Reject all pending synthesis requests
    for (const request of this.pendingSynthesis.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Disconnected before synthesis completed'));
    }
    this.pendingSynthesis.clear();

    // Cancel all pending streams
    for (const stream of this.pendingStreams.values()) {
      clearTimeout(stream.timeout);
      stream.onError(new Error('Disconnected before stream completed'));
    }
    this.pendingStreams.clear();

    // Cancel all pending file operations
    for (const fileReq of this.pendingFiles.values()) {
      clearTimeout(fileReq.timeout);
      fileReq.fileHandle.close().catch(() => {
        // Ignore close errors
      });
      fileReq.reject(new Error('Disconnected before file synthesis completed'));
    }
    this.pendingFiles.clear();

    if (this.ws) {
      // Send disconnect message to server before closing
      if (this.connected && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({
            action: 'disconnect',
            voice: this.config.voice,
          }));
        } catch (error) {
          // Ignore send errors during disconnect
        }
      }

      this.ws.close(code, reason);
      this.ws = null;
    }

    this.connected = false;
    this.connectionState = ConnectionStateEnum.DISCONNECTED;
    this.reconnectAttempts = 0;
  }

  /**
   * Synthesize text to speech
   *
   * Sends text to server and collects all audio chunks into a single Buffer.
   * Returns when synthesis is complete.
   *
   * @param options - Synthesis options (text, optional requestId, optional timeout)
   * @returns Promise that resolves with complete audio as Buffer
   * @throws {Error} If not connected, synthesis fails, or times out
   *
   * @example
   * ```typescript
   * const audio = await client.synthesize({
   *   text: 'Hello, world!',
   *   timeout: 30000 // 30 seconds (default)
   * });
   * // audio is a Buffer containing complete audio data
   * ```
   */
  public async synthesize(options: SynthesisOptions): Promise<Buffer> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to server. Call connect() first.');
    }

    if (!options.text || options.text.trim() === '') {
      throw new Error('Text is required for synthesis');
    }

    // Generate request ID if not provided
    const requestId = options.requestId || this.generateRequestId();
    const timeout = options.timeout || 30000; // Default 30 seconds

    return new Promise<Buffer>((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingSynthesis.delete(requestId);
        reject(new Error(`Synthesis timeout after ${timeout}ms`));
      }, timeout);

      // Store pending request
      this.pendingSynthesis.set(requestId, {
        requestId,
        audioChunks: [],
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // Send speak message to server
      try {
        const speakMessage = {
          action: 'speak',
          voice: this.config.voice,
          text: options.text,
          requestId,
        };

        this.ws!.send(JSON.stringify(speakMessage));
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingSynthesis.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Synthesize text to speech with streaming delivery
   *
   * Sends text to server and delivers audio chunks in real-time via callbacks.
   * Does NOT collect audio in memory - suitable for long texts and memory-constrained environments.
   *
   * @param options - Streaming synthesis options with callbacks
   * @returns Request ID for tracking this stream
   * @throws {Error} If not connected or text is invalid
   *
   * @example
   * ```typescript
   * const requestId = client.synthesizeStream({
   *   text: 'Long text for streaming...',
   *   onChunk: (chunk) => {
   *     // Process each audio chunk immediately
   *     audioPlayer.play(chunk);
   *   },
   *   onComplete: (finalChunk) => {
   *     // Process final chunk
   *     audioPlayer.play(finalChunk);
   *     console.log('Stream complete');
   *   },
   *   onError: (error) => {
   *     console.error('Stream error:', error.message);
   *   }
   * });
   *
   * // Optionally cancel the stream later
   * client.cancelStream(requestId);
   * ```
   */
  public synthesizeStream(options: StreamSynthesisOptions): string {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to server. Call connect() first.');
    }

    if (!options.text || options.text.trim() === '') {
      throw new Error('Text is required for synthesis');
    }

    // Generate request ID if not provided
    const requestId = options.requestId || this.generateRequestId();
    const timeout = options.timeout || 30000; // Default 30 seconds

    // Set up timeout
    const timeoutHandle = setTimeout(() => {
      this.pendingStreams.delete(requestId);
      options.onError(new Error(`Stream synthesis timeout after ${timeout}ms`));
    }, timeout);

    // Store pending stream
    this.pendingStreams.set(requestId, {
      requestId,
      onChunk: options.onChunk,
      onComplete: options.onComplete,
      onError: options.onError,
      timeout: timeoutHandle,
    });

    // Send speak message to server
    try {
      const speakMessage = {
        action: 'speak',
        voice: this.config.voice,
        text: options.text,
        requestId,
      };

      this.ws.send(JSON.stringify(speakMessage));
    } catch (error) {
      clearTimeout(timeoutHandle);
      this.pendingStreams.delete(requestId);
      throw error;
    }

    return requestId;
  }

  /**
   * Cancel an active streaming synthesis
   *
   * @param requestId - The request ID returned by synthesizeStream()
   * @returns true if stream was found and cancelled, false otherwise
   */
  public cancelStream(requestId: string): boolean {
    const stream = this.pendingStreams.get(requestId);
    if (!stream) {
      return false;
    }

    clearTimeout(stream.timeout);
    this.pendingStreams.delete(requestId);
    stream.onError(new Error('Stream cancelled by user'));
    return true;
  }

  /**
   * Synthesize text to speech and write directly to file
   *
   * Streams audio chunks directly to disk without loading into memory.
   * Memory-efficient for long texts and large audio outputs.
   *
   * @param options - File synthesis options
   * @returns Promise that resolves with file information when complete
   * @throws {Error} If not connected, text is invalid, or file operations fail
   *
   * @example
   * ```typescript
   * const result = await client.synthesizeToFile({
   *   text: 'Long text for file output...',
   *   filePath: './output.mp3',
   *   onProgress: (bytesWritten, chunksReceived) => {
   *     console.log(`Progress: ${bytesWritten} bytes, ${chunksReceived} chunks`);
   *   }
   * });
   *
   * console.log(`Written to ${result.filePath}`);
   * console.log(`Total: ${result.bytesWritten} bytes`);
   * ```
   */
  public async synthesizeToFile(options: FileSynthesisOptions): Promise<FileSynthesisResult> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to server. Call connect() first.');
    }

    if (!options.text || options.text.trim() === '') {
      throw new Error('Text is required for synthesis');
    }

    if (!options.filePath || options.filePath.trim() === '') {
      throw new Error('filePath is required');
    }

    // Generate request ID if not provided
    const requestId = options.requestId || this.generateRequestId();
    const timeout = options.timeout || 30000; // Default 30 seconds

    return new Promise<FileSynthesisResult>(async (resolve, reject) => {
      let fileHandle: any = null;

      try {
        // Open file for writing
        fileHandle = await fs.open(options.filePath, 'w');

        // Set up timeout
        const timeoutHandle = setTimeout(async () => {
          this.pendingFiles.delete(requestId);

          // Close file handle
          if (fileHandle) {
            try {
              await fileHandle.close();
            } catch (error) {
              // Ignore close errors during timeout
            }
          }

          reject(new Error(`File synthesis timeout after ${timeout}ms`));
        }, timeout);

        // Store pending file request
        this.pendingFiles.set(requestId, {
          requestId,
          filePath: options.filePath,
          fileHandle,
          bytesWritten: 0,
          chunksReceived: 0,
          onProgress: options.onProgress,
          resolve,
          reject,
          timeout: timeoutHandle,
        });

        // Send speak message to server
        const speakMessage = {
          action: 'speak',
          voice: this.config.voice,
          text: options.text,
          requestId,
        };

        this.ws!.send(JSON.stringify(speakMessage));
      } catch (error) {
        // Clean up on error
        if (fileHandle) {
          try {
            await fileHandle.close();
          } catch (closeError) {
            // Ignore close errors
          }
        }
        reject(error);
      }
    });
  }

  /**
   * Generate a unique request ID
   * @private
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Handle WebSocket open event
   * @private
   */
  private handleOpen(resolve: () => void): void {
    // Wait for 'ready' response from server before sending connect message
    const readyHandler = (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ready') {
          // Server is ready, now send connect message with voice configuration
          const connectMessage = {
            action: 'connect',
            voice: this.config.voice,
          };

          this.ws!.send(JSON.stringify(connectMessage));

          this.connected = true;
          this.connectionState = ConnectionStateEnum.CONNECTED;
          this.reconnectAttempts = 0;

          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
          }

          this.emit('connected');
          resolve();
        }
      } catch (error) {
        // Ignore parsing errors for non-ready messages
      }
    };

    this.ws!.once('message', readyHandler);
  }

  /**
   * Handle WebSocket message event
   * @private
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'audio': {
          // Streaming audio chunk
          const audioBuffer = Buffer.from(message.data.audio, 'base64');

          // If this is part of a pending synthesis request, collect it
          if (message.requestId && this.pendingSynthesis.has(message.requestId)) {
            const request = this.pendingSynthesis.get(message.requestId)!;
            request.audioChunks.push(audioBuffer);
          }

          // If this is part of a pending stream request, deliver it via callback
          if (message.requestId && this.pendingStreams.has(message.requestId)) {
            const stream = this.pendingStreams.get(message.requestId)!;
            try {
              stream.onChunk(audioBuffer);
            } catch (error) {
              // If callback throws, clean up and call onError
              clearTimeout(stream.timeout);
              this.pendingStreams.delete(message.requestId);
              stream.onError(error instanceof Error ? error : new Error(String(error)));
            }
          }

          // If this is part of a pending file request, write to file
          if (message.requestId && this.pendingFiles.has(message.requestId)) {
            const fileReq = this.pendingFiles.get(message.requestId)!;
            this.writeChunkToFile(fileReq, audioBuffer).catch((error) => {
              clearTimeout(fileReq.timeout);
              this.pendingFiles.delete(message.requestId);
              fileReq.reject(error);
            });
          }

          // Always emit event for event-based streaming use cases
          this.emit('audioChunk', {
            audio: audioBuffer,
            requestId: message.requestId,
          });
          break;
        }

        case 'complete': {
          // Final audio chunk
          const audioBuffer = Buffer.from(message.data.audio, 'base64');

          // If this is part of a pending synthesis request, complete it
          if (message.requestId && this.pendingSynthesis.has(message.requestId)) {
            const request = this.pendingSynthesis.get(message.requestId)!;
            request.audioChunks.push(audioBuffer);

            // Concatenate all chunks into single buffer
            const completeAudio = Buffer.concat(request.audioChunks);

            // Clean up
            clearTimeout(request.timeout);
            this.pendingSynthesis.delete(message.requestId);

            // Resolve the promise
            request.resolve(completeAudio);
          }

          // If this is part of a pending stream request, deliver final chunk and complete
          if (message.requestId && this.pendingStreams.has(message.requestId)) {
            const stream = this.pendingStreams.get(message.requestId)!;
            clearTimeout(stream.timeout);
            this.pendingStreams.delete(message.requestId);

            try {
              stream.onComplete(audioBuffer);
            } catch (error) {
              // If onComplete callback throws, call onError
              stream.onError(error instanceof Error ? error : new Error(String(error)));
            }
          }

          // If this is part of a pending file request, write final chunk and complete
          if (message.requestId && this.pendingFiles.has(message.requestId)) {
            const fileReq = this.pendingFiles.get(message.requestId)!;
            this.finalizeFile(fileReq, audioBuffer).catch((error) => {
              clearTimeout(fileReq.timeout);
              this.pendingFiles.delete(message.requestId);
              fileReq.reject(error);
            });
          }

          // Always emit event
          this.emit('complete', {
            audio: audioBuffer,
            requestId: message.requestId,
          });
          break;
        }

        case 'error': {
          // Error from server
          const category = this.categorizeError(message.data.code);
          const errorData = {
            code: message.data.code,
            message: message.data.message,
            requestId: message.requestId,
            category,
          };

          // If this is part of a pending synthesis request, reject it
          if (message.requestId && this.pendingSynthesis.has(message.requestId)) {
            const request = this.pendingSynthesis.get(message.requestId)!;
            clearTimeout(request.timeout);
            this.pendingSynthesis.delete(message.requestId);
            request.reject(new Error(`Synthesis failed: ${errorData.message} (code: ${errorData.code})`));
          }

          // If this is part of a pending stream request, call onError
          if (message.requestId && this.pendingStreams.has(message.requestId)) {
            const stream = this.pendingStreams.get(message.requestId)!;
            clearTimeout(stream.timeout);
            this.pendingStreams.delete(message.requestId);
            stream.onError(new Error(`Stream failed: ${errorData.message} (code: ${errorData.code})`));
          }

          // If this is part of a pending file request, reject and close file
          if (message.requestId && this.pendingFiles.has(message.requestId)) {
            const fileReq = this.pendingFiles.get(message.requestId)!;
            clearTimeout(fileReq.timeout);
            this.pendingFiles.delete(message.requestId);

            // Close file handle
            fileReq.fileHandle.close().catch(() => {
              // Ignore close errors
            });

            fileReq.reject(new Error(`File synthesis failed: ${errorData.message} (code: ${errorData.code})`));
          }

          // Always emit event
          this.emit('error', errorData);
          break;
        }

        case 'ready':
          // Ready message (handled in handleOpen)
          break;

        default:
          // Unknown message type - ignore
          break;
      }
    } catch (error) {
      this.emit('error', {
        code: 500,
        message: `Failed to parse server message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        category: ErrorCategory.CLIENT,
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Handle WebSocket error event
   * @private
   */
  private handleError(error: Error, reject?: (error: Error) => void): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.emit('error', {
      code: 500,
      message: error.message,
      category: ErrorCategory.CONNECTION,
      originalError: error,
    });

    if (reject) {
      reject(error);
    }
  }

  /**
   * Handle WebSocket close event
   * @private
   */
  private handleClose(code: number, reason: string): void {
    const wasConnected = this.connected;
    this.connected = false;
    this.connectionState = ConnectionStateEnum.DISCONNECTED;

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    this.emit('disconnected', code, reason);

    // Attempt reconnection if enabled and not intentional disconnect
    if (this.config.autoReconnect && !this.intentionalDisconnect && wasConnected) {
      this.attemptReconnect();
    } else {
      // Reset intentional disconnect flag
      if (this.intentionalDisconnect) {
        this.intentionalDisconnect = false;
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   * @private
   */
  private attemptReconnect(): void {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    this.connectionState = ConnectionStateEnum.RECONNECTING;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    // Emit reconnecting event
    this.emit('reconnecting', this.reconnectAttempts, this.maxReconnectAttempts, delay);

    setTimeout(async () => {
      try {
        await this.connect();
        this.isReconnecting = false;
      } catch (error) {
        this.isReconnecting = false;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.connectionState = ConnectionStateEnum.DISCONNECTED;
          this.emit('error', {
            code: 503,
            message: `Failed to reconnect after ${this.maxReconnectAttempts} attempts`,
            category: ErrorCategory.CONNECTION,
          });
        } else {
          // Try again
          this.attemptReconnect();
        }
      }
    }, delay);
  }

  /**
   * Write audio chunk to file
   * @private
   */
  private async writeChunkToFile(fileReq: PendingFileRequest, chunk: Buffer): Promise<void> {
    try {
      await fileReq.fileHandle.write(chunk);
      fileReq.bytesWritten += chunk.length;
      fileReq.chunksReceived += 1;

      // Call progress callback if provided
      if (fileReq.onProgress) {
        try {
          fileReq.onProgress(fileReq.bytesWritten, fileReq.chunksReceived);
        } catch (error) {
          // Ignore progress callback errors
        }
      }
    } catch (error) {
      // Close file on write error
      await fileReq.fileHandle.close().catch(() => {});
      throw error;
    }
  }

  /**
   * Write final chunk and finalize file
   * @private
   */
  private async finalizeFile(fileReq: PendingFileRequest, finalChunk: Buffer): Promise<void> {
    try {
      // Write final chunk
      await fileReq.fileHandle.write(finalChunk);
      fileReq.bytesWritten += finalChunk.length;
      fileReq.chunksReceived += 1;

      // Call progress callback one last time
      if (fileReq.onProgress) {
        try {
          fileReq.onProgress(fileReq.bytesWritten, fileReq.chunksReceived);
        } catch (error) {
          // Ignore progress callback errors
        }
      }

      // Close file
      await fileReq.fileHandle.close();

      // Clean up
      clearTimeout(fileReq.timeout);
      this.pendingFiles.delete(fileReq.requestId);

      // Resolve with result
      fileReq.resolve({
        filePath: fileReq.filePath,
        bytesWritten: fileReq.bytesWritten,
        chunksReceived: fileReq.chunksReceived,
        requestId: fileReq.requestId,
      });
    } catch (error) {
      // Close file on error
      await fileReq.fileHandle.close().catch(() => {});
      throw error;
    }
  }

  /**
   * Categorize error based on HTTP status code
   * @private
   */
  private categorizeError(code: number): ErrorCategory {
    // Check for timeout first
    if (code === 408) {
      return ErrorCategory.TIMEOUT;
    }

    if (code >= 400 && code < 500) {
      // Client errors
      if (code === 401 || code === 403) {
        return ErrorCategory.AUTH;
      }
      if (code === 400 || code === 422) {
        return ErrorCategory.VALIDATION;
      }
      return ErrorCategory.CLIENT;
    } else if (code >= 500 && code < 600) {
      // Server errors
      if (code === 503 || code === 504) {
        return ErrorCategory.CONNECTION;
      }
      return ErrorCategory.SERVER;
    }
    return ErrorCategory.SERVER;
  }

  /**
   * Get SDK version
   */
  public static getVersion(): string {
    return '1.0.0';
  }
}
