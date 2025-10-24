/**
 * MinimaxClient Unit Tests
 *
 * Tests for Minimax WebSocket connection management
 */

import { MinimaxClient } from '../../../src/minimax/MinimaxClient';
import WebSocket from 'ws';

// Mock the ws library
jest.mock('ws');

describe('MinimaxClient', () => {
  const mockConfig = {
    apiKey: 'test_minimax_key',
    groupId: 'test_group_id',
  };
  const clientId = 'test_client_123';

  let client: MinimaxClient;
  let mockWs: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock WebSocket instance
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    };

    // Mock WebSocket constructor
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

    client = new MinimaxClient(mockConfig, clientId);
  });

  describe('Constructor', () => {
    it('should create MinimaxClient instance', () => {
      expect(client).toBeInstanceOf(MinimaxClient);
    });

    it('should not be connected initially', () => {
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should connect with correct URL and headers', async () => {
      // Simulate successful connection
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'open') {
          handler();
        } else if (event === 'message') {
          // Simulate connected_success message
          setTimeout(() => {
            const message = JSON.stringify({ event: 'connected_success' });
            handler(Buffer.from(message));
          }, 10);
        }
      });

      await client.connect();

      // Verify WebSocket was created with correct parameters
      expect(WebSocket).toHaveBeenCalledWith(
        `wss://api.minimax.io/ws/v1/t2a_v2?GroupId=${mockConfig.groupId}`,
        {
          headers: {
            Authorization: `Bearer ${mockConfig.apiKey}`,
          },
        }
      );
    });

    it('should resolve when connected_success received', async () => {
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          setTimeout(() => {
            const message = JSON.stringify({ event: 'connected_success' });
            handler(Buffer.from(message));
          }, 10);
        }
      });

      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(true);
    });

    it('should reject on connection error', async () => {
      const testError = new Error('Connection failed');

      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler(testError), 10);
        }
      });

      await expect(client.connect()).rejects.toThrow('Connection failed');
    });

    it('should timeout after 10 seconds', async () => {
      mockWs.on.mockImplementation(() => {
        // Never emit connected_success
      });

      await expect(client.connect()).rejects.toThrow(
        'Minimax connection timeout after 10 seconds'
      );
    }, 15000);
  });

  describe('send', () => {
    beforeEach(async () => {
      // Connect first
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          setTimeout(() => {
            const message = JSON.stringify({ event: 'connected_success' });
            handler(Buffer.from(message));
          }, 10);
        }
      });
      await client.connect();
    });

    it('should send message when connected', () => {
      const testMessage = 'test message';
      client.send(testMessage);

      expect(mockWs.send).toHaveBeenCalledWith(testMessage);
    });

    it('should send buffer when connected', () => {
      const testBuffer = Buffer.from('test buffer');
      client.send(testBuffer);

      expect(mockWs.send).toHaveBeenCalledWith(testBuffer);
    });

    it('should throw error when not connected', () => {
      const disconnectedClient = new MinimaxClient(mockConfig, 'client2');

      expect(() => disconnectedClient.send('test')).toThrow('Not connected to Minimax');
    });
  });

  describe('Event Handlers', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          setTimeout(() => {
            const message = JSON.stringify({ event: 'connected_success' });
            handler(Buffer.from(message));
          }, 10);
        }
      });
      await client.connect();
    });

    it('should register message handler', () => {
      const handler = jest.fn();
      client.onMessage(handler);

      // Should register a message handler (wrapped, so check call count)
      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should register close handler', () => {
      const handler = jest.fn();
      client.onClose(handler);

      expect(mockWs.on).toHaveBeenCalledWith('close', handler);
    });

    it('should register error handler', () => {
      const handler = jest.fn();
      client.onError(handler);

      expect(mockWs.on).toHaveBeenCalledWith('error', handler);
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          setTimeout(() => {
            const message = JSON.stringify({ event: 'connected_success' });
            handler(Buffer.from(message));
          }, 10);
        }
      });
      await client.connect();
    });

    it('should close WebSocket connection', () => {
      client.close();

      expect(mockWs.close).toHaveBeenCalled();
      expect(client.isConnected()).toBe(false);
    });

    it('should handle close when already closed', () => {
      client.close();
      expect(() => client.close()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          setTimeout(() => {
            const message = JSON.stringify({ event: 'connected_success' });
            handler(Buffer.from(message));
          }, 10);
        }
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should return false after close', async () => {
      mockWs.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'message') {
          setTimeout(() => {
            const message = JSON.stringify({ event: 'connected_success' });
            handler(Buffer.from(message));
          }, 10);
        }
      });

      await client.connect();
      client.close();
      expect(client.isConnected()).toBe(false);
    });
  });
});
