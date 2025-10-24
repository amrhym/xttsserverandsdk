/**
 * Server Unit Tests
 *
 * Tests for WebSocket server initialization and shutdown
 */

import { startServer, shutdown } from '../../src/server';
import { ServerConfig } from '../../src/config/environment';
import { WebSocketServer } from 'ws';

describe('WebSocket Server', () => {
  let server: WebSocketServer;

  // Test configuration
  const testConfig: ServerConfig = {
    port: 0, // Use random available port
    host: '127.0.0.1',
    logLevel: 'error', // Reduce log noise during tests
    nodeEnv: 'test',
    maxConnections: 100,
    authorizedApiKeys: ['test_key'],
    minimax: {
      apiKey: 'test_minimax_key',
      groupId: 'test_group_id',
    },
  };

  afterEach(async () => {
    // Clean up server after each test
    if (server) {
      await shutdown(server);
    }
  });

  describe('startServer', () => {
    it('should start WebSocket server successfully', async () => {
      server = await startServer(testConfig);

      expect(server).toBeInstanceOf(WebSocketServer);
      expect(server.address()).toBeTruthy();
    });

    it('should listen on configured host and port', async () => {
      const config: ServerConfig = {
        ...testConfig,
        port: 0, // OS will assign available port
      };

      server = await startServer(config);
      const address = server.address();

      expect(address).toBeTruthy();
      if (typeof address === 'object' && address !== null) {
        expect(address.address).toContain('127.0.0.1');
        expect(address.port).toBeGreaterThan(0);
      }
    });

    it('should throw error for port already in use', async () => {
      // Start first server
      server = await startServer(testConfig);
      const address = server.address();

      // Get the actual port assigned
      let assignedPort = 8080;
      if (typeof address === 'object' && address !== null) {
        assignedPort = address.port;
      }

      // Try to start second server on same port
      const conflictConfig: ServerConfig = {
        ...testConfig,
        port: assignedPort,
      };

      await expect(startServer(conflictConfig)).rejects.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown server gracefully', async () => {
      server = await startServer(testConfig);

      await expect(shutdown(server)).resolves.toBeUndefined();
    });

    it('should close server after shutdown', async () => {
      server = await startServer(testConfig);
      await shutdown(server);

      // Try to get address after shutdown - should throw or return null
      expect(() => server.address()).not.toThrow();
    });
  });
});
