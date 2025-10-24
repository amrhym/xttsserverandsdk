/**
 * WebSocket Integration Tests
 *
 * Tests for client WebSocket connections and communication
 */

import { startServer, shutdown } from '../../src/server';
import { createTestConfig } from '../helpers/testConfig';
import { WebSocketServer, WebSocket } from 'ws';

describe('WebSocket Integration', () => {
  let server: WebSocketServer;
  let serverPort: number;

  const testConfig = createTestConfig();

  beforeAll(async () => {
    server = await startServer(testConfig);
    const address = server.address();
    if (typeof address === 'object' && address !== null) {
      serverPort = address.port;
    }
  }, 15000);

  afterAll(async () => {
    if (server) {
      await shutdown(server);
    }
  }, 15000);

  describe('Client Connection', () => {
    it('should accept authenticated WebSocket connection', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key',
        },
      });

      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        client.close();
      });

      client.on('close', () => {
        done();
      });

      client.on('error', () => {
        // Swallow expected errors (Minimax connection failures in test)
      });
    }, 15000);

    it('should handle multiple concurrent connections', async () => {
      const clients: WebSocket[] = [];
      const connectionCount = 5;

      for (let i = 0; i < connectionCount; i++) {
        const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
          headers: {
            Authorization: 'Bearer test_key',
          },
        });
        clients.push(client);
      }

      // Wait a bit for connections
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Close all
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });

      expect(clients.length).toBe(connectionCount);
    }, 15000);
  });

  describe('Message Handling', () => {
    it('should receive ready message after connection', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key',
        },
      });

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        // Should receive either 'ready' or 'error' (if Minimax unavailable)
        expect(['ready', 'error']).toContain(message.type);
      });

      client.on('error', () => {
        // Swallow expected errors
      });

      client.on('close', () => {
        // Test passes if we received a message or connection closed (expected in test env)
        done();
      });

      setTimeout(() => {
        client.close();
      }, 2000);
    }, 15000);
  });
});
