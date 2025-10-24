/**
 * Unit tests for XTTSClient synthesizeStream() method
 */

import { XTTSClient } from '../../src/XTTSClient';
import { XTTSClientConfig } from '../../src/types';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('XTTSClient - Streaming Synthesis', () => {
  let mockWebSocket: any;
  let client: XTTSClient;

  const validConfig: XTTSClientConfig = {
    apiKey: 'test-api-key',
    voice: 'emma',
    serverUrl: 'ws://localhost:8080',
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

  // Helper to establish connection
  async function connectClient() {
    const connectPromise = client.connect();

    const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
    openHandler();

    const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
    messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

    await connectPromise;
  }

  describe('synthesizeStream() - Basic Functionality', () => {
    it('should throw error if not connected', () => {
      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      expect(() => client.synthesizeStream({
        text: 'Hello',
        onChunk,
        onComplete,
        onError,
      })).toThrow('Not connected to server. Call connect() first.');
    });

    it('should throw error if text is empty', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      expect(() => client.synthesizeStream({
        text: '',
        onChunk,
        onComplete,
        onError,
      })).toThrow('Text is required for synthesis');
    });

    it('should return request ID', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const requestId = client.synthesizeStream({
        text: 'Test',
        onChunk,
        onComplete,
        onError,
      });

      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
      expect(requestId).toMatch(/^req-/);
    });

    it('should use provided request ID', async () => {
      await connectClient();

      const customId = 'my-stream-123';
      const requestId = client.synthesizeStream({
        text: 'Test',
        requestId: customId,
        onChunk: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
      });

      expect(requestId).toBe(customId);
    });

    it('should send speak message to server', async () => {
      await connectClient();

      const requestId = client.synthesizeStream({
        text: 'Hello streaming',
        onChunk: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn(),
      });

      const sendCalls = mockWebSocket.send.mock.calls;
      const lastCall = sendCalls[sendCalls.length - 1][0];
      const message = JSON.parse(lastCall);

      expect(message.action).toBe('speak');
      expect(message.voice).toBe('emma');
      expect(message.text).toBe('Hello streaming');
      expect(message.requestId).toBe(requestId);
    });
  });

  describe('synthesizeStream() - Chunk Delivery', () => {
    it('should call onChunk for each audio chunk', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Send multiple chunks
      const chunk1 = Buffer.from('chunk1');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk1.toString('base64') },
        requestId: 'stream-1',
      })));

      const chunk2 = Buffer.from('chunk2');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk2.toString('base64') },
        requestId: 'stream-1',
      })));

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenNthCalledWith(1, chunk1);
      expect(onChunk).toHaveBeenNthCalledWith(2, chunk2);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should call onComplete with final chunk', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Send chunk then complete
      const chunk1 = Buffer.from('chunk1');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk1.toString('base64') },
        requestId: 'stream-1',
      })));

      const finalChunk = Buffer.from('final');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: finalChunk.toString('base64') },
        requestId: 'stream-1',
      })));

      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(finalChunk);
    });

    it('should NOT collect chunks in memory', async () => {
      await connectClient();

      const chunks: Buffer[] = [];
      const onChunk = jest.fn((chunk) => chunks.push(chunk));
      const onComplete = jest.fn();
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Send multiple chunks
      for (let i = 0; i < 5; i++) {
        const chunk = Buffer.from(`chunk${i}`);
        messageHandler(Buffer.from(JSON.stringify({
          type: 'audio',
          data: { audio: chunk.toString('base64') },
          requestId: 'stream-1',
        })));
      }

      // Each chunk delivered immediately
      expect(onChunk).toHaveBeenCalledTimes(5);
      expect(chunks.length).toBe(5);

      // Chunks not concatenated - each is independent
      expect(chunks[0].toString()).toBe('chunk0');
      expect(chunks[4].toString()).toBe('chunk4');
    });
  });

  describe('synthesizeStream() - Error Handling', () => {
    it('should call onError on server error', async () => {
      await connectClient();

      // Add error event listener to prevent unhandled error
      const errorEventSpy = jest.fn();
      client.on('error', errorEventSpy);

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({
        type: 'error',
        data: { code: 400, message: 'Bad request' },
        requestId: 'stream-1',
      })));

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Stream failed: Bad request'),
      }));
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should call onError on timeout', async () => {
      jest.useFakeTimers();

      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
        timeout: 5000,
      });

      // Fast-forward past timeout
      jest.advanceTimersByTime(5000);

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Stream synthesis timeout after 5000ms',
      }));

      jest.useRealTimers();
    });

    it('should call onError if onChunk callback throws', async () => {
      await connectClient();

      const onChunk = jest.fn(() => {
        throw new Error('Chunk processing failed');
      });
      const onComplete = jest.fn();
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const chunk = Buffer.from('test');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk.toString('base64') },
        requestId: 'stream-1',
      })));

      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Chunk processing failed',
      }));
    });

    it('should call onError if onComplete callback throws', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn(() => {
        throw new Error('Complete processing failed');
      });
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const finalChunk = Buffer.from('final');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: finalChunk.toString('base64') },
        requestId: 'stream-1',
      })));

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Complete processing failed',
      }));
    });

    it('should call onError on disconnect', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      // Disconnect before stream completes
      client.disconnect();

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Disconnected before stream completed',
      }));
    });
  });

  describe('cancelStream()', () => {
    it('should cancel active stream', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const requestId = client.synthesizeStream({
        text: 'Test',
        onChunk,
        onComplete,
        onError,
      });

      const cancelled = client.cancelStream(requestId);

      expect(cancelled).toBe(true);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Stream cancelled by user',
      }));
    });

    it('should return false for non-existent stream', async () => {
      await connectClient();

      const cancelled = client.cancelStream('non-existent-id');

      expect(cancelled).toBe(false);
    });

    it('should not deliver chunks after cancellation', async () => {
      await connectClient();

      const onChunk = jest.fn();
      const onComplete = jest.fn();
      const onError = jest.fn();

      const requestId = client.synthesizeStream({
        text: 'Test',
        requestId: 'stream-1',
        onChunk,
        onComplete,
        onError,
      });

      client.cancelStream(requestId);

      // Try to send chunk after cancellation
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];
      const chunk = Buffer.from('test');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk.toString('base64') },
        requestId: 'stream-1',
      })));

      // onChunk should not be called
      expect(onChunk).not.toHaveBeenCalled();
    });
  });

  describe('Concurrent Streams', () => {
    it('should handle multiple concurrent streams', async () => {
      await connectClient();

      const stream1Chunks: Buffer[] = [];
      const stream2Chunks: Buffer[] = [];

      const stream1Complete = jest.fn();
      const stream2Complete = jest.fn();

      client.synthesizeStream({
        text: 'First',
        requestId: 'stream-1',
        onChunk: (chunk) => stream1Chunks.push(chunk),
        onComplete: stream1Complete,
        onError: jest.fn(),
      });

      client.synthesizeStream({
        text: 'Second',
        requestId: 'stream-2',
        onChunk: (chunk) => stream2Chunks.push(chunk),
        onComplete: stream2Complete,
        onError: jest.fn(),
      });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Interleave chunks from both streams
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: Buffer.from('A1').toString('base64') },
        requestId: 'stream-1',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: Buffer.from('B1').toString('base64') },
        requestId: 'stream-2',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('A2').toString('base64') },
        requestId: 'stream-1',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('B2').toString('base64') },
        requestId: 'stream-2',
      })));

      expect(stream1Chunks.length).toBe(1);
      expect(stream1Chunks[0].toString()).toBe('A1');
      expect(stream1Complete).toHaveBeenCalledWith(Buffer.from('A2'));

      expect(stream2Chunks.length).toBe(1);
      expect(stream2Chunks[0].toString()).toBe('B1');
      expect(stream2Complete).toHaveBeenCalledWith(Buffer.from('B2'));
    });
  });
});
