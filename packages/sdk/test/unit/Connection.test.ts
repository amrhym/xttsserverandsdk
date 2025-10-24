/**
 * Unit tests for XTTSClient WebSocket connection management
 */

import { XTTSClient } from '../../src/XTTSClient';
import { XTTSClientConfig } from '../../src/types';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('XTTSClient - Connection Management', () => {
  let mockWebSocket: any;
  let client: XTTSClient;

  const validConfig: XTTSClientConfig = {
    apiKey: 'test-api-key',
    voice: 'emma',
    serverUrl: 'ws://localhost:8080',
    connectionTimeout: 5000,
  };

  beforeEach(() => {
    // Create mock WebSocket instance
    mockWebSocket = {
      on: jest.fn(),
      once: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    };

    // Mock WebSocket constructor
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWebSocket);

    client = new XTTSClient(validConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    if (client) {
      client.disconnect();
    }
  });

  describe('connect()', () => {
    it('should create WebSocket with correct URL including API key', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket open
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      // Simulate ready message
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080?apiKey=test-api-key');
    });

    it('should send connect message after WebSocket opens', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket open
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'connect', voice: 'emma' })
      );

      // Simulate ready message to complete connection
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;
    });

    it('should emit connected event when ready message received', async () => {
      const connectedSpy = jest.fn();
      client.on('connected', connectedSpy);

      const connectPromise = client.connect();

      // Simulate WebSocket open
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      // Simulate ready message
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      expect(connectedSpy).toHaveBeenCalledTimes(1);
      expect(client.isConnected()).toBe(true);
    });

    it('should reject on connection timeout', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(5000);

      await expect(connectPromise).rejects.toThrow('Connection timeout after 5000ms');

      jest.useRealTimers();
    });

    it('should handle connection errors', async () => {
      // Add error event listener to prevent unhandled error
      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      const connectPromise = client.connect();

      // Simulate WebSocket error
      const errorHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'error')[1];
      const testError = new Error('Connection failed');
      errorHandler(testError);

      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: 'Connection failed',
        })
      );
    });

    it('should not create new connection if already connected', async () => {
      // First connection
      const connectPromise1 = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise1;

      const callCount = (WebSocket as unknown as jest.Mock).mock.calls.length;

      // Try to connect again
      await client.connect();

      // Should not create another WebSocket
      expect((WebSocket as unknown as jest.Mock).mock.calls.length).toBe(callCount);
    });
  });

  describe('disconnect()', () => {
    beforeEach(async () => {
      // Establish connection first
      const connectPromise = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;
    });

    it('should send disconnect message before closing', () => {
      client.disconnect();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'disconnect', voice: 'emma' })
      );
    });

    it('should close WebSocket with default code 1000', () => {
      client.disconnect();

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Client disconnect');
    });

    it('should close WebSocket with custom code and reason', () => {
      client.disconnect(1001, 'Going away');

      expect(mockWebSocket.close).toHaveBeenCalledWith(1001, 'Going away');
    });

    it('should mark client as disconnected', () => {
      expect(client.isConnected()).toBe(true);

      client.disconnect();

      expect(client.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      const disconnectedClient = new XTTSClient(validConfig);

      expect(() => disconnectedClient.disconnect()).not.toThrow();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      // Establish connection
      const connectPromise = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;
    });

    it('should emit audioChunk event for audio messages', () => {
      const audioChunkSpy = jest.fn();
      client.on('audioChunk', audioChunkSpy);

      // Get message handler
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Simulate audio message
      const audioData = Buffer.from('test audio').toString('base64');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: audioData },
        requestId: 'req-123',
      })));

      expect(audioChunkSpy).toHaveBeenCalledWith({
        audio: Buffer.from('test audio'),
        requestId: 'req-123',
      });
    });

    it('should emit complete event for complete messages', () => {
      const completeSpy = jest.fn();
      client.on('complete', completeSpy);

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const audioData = Buffer.from('final audio').toString('base64');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audioData },
        requestId: 'req-456',
      })));

      expect(completeSpy).toHaveBeenCalledWith({
        audio: Buffer.from('final audio'),
        requestId: 'req-456',
      });
    });

    it('should emit error event for error messages', () => {
      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({
        type: 'error',
        data: { code: 400, message: 'Bad request' },
        requestId: 'req-789',
      })));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 400,
          message: 'Bad request',
          requestId: 'req-789',
        })
      );
    });

    it('should emit error event for malformed messages', () => {
      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Send invalid JSON
      messageHandler(Buffer.from('invalid json'));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: expect.stringContaining('Failed to parse server message'),
        })
      );
    });
  });

  describe('Auto-reconnect', () => {
    beforeEach(() => {
      client = new XTTSClient({
        ...validConfig,
        autoReconnect: true,
      });
    });

    it('should attempt reconnection on unexpected disconnect', async () => {
      jest.useFakeTimers();

      // Establish connection
      const connectPromise = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      // Clear mock to track reconnection attempt
      (WebSocket as unknown as jest.Mock).mockClear();

      // Simulate unexpected close
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')[1];
      closeHandler(1006, 'Abnormal closure');

      // Fast-forward to trigger reconnection
      jest.advanceTimersByTime(1000);

      // Should attempt to create new WebSocket
      expect(WebSocket).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should not reconnect on intentional disconnect', async () => {
      jest.useFakeTimers();

      // Establish connection
      const connectPromise = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      (WebSocket as unknown as jest.Mock).mockClear();

      // Intentional disconnect
      client.disconnect();

      // Simulate close event
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')[1];
      closeHandler(1000, 'Normal closure');

      // Fast-forward time
      jest.advanceTimersByTime(5000);

      // Should NOT attempt reconnection
      expect(WebSocket).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should emit disconnected event on close', async () => {
      const disconnectedSpy = jest.fn();
      client.on('disconnected', disconnectedSpy);

      // Establish connection
      const connectPromise = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      // Simulate close
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')[1];
      closeHandler(1000, 'Normal closure');

      expect(disconnectedSpy).toHaveBeenCalledWith(1000, 'Normal closure');
    });
  });

  describe('isConnected()', () => {
    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      const connectPromise = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      expect(client.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const connectPromise = client.connect();

      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      client.disconnect();

      expect(client.isConnected()).toBe(false);
    });
  });
});
