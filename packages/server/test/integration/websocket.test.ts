/**
 * WebSocket Integration Tests
 *
 * Tests for client WebSocket connections and communication
 */

import { startServer, shutdown } from '../../src/server';
import { ServerConfig } from '../../src/config/environment';
import { WebSocketServer, WebSocket } from 'ws';

describe('WebSocket Integration', () => {
  let server: WebSocketServer;
  let serverPort: number;

  const testConfig: ServerConfig = {
    port: 0, // Random port
    host: '127.0.0.1',
    logLevel: 'error',
    nodeEnv: 'test',
    maxConnections: 100,
    authorizedApiKeys: ['test_key'],
    minimax: {
      apiKey: 'test_minimax_key',
      groupId: 'test_group_id',
    },
  };

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

  describe('Client Connection', () => {
    it('should accept client WebSocket connection', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key',
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
    });

    it('should handle multiple concurrent connections', (done) => {
      const clients: WebSocket[] = [];
      const connectionCount = 5;
      let openedCount = 0;

      for (let i = 0; i < connectionCount; i++) {
        const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
          headers: {
            Authorization: 'Bearer test_key',
          },
        });
        clients.push(client);

        client.on('open', () => {
          openedCount++;
          if (openedCount === connectionCount) {
            // All clients connected
            expect(openedCount).toBe(connectionCount);

            // Close all clients
            clients.forEach((c) => c.close());
            done();
          }
        });

        client.on('error', (error) => {
          done(error);
        });
      }
    });

    it('should handle client disconnection gracefully', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key',
        },
      });

      client.on('open', () => {
        client.close();
      });

      client.on('close', () => {
        done();
      });

      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Message Handling', () => {
    it('should receive messages from client', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, { headers: { Authorization: "Bearer test_key" } });

      client.on('open', () => {
        client.send('Test message');
      });

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.status).toBe('received');
        client.close();
        done();
      });

      client.on('error', (error) => {
        done(error);
      });
    });

    it('should handle JSON messages', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, { headers: { Authorization: "Bearer test_key" } });

      client.on('open', () => {
        const message = { action: 'test', data: 'hello' };
        client.send(JSON.stringify(message));
      });

      client.on('message', (data) => {
        const response = JSON.parse(data.toString());
        expect(response.status).toBe('received');
        client.close();
        done();
      });

      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle client errors without crashing server', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, { headers: { Authorization: "Bearer test_key" } });

      client.on('open', () => {
        // Force close the connection from client side abruptly
        (client as any)._socket.destroy();

        // Give server time to handle the error
        setTimeout(() => {
          // Server should still be running
          const testClient = new WebSocket(`ws://127.0.0.1:${serverPort}`, { headers: { Authorization: "Bearer test_key" } });

          testClient.on('open', () => {
            testClient.close();
            done();
          });

          testClient.on('error', (error) => {
            done(error);
          });
        }, 100);
      });

      client.on('error', () => {
        // Expected error from forced close
      });
    });
  });

  describe('Connection Lifecycle', () => {
    it('should track active connections', (done) => {
      const clients: WebSocket[] = [];

      // Connect 3 clients
      for (let i = 0; i < 3; i++) {
        const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, { headers: { Authorization: "Bearer test_key" } });
        clients.push(client);
      }

      // Wait for all to connect
      let connectedCount = 0;
      clients.forEach((client) => {
        client.on('open', () => {
          connectedCount++;
          if (connectedCount === 3) {
            // All connected, now disconnect one
            clients[0].close();

            setTimeout(() => {
              // Close remaining clients
              clients[1].close();
              clients[2].close();
              done();
            }, 100);
          }
        });
      });
    });
  });
});
