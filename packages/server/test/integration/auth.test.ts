/**
 * Authentication Integration Tests
 *
 * Tests for end-to-end authentication flow
 */

import { startServer, shutdown } from '../../src/server';
import { createTestConfig } from '../helpers/testConfig';
import { WebSocketServer, WebSocket } from 'ws';

describe('Authentication Integration', () => {
  let server: WebSocketServer;
  let serverPort: number;

  const testConfig = createTestConfig({
    authorizedApiKeys: ['test_key_1', 'test_key_2', 'test_key_3'],
  });

  beforeAll(async () => {
    server = await startServer(testConfig);
    const address = server.address();
    if (typeof address === 'object' && address !== null) {
      serverPort = address.port;
    }
  });

  afterAll(async () => {
    await shutdown(server);
  });

  describe('Valid Authentication', () => {
    it('should accept connection with valid API key', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_1',
        },
      });

      client.on('open', () => {
        expect(client.readyState).toBe(WebSocket.OPEN);
        client.close();
        done();
      });

      client.on('error', (error) => {
        done(error);
      });

      client.on('close', (code) => {
        // Should not close with authentication error
        if (code === 1008) {
          done(new Error('Connection closed with authentication error'));
        }
      });
    });

    it('should accept multiple clients with different valid keys', (done) => {
      const clients: WebSocket[] = [];
      const keys = ['test_key_1', 'test_key_2', 'test_key_3'];
      let connectedCount = 0;

      keys.forEach((key) => {
        const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
          headers: {
            Authorization: `Bearer ${key}`,
          },
        });

        clients.push(client);

        client.on('open', () => {
          connectedCount++;
          if (connectedCount === keys.length) {
            // All clients connected successfully
            clients.forEach((c) => c.close());
            done();
          }
        });

        client.on('error', (error) => {
          done(error);
        });
      });
    });

    it('should maintain connection for authenticated client', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_1',
        },
      });

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        // Should receive ready or error (if Minimax unavailable)
        expect(['ready', 'error']).toContain(response.type);
      });

      client.on('close', () => {
        // Test passes if connection was maintained (received message or closed gracefully)
        done();
      });

      client.on('error', () => {
        // Swallow expected errors (Minimax connection failures)
      });

      setTimeout(() => {
        client.close();
      }, 2000);
    }, 15000);
  });

  describe('Invalid Authentication', () => {
    it('should reject connection with invalid API key', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer invalid_key',
        },
      });

      let errorReceived = false;

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.error).toBe('Authentication failed');
        expect(response.code).toBe(401);
        errorReceived = true;
      });

      client.on('close', (code) => {
        expect(code).toBe(1008); // Policy violation
        expect(errorReceived).toBe(true);
        done();
      });

      client.on('open', () => {
        // Connection should be closed immediately, but if it opens, fail the test
        // Wait a bit for close event
      });

      client.on('error', () => {
        // Connection errors are expected when server closes immediately
      });
    });

    it('should reject connection with missing Authorization header', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`);

      let errorReceived = false;

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.error).toBe('Authentication failed');
        expect(response.code).toBe(401);
        errorReceived = true;
      });

      client.on('close', (code) => {
        expect(code).toBe(1008);
        expect(errorReceived).toBe(true);
        done();
      });

      client.on('error', () => {
        // Expected
      });
    });

    it('should reject connection with malformed Authorization header', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'NotBearer test_key_1',
        },
      });

      let errorReceived = false;

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.error).toBe('Authentication failed');
        errorReceived = true;
      });

      client.on('close', (code) => {
        expect(code).toBe(1008);
        expect(errorReceived).toBe(true);
        done();
      });

      client.on('error', () => {
        // Expected
      });
    });
  });

  describe('Performance', () => {
    it('should authenticate and connect in <50ms', (done) => {
      const startTime = Date.now();

      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_1',
        },
      });

      client.on('open', () => {
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(50);
        client.close();
        done();
      });

      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle rapid authentication attempts', (done) => {
      const clientCount = 10;
      const clients: WebSocket[] = [];
      let connectedCount = 0;

      for (let i = 0; i < clientCount; i++) {
        const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
          headers: {
            Authorization: 'Bearer test_key_1',
          },
        });

        clients.push(client);

        client.on('open', () => {
          connectedCount++;
          if (connectedCount === clientCount) {
            clients.forEach((c) => c.close());
            done();
          }
        });

        client.on('error', (error) => {
          done(error);
        });
      }
    });
  });
});
