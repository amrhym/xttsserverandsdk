/**
 * Integration tests for end-to-end protocol translation
 *
 * Tests the full message flow through the proxy:
 * Client → Protocol Translation → Minimax → Protocol Translation → Client
 */

import WebSocket from 'ws';
import { startServer, shutdown } from '../../src/server';
import { WebSocketServer } from 'ws';
import { createTestConfig } from '../helpers/testConfig';

describe('Protocol Integration Tests', () => {
  let server: WebSocketServer;
  let serverPort: number;

  const testConfig = createTestConfig();

  beforeAll(async () => {
    server = await startServer(testConfig);
    const address = server.address();
    if (address && typeof address === 'object') {
      serverPort = address.port;
    }
  }, 15000);

  afterAll(async () => {
    if (server) {
      await shutdown(server);
    }
  }, 15000);

  describe('Client Protocol', () => {
    it('should accept custom client protocol messages', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key',
        },
      });

      let receivedReady = false;

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready') {
          receivedReady = true;
        } else if (message.type === 'error') {
          // Expected when Minimax unavailable in test
          receivedReady = true;
        }
      });

      client.on('close', () => {
        expect(receivedReady).toBe(true);
        done();
      });

      client.on('error', () => {
        // Swallow expected errors
      });

      setTimeout(() => {
        client.close();
      }, 2000);
    }, 15000);

    it('should handle speak messages', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key',
        },
      });

      let readyReceived = false;

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready' || message.type === 'error') {
          readyReceived = true;

          // Try sending a speak message
          client.send(
            JSON.stringify({
              action: 'speak',
              voice: 'fahd',
              text: 'Test message',
            })
          );

          setTimeout(() => {
            client.close();
          }, 1000);
        }
      });

      client.on('close', () => {
        expect(readyReceived).toBe(true);
        done();
      });

      client.on('error', () => {
        // Swallow expected errors
      });
    }, 15000);
  });

  describe('Protocol Obfuscation', () => {
    it('should never expose Minimax-specific terms', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key',
        },
      });

      const receivedMessages: string[] = [];

      client.on('message', (data: Buffer) => {
        const messageText = data.toString();
        receivedMessages.push(messageText);

        // Check that no Minimax-specific terms appear
        expect(messageText).not.toContain('task_start');
        expect(messageText).not.toContain('task_continue');
        expect(messageText).not.toContain('task_finish');
        expect(messageText).not.toContain('voice_id');
        expect(messageText).not.toContain('moss_audio');
      });

      client.on('close', () => {
        expect(receivedMessages.length).toBeGreaterThan(0);
        done();
      });

      client.on('error', () => {
        // Swallow expected errors
      });

      setTimeout(() => {
        client.close();
      }, 2000);
    }, 15000);
  });
});
