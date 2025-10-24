/**
 * Unit tests for XTTSClient synthesizeToFile() method
 */

import { XTTSClient } from '../../src/XTTSClient';
import { XTTSClientConfig } from '../../src/types';
import WebSocket from 'ws';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock WebSocket
jest.mock('ws');

describe('XTTSClient - File Synthesis', () => {
  let mockWebSocket: any;
  let client: XTTSClient;
  let tempDir: string;

  const validConfig: XTTSClientConfig = {
    apiKey: 'test-api-key',
    voice: 'emma',
    serverUrl: 'ws://localhost:8080',
  };

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'xtts-test-'));

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

  afterEach(async () => {
    jest.clearAllMocks();
    jest.clearAllTimers();

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 5000); // 5 second timeout for cleanup

  // Helper to establish connection
  async function connectClient() {
    const connectPromise = client.connect();

    const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
    openHandler();

    const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
    messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

    await connectPromise;
  }

  describe('synthesizeToFile() - Basic Functionality', () => {
    it('should throw error if not connected', async () => {
      const filePath = path.join(tempDir, 'output.mp3');

      await expect(client.synthesizeToFile({
        text: 'Hello',
        filePath,
      })).rejects.toThrow('Not connected to server');
    });

    it('should throw error if text is empty', async () => {
      await connectClient();
      const filePath = path.join(tempDir, 'output.mp3');

      await expect(client.synthesizeToFile({
        text: '',
        filePath,
      })).rejects.toThrow('Text is required for synthesis');
    });

    it('should throw error if filePath is empty', async () => {
      await connectClient();

      await expect(client.synthesizeToFile({
        text: 'Hello',
        filePath: '',
      })).rejects.toThrow('filePath is required');
    });

    it('should send speak message to server', async () => {
      await connectClient();
      const filePath = path.join(tempDir, 'output.mp3');

      // Start file synthesis (will fail because we don't complete it, but that's OK for this test)
      client.synthesizeToFile({
        text: 'Hello file',
        filePath,
      }).catch(() => {
        // Ignore error - we're just testing message sending
      });

      // Wait for async file operations to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sendCalls = mockWebSocket.send.mock.calls;
      const lastCall = sendCalls[sendCalls.length - 1][0];
      const message = JSON.parse(lastCall);

      expect(message.action).toBe('speak');
      expect(message.voice).toBe('emma');
      expect(message.text).toBe('Hello file');
      expect(message.requestId).toBeDefined();
    });
  });

  describe('synthesizeToFile() - File Writing', () => {
    it('should write single chunk to file', async () => {
      await connectClient();
      const filePath = path.join(tempDir, 'output.mp3');

      const synthesizePromise = client.synthesizeToFile({
        text: 'Test',
        requestId: 'file-1',
        filePath,
      });

      // Wait for file to be opened
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const audioData = Buffer.from('test audio data');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: audioData.toString('base64') },
        requestId: 'file-1',
      })));

      const result = await synthesizePromise;

      expect(result.filePath).toBe(filePath);
      expect(result.bytesWritten).toBe(audioData.length);
      expect(result.chunksReceived).toBe(1);

      // Verify file contents
      const fileContents = await fs.readFile(filePath);
      expect(fileContents).toEqual(audioData);
    });

    it('should write multiple chunks to file', async () => {
      await connectClient();
      const filePath = path.join(tempDir, 'output.mp3');

      const synthesizePromise = client.synthesizeToFile({
        text: 'Long text',
        requestId: 'file-1',
        filePath,
      });

      // Wait for file to be opened
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      // Send multiple chunks
      const chunk1 = Buffer.from('chunk1');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk1.toString('base64') },
        requestId: 'file-1',
      })));

      const chunk2 = Buffer.from('chunk2');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk2.toString('base64') },
        requestId: 'file-1',
      })));

      const finalChunk = Buffer.from('final');
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: finalChunk.toString('base64') },
        requestId: 'file-1',
      })));

      const result = await synthesizePromise;

      expect(result.bytesWritten).toBe(chunk1.length + chunk2.length + finalChunk.length);
      expect(result.chunksReceived).toBe(3);

      // Verify file contains all chunks in order
      const fileContents = await fs.readFile(filePath);
      const expected = Buffer.concat([chunk1, chunk2, finalChunk]);
      expect(fileContents).toEqual(expected);
    });
  });

  describe('synthesizeToFile() - Progress Tracking', () => {
    it('should call onProgress for each chunk', async () => {
      await connectClient();
      const filePath = path.join(tempDir, 'output.mp3');

      const progressCalls: Array<[number, number]> = [];
      const onProgress = jest.fn((bytes, chunks) => {
        progressCalls.push([bytes, chunks]);
      });

      const synthesizePromise = client.synthesizeToFile({
        text: 'Progress test',
        requestId: 'file-1',
        filePath,
        onProgress,
      });

      // Wait for file to be opened
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      const chunk1 = Buffer.from('12345'); // 5 bytes
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk1.toString('base64') },
        requestId: 'file-1',
      })));

      const chunk2 = Buffer.from('67890'); // 5 bytes
      messageHandler(Buffer.from(JSON.stringify({
        type: 'audio',
        data: { audio: chunk2.toString('base64') },
        requestId: 'file-1',
      })));

      const finalChunk = Buffer.from('END'); // 3 bytes
      messageHandler(Buffer.from(JSON.stringify({
        type: 'complete',
        data: { audio: finalChunk.toString('base64') },
        requestId: 'file-1',
      })));

      await synthesizePromise;

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(progressCalls).toEqual([
        [5, 1],
        [10, 2],
        [13, 3],
      ]);
    });
  });

  describe('synthesizeToFile() - Error Handling', () => {
    it('should reject on server error', async () => {
      await connectClient();

      // Add error event listener
      const errorEventSpy = jest.fn();
      client.on('error', errorEventSpy);

      const filePath = path.join(tempDir, 'output.mp3');

      const synthesizePromise = client.synthesizeToFile({
        text: 'Error test',
        requestId: 'file-1',
        filePath,
      });

      // Wait for file to be opened
      await new Promise((resolve) => setTimeout(resolve, 10));

      const messageHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'message')[1];

      messageHandler(Buffer.from(JSON.stringify({
        type: 'error',
        data: { code: 400, message: 'Bad request' },
        requestId: 'file-1',
      })));

      await expect(synthesizePromise).rejects.toThrow('File synthesis failed: Bad request');

      // File should not exist or should be empty/incomplete
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (fileExists) {
        const stats = await fs.stat(filePath);
        // File might exist but should be closed
        expect(stats).toBeDefined();
      }
    });

    it('should reject on timeout', async () => {
      await connectClient();
      const filePath = path.join(tempDir, 'output.mp3');

      // Use a very short real timeout
      const synthesizePromise = client.synthesizeToFile({
        text: 'Timeout test',
        filePath,
        timeout: 50, // Very short timeout for testing
      });

      // Wait for file to be opened
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Don't send any response - let it timeout
      await expect(synthesizePromise).rejects.toThrow('File synthesis timeout after 50ms');
    });

    it('should reject on disconnect', async () => {
      await connectClient();
      const filePath = path.join(tempDir, 'output.mp3');

      const synthesizePromise = client.synthesizeToFile({
        text: 'Disconnect test',
        filePath,
      });

      // Give enough time for file to be opened and message to be sent
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Disconnect before completion
      client.disconnect();

      await expect(synthesizePromise).rejects.toThrow('Disconnected before file synthesis completed');
    });
  });
});
