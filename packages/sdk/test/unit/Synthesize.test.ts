/**
 * Unit tests for XTTSClient synthesize() method
 */

import { XTTSClient } from '../../src/XTTSClient';
import { XTTSClientConfig } from '../../src/types';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('XTTSClient - Synthesize Method', () => {
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

  describe('synthesize() - Basic Functionality', () => {
    it('should throw error if not connected', async () => {
      await expect(client.synthesize({ text: 'Hello' })).rejects.toThrow(
        'Not connected to server. Call connect() first.'
      );
    });

    it('should throw error if text is empty', async () => {
      await connectClient();

      await expect(client.synthesize({ text: '' })).rejects.toThrow(
        'Text is required for synthesis'
      );
    });

    it('should throw error if text is whitespace only', async () => {
      await connectClient();

      await expect(client.synthesize({ text: '   ' })).rejects.toThrow(
        'Text is required for synthesis'
      );
    });

    it('should send speak message to server', async () => {
      await connectClient();

      const synthesizePromise = client.synthesize({ text: 'Hello, world!' });

      // Get the last send call (after connect message)
      const sendCalls = mockWebSocket.send.mock.calls;
      const lastCall = sendCalls[sendCalls.length - 1][0];
      const message = JSON.parse(lastCall);

      expect(message.action).toBe('speak');
      expect(message.voice).toBe('emma');
      expect(message.text).toBe('Hello, world!');
      expect(message.requestId).toBeDefined();

      // Complete the synthesis
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];
      const audioData = Buffer.from('test audio').toString('base64');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audioData },
        requestId: message.requestId,
      })));

      await synthesizePromise;
    });

    it('should use provided request ID', async () => {
      await connectClient();

      const customRequestId = 'my-custom-id-123';
      const synthesizePromise = client.synthesize({
        text: 'Hello',
        requestId: customRequestId,
      });

      const sendCalls = mockWebSocket.send.mock.calls;
      const lastCall = sendCalls[sendCalls.length - 1][0];
      const message = JSON.parse(lastCall);

      expect(message.requestId).toBe(customRequestId);

      // Complete the synthesis
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];
      const audioData = Buffer.from('test audio').toString('base64');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audioData },
        requestId: customRequestId,
      })));

      await synthesizePromise;
    });

    it('should generate unique request IDs automatically', async () => {
      await connectClient();

      const promise1 = client.synthesize({ text: 'First' });
      const promise2 = client.synthesize({ text: 'Second' });

      const sendCalls = mockWebSocket.send.mock.calls;
      const message1 = JSON.parse(sendCalls[sendCalls.length - 2][0]);
      const message2 = JSON.parse(sendCalls[sendCalls.length - 1][0]);

      expect(message1.requestId).toBeDefined();
      expect(message2.requestId).toBeDefined();
      expect(message1.requestId).not.toBe(message2.requestId);

      // Complete both syntheses
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const audio1 = Buffer.from('audio 1').toString('base64');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audio1 },
        requestId: message1.requestId,
      })));

      const audio2 = Buffer.from('audio 2').toString('base64');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audio2 },
        requestId: message2.requestId,
      })));

      await Promise.all([promise1, promise2]);
    });
  });

  describe('synthesize() - Audio Collection', () => {
    it('should collect single audio chunk', async () => {
      await connectClient();

      const synthesizePromise = client.synthesize({ text: 'Hello' });

      const sendCalls = mockWebSocket.send.mock.calls;
      const message = JSON.parse(sendCalls[sendCalls.length - 1][0]);
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const audioData = Buffer.from('test audio');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audioData.toString('base64') },
        requestId: message.requestId,
      })));

      const result = await synthesizePromise;

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('test audio');
    });

    it('should concatenate multiple audio chunks', async () => {
      await connectClient();

      const synthesizePromise = client.synthesize({ text: 'Long text' });

      const sendCalls = mockWebSocket.send.mock.calls;
      const message = JSON.parse(sendCalls[sendCalls.length - 1][0]);
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Send multiple audio chunks
      const chunk1 = Buffer.from('audio ');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk1.toString('base64') },
        requestId: message.requestId,
      })));

      const chunk2 = Buffer.from('chunk ');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk2.toString('base64') },
        requestId: message.requestId,
      })));

      const chunk3 = Buffer.from('final');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: chunk3.toString('base64') },
        requestId: message.requestId,
      })));

      const result = await synthesizePromise;

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('audio chunk final');
    });

    it('should handle binary audio data correctly', async () => {
      await connectClient();

      const synthesizePromise = client.synthesize({ text: 'Binary test' });

      const sendCalls = mockWebSocket.send.mock.calls;
      const message = JSON.parse(sendCalls[sendCalls.length - 1][0]);
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Create binary audio data
      const binaryData = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0xFF, 0xAA]);
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: binaryData.toString('base64') },
        requestId: message.requestId,
      })));

      const result = await synthesizePromise;

      expect(result).toEqual(binaryData);
    });
  });

  describe('synthesize() - Error Handling', () => {
    it('should reject on server error response', async () => {
      await connectClient();

      // Add error listener to prevent unhandled error
      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      const synthesizePromise = client.synthesize({ text: 'Error test' });

      const sendCalls = mockWebSocket.send.mock.calls;
      const message = JSON.parse(sendCalls[sendCalls.length - 1][0]);
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({
        type: 'error',
        data: { code: 400, message: 'Invalid text' },
        requestId: message.requestId,
      })));

      await expect(synthesizePromise).rejects.toThrow(
        'Synthesis failed: Invalid text (code: 400)'
      );
    });

    it('should reject on synthesis timeout', async () => {
      jest.useFakeTimers();

      await connectClient();

      const synthesizePromise = client.synthesize({
        text: 'Timeout test',
        timeout: 5000,
      });

      // Fast-forward past timeout
      jest.advanceTimersByTime(5000);

      await expect(synthesizePromise).rejects.toThrow('Synthesis timeout after 5000ms');

      jest.useRealTimers();
    });

    it('should use default timeout of 30 seconds', async () => {
      jest.useFakeTimers();

      await connectClient();

      const synthesizePromise = client.synthesize({ text: 'Default timeout test' });

      // Advance to just before 30 seconds - should not timeout
      jest.advanceTimersByTime(29000);

      // Complete synthesis before timeout
      const sendCalls = mockWebSocket.send.mock.calls;
      const message = JSON.parse(sendCalls[sendCalls.length - 1][0]);
      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const audioData = Buffer.from('test audio').toString('base64');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audioData },
        requestId: message.requestId,
      })));

      await expect(synthesizePromise).resolves.toBeDefined();

      jest.useRealTimers();
    });

    it('should reject pending synthesis on disconnect', async () => {
      await connectClient();

      const synthesizePromise = client.synthesize({ text: 'Disconnect test' });

      // Disconnect before synthesis completes
      client.disconnect();

      await expect(synthesizePromise).rejects.toThrow(
        'Disconnected before synthesis completed'
      );
    });

    it('should handle WebSocket send errors', async () => {
      await connectClient();

      // Mock send to throw error
      mockWebSocket.send.mockImplementationOnce(() => {
        throw new Error('Send failed');
      });

      await expect(client.synthesize({ text: 'Send error test' })).rejects.toThrow('Send failed');
    });
  });

  describe('synthesize() - Concurrent Requests', () => {
    it('should handle multiple concurrent synthesis requests', async () => {
      await connectClient();

      const promise1 = client.synthesize({ text: 'First', requestId: 'req-1' });
      const promise2 = client.synthesize({ text: 'Second', requestId: 'req-2' });
      const promise3 = client.synthesize({ text: 'Third', requestId: 'req-3' });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Complete requests out of order
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('audio 2').toString('base64') },
        requestId: 'req-2',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('audio 3').toString('base64') },
        requestId: 'req-3',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('audio 1').toString('base64') },
        requestId: 'req-1',
      })));

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1.toString()).toBe('audio 1');
      expect(result2.toString()).toBe('audio 2');
      expect(result3.toString()).toBe('audio 3');
    });

    it('should not mix audio chunks from different requests', async () => {
      await connectClient();

      const promise1 = client.synthesize({ text: 'First', requestId: 'req-1' });
      const promise2 = client.synthesize({ text: 'Second', requestId: 'req-2' });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Interleave chunks from both requests
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: Buffer.from('A1').toString('base64') },
        requestId: 'req-1',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: Buffer.from('B1').toString('base64') },
        requestId: 'req-2',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: Buffer.from('A2').toString('base64') },
        requestId: 'req-1',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('A3').toString('base64') },
        requestId: 'req-1',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('B2').toString('base64') },
        requestId: 'req-2',
      })));

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.toString()).toBe('A1A2A3');
      expect(result2.toString()).toBe('B1B2');
    });
  });

  describe('synthesize() - Event Emission', () => {
    it('should emit audioChunk events during synthesis', async () => {
      await connectClient();

      const audioChunkSpy = jest.fn();
      client.on('audioChunk', audioChunkSpy);

      const synthesizePromise = client.synthesize({ text: 'Test', requestId: 'req-1' });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: Buffer.from('chunk1').toString('base64') },
        requestId: 'req-1',
      })));

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('final').toString('base64') },
        requestId: 'req-1',
      })));

      await synthesizePromise;

      expect(audioChunkSpy).toHaveBeenCalledTimes(1);
      expect(audioChunkSpy).toHaveBeenCalledWith({
        audio: Buffer.from('chunk1'),
        requestId: 'req-1',
      });
    });

    it('should emit complete event when synthesis finishes', async () => {
      await connectClient();

      const completeSpy = jest.fn();
      client.on('complete', completeSpy);

      const synthesizePromise = client.synthesize({ text: 'Test', requestId: 'req-1' });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: Buffer.from('final').toString('base64') },
        requestId: 'req-1',
      })));

      await synthesizePromise;

      expect(completeSpy).toHaveBeenCalledTimes(1);
      expect(completeSpy).toHaveBeenCalledWith({
        audio: Buffer.from('final'),
        requestId: 'req-1',
      });
    });

    it('should emit error event on synthesis failure', async () => {
      await connectClient();

      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      const synthesizePromise = client.synthesize({ text: 'Test', requestId: 'req-1' });

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({
        type: 'error',
        data: { code: 500, message: 'Server error' },
        requestId: 'req-1',
      })));

      await expect(synthesizePromise).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 500,
          message: 'Server error',
          requestId: 'req-1',
        })
      );
    });
  });
});
