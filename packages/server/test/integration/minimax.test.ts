/**
 * Minimax Integration Tests
 *
 * Tests real connection to Minimax API
 * Requires MINIMAX_API_KEY and MINIMAX_GROUP_ID environment variables
 */

import { MinimaxClient } from '../../src/minimax/MinimaxClient';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const hasMinimaxCredentials =
  process.env.MINIMAX_API_KEY && process.env.MINIMAX_GROUP_ID;

// Skip tests if Minimax credentials not available
const describeIfCredentials = hasMinimaxCredentials ? describe : describe.skip;

describeIfCredentials('Minimax API Integration', () => {
  const config = {
    apiKey: process.env.MINIMAX_API_KEY!,
    groupId: process.env.MINIMAX_GROUP_ID!,
  };

  describe('Connection', () => {
    it('should connect to Minimax successfully', async () => {
      const client = new MinimaxClient(config, 'test_client');

      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);

      client.close();
    }, 15000);

    it('should receive connected_success event', async () => {
      const client = new MinimaxClient(config, 'test_client_2');

      let connectedSuccessReceived = false;

      client.onMessage((data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.event === 'connected_success') {
            connectedSuccessReceived = true;
          }
        } catch (error) {
          // Ignore parse errors
        }
      });

      await client.connect();

      expect(connectedSuccessReceived).toBe(true);
      expect(client.isConnected()).toBe(true);

      client.close();
    }, 15000);

    it('should handle connection close gracefully', async () => {
      const client = new MinimaxClient(config, 'test_client_3');

      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.close();

      // Wait a bit for close to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(client.isConnected()).toBe(false);
    }, 15000);

    it('should maintain connection for at least 5 seconds', async () => {
      const client = new MinimaxClient(config, 'test_client_4');

      await client.connect();
      expect(client.isConnected()).toBe(true);

      // Wait 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));

      expect(client.isConnected()).toBe(true);

      client.close();
    }, 10000);
  });

  describe('Multiple Connections', () => {
    it('should support multiple concurrent connections', async () => {
      const clients: MinimaxClient[] = [];
      const connectionCount = 3;

      // Create and connect multiple clients
      for (let i = 0; i < connectionCount; i++) {
        const client = new MinimaxClient(config, `test_client_multi_${i}`);
        clients.push(client);
        await client.connect();
      }

      // Verify all connected
      expect(clients.every((c) => c.isConnected())).toBe(true);

      // Clean up
      clients.forEach((c) => c.close());
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should fail with invalid API key', async () => {
      const invalidConfig = {
        apiKey: 'invalid_api_key',
        groupId: config.groupId,
      };

      const client = new MinimaxClient(invalidConfig, 'test_client_invalid');

      await expect(client.connect()).rejects.toThrow();
    }, 15000);

    it('should fail with invalid group ID', async () => {
      const invalidConfig = {
        apiKey: config.apiKey,
        groupId: 'invalid_group_id',
      };

      const client = new MinimaxClient(invalidConfig, 'test_client_invalid_group');

      await expect(client.connect()).rejects.toThrow();
    }, 15000);
  });
});

// Log message if tests are skipped
if (!hasMinimaxCredentials) {
  console.log('\n⚠️  Skipping Minimax integration tests - credentials not configured');
  console.log(
    '   Set MINIMAX_API_KEY and MINIMAX_GROUP_ID environment variables to enable\n'
  );
}
