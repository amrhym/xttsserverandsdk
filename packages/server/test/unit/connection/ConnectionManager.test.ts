/**
 * Unit tests for ConnectionManager
 *
 * Verifies connection limiting, queuing, and promotion logic
 */

import { ConnectionManager } from '../../../src/connection/ConnectionManager';
import { WebSocket } from 'ws';

// Mock WebSocket
const createMockWebSocket = (): WebSocket => {
  return {
    readyState: 1, // OPEN
    close: jest.fn(),
  } as any;
};

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager(2); // Small limit for testing
  });

  describe('Connection Limit Enforcement', () => {
    it('should accept connections under limit', () => {
      expect(manager.canAcceptConnection()).toBe(true);

      const ws = createMockWebSocket();
      const connected = manager.addConnection('client1', {
        socket: ws,
        authenticated: true,
        apiKey: 'test_key',
      });

      expect(connected).toBe(true);
      expect(manager.getStats().activeConnections).toBe(1);
    });

    it('should queue connections at limit', () => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Next should queue
      const connected = manager.addConnection('client3', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'test_key',
      });

      expect(connected).toBe(false);
      expect(manager.getStats().activeConnections).toBe(2);
      expect(manager.getStats().queuedConnections).toBe(1);
    });

    it('should track max connections correctly', () => {
      const stats = manager.getStats();
      expect(stats.maxConnections).toBe(2);
    });
  });

  describe('Queue Management', () => {
    it('should add connections to queue in FIFO order', () => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Queue 3 more
      manager.addConnection('client3', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key3',
      });
      manager.addConnection('client4', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key4',
      });
      manager.addConnection('client5', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key5',
      });

      expect(manager.getStats().queuedConnections).toBe(3);
      expect(manager.getQueuePosition('client3')).toBe(1);
      expect(manager.getQueuePosition('client4')).toBe(2);
      expect(manager.getQueuePosition('client5')).toBe(3);
    });

    it('should promote next in queue when connection removed', () => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Queue one
      manager.addConnection('client3', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key3',
      });

      // Remove client1
      const promoted = manager.removeConnection('client1');

      expect(promoted).not.toBeNull();
      expect(promoted?.clientId).toBe('client3');
      expect(manager.getStats().queuedConnections).toBe(0);
    });

    it('should return null when removing connection with empty queue', () => {
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });

      const promoted = manager.removeConnection('client1');

      expect(promoted).toBeNull();
      expect(manager.getStats().activeConnections).toBe(0);
    });

    it('should check if client is queued', () => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Queue client3
      manager.addConnection('client3', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key3',
      });

      expect(manager.isQueued('client3')).toBe(true);
      expect(manager.isQueued('client1')).toBe(false);
      expect(manager.isQueued('client4')).toBe(false);
    });
  });

  describe('Connection Retrieval', () => {
    it('should retrieve active connection info', () => {
      const ws = createMockWebSocket();
      manager.addConnection('client1', {
        socket: ws,
        authenticated: true,
        apiKey: 'test_key',
      });

      const connInfo = manager.getConnection('client1');

      expect(connInfo).toBeDefined();
      expect(connInfo?.socket).toBe(ws);
      expect(connInfo?.apiKey).toBe('test_key');
    });

    it('should return undefined for non-existent connection', () => {
      const connInfo = manager.getConnection('nonexistent');
      expect(connInfo).toBeUndefined();
    });

    it('should check if connection exists', () => {
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });

      expect(manager.hasConnection('client1')).toBe(true);
      expect(manager.hasConnection('client2')).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track active connection count', () => {
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      const stats = manager.getStats();

      expect(stats.activeConnections).toBe(2);
      expect(stats.queuedConnections).toBe(0);
    });

    it('should track queue count', () => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Queue 2 more
      manager.addConnection('client3', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key3',
      });
      manager.addConnection('client4', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key4',
      });

      const stats = manager.getStats();

      expect(stats.activeConnections).toBe(2);
      expect(stats.queuedConnections).toBe(2);
    });

    it('should calculate average queue wait time', (done) => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Queue client3
      manager.addConnection('client3', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key3',
      });

      // Wait a bit then promote
      setTimeout(() => {
        manager.removeConnection('client1');

        const stats = manager.getStats();
        expect(stats.averageQueueTimeMs).toBeGreaterThan(0);
        done();
      }, 50);
    });
  });

  describe('Client ID Lists', () => {
    it('should return active client IDs', () => {
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      const activeIds = manager.getActiveClientIds();

      expect(activeIds).toEqual(expect.arrayContaining(['client1', 'client2']));
      expect(activeIds.length).toBe(2);
    });

    it('should return queued client IDs', () => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Queue 2 more
      manager.addConnection('client3', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key3',
      });
      manager.addConnection('client4', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'key4',
      });

      const queuedIds = manager.getQueuedClientIds();

      expect(queuedIds).toEqual(['client3', 'client4']);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close all active connections', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      manager.addConnection('client1', { socket: ws1, authenticated: true });
      manager.addConnection('client2', { socket: ws2, authenticated: true });

      await manager.shutdown();

      expect(ws1.close).toHaveBeenCalledWith(1001, 'Server shutting down');
      expect(ws2.close).toHaveBeenCalledWith(1001, 'Server shutting down');
      expect(manager.getStats().activeConnections).toBe(0);
    });

    it('should close all queued connections', async () => {
      // Fill to limit
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      // Queue one
      const ws3 = createMockWebSocket();
      manager.addConnection('client3', {
        socket: ws3,
        authenticated: true,
        apiKey: 'key3',
      });

      await manager.shutdown();

      expect(ws3.close).toHaveBeenCalledWith(1001, 'Server shutting down');
      expect(manager.getStats().queuedConnections).toBe(0);
    });

    it('should clear all data structures', async () => {
      manager.addConnection('client1', { socket: createMockWebSocket(), authenticated: true });
      manager.addConnection('client2', { socket: createMockWebSocket(), authenticated: true });

      await manager.shutdown();

      const stats = manager.getStats();
      expect(stats.activeConnections).toBe(0);
      expect(stats.queuedConnections).toBe(0);
      expect(manager.getActiveClientIds()).toEqual([]);
      expect(manager.getQueuedClientIds()).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle removing non-existent connection', () => {
      const promoted = manager.removeConnection('nonexistent');
      expect(promoted).toBeNull();
    });

    it('should handle zero max connections', () => {
      const zeroManager = new ConnectionManager(0);
      expect(zeroManager.canAcceptConnection()).toBe(false);

      const connected = zeroManager.addConnection('client1', {
        socket: createMockWebSocket(),
        authenticated: true,
        apiKey: 'test_key',
      });

      expect(connected).toBe(false);
      expect(zeroManager.getStats().queuedConnections).toBe(1);
    });

    it('should handle large max connections', () => {
      const largeManager = new ConnectionManager(10000);
      expect(largeManager.getStats().maxConnections).toBe(10000);
    });
  });
});
