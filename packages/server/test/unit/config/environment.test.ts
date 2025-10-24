/**
 * Environment Configuration Unit Tests
 *
 * Tests for environment variable loading and validation
 */

import { loadConfig } from '../../../src/config/environment';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load configuration with default values', () => {
      const config = loadConfig();

      expect(config.port).toBe(8080);
      expect(config.host).toBe('0.0.0.0');
      expect(config.logLevel).toBe('info');
      expect(config.maxConnections).toBe(100);
    });

    it('should load configuration from environment variables', () => {
      process.env.SERVER_PORT = '3000';
      process.env.SERVER_HOST = '127.0.0.1';
      process.env.LOG_LEVEL = 'debug';
      process.env.MAX_CONNECTIONS = '50';
      process.env.AUTHORIZED_API_KEYS = 'key1,key2,key3';

      const config = loadConfig();

      expect(config.port).toBe(3000);
      expect(config.host).toBe('127.0.0.1');
      expect(config.logLevel).toBe('debug');
      expect(config.maxConnections).toBe(50);
      expect(config.authorizedApiKeys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should parse comma-separated API keys', () => {
      process.env.AUTHORIZED_API_KEYS = 'key1, key2, key3';

      const config = loadConfig();

      expect(config.authorizedApiKeys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should throw error for invalid port', () => {
      process.env.SERVER_PORT = 'invalid';

      expect(() => loadConfig()).toThrow('Invalid SERVER_PORT environment variable');
    });

    it('should throw error for port out of range', () => {
      process.env.SERVER_PORT = '99999';

      expect(() => loadConfig()).toThrow('Invalid SERVER_PORT environment variable');
    });

    it('should throw error for invalid max connections', () => {
      process.env.MAX_CONNECTIONS = 'invalid';

      expect(() => loadConfig()).toThrow('Invalid MAX_CONNECTIONS environment variable');
    });

    it('should load Minimax credentials', () => {
      process.env.MINIMAX_API_KEY = 'test_api_key';
      process.env.MINIMAX_GROUP_ID = 'test_group_id';

      const config = loadConfig();

      expect(config.minimax.apiKey).toBe('test_api_key');
      expect(config.minimax.groupId).toBe('test_group_id');
    });

    it('should handle missing Minimax credentials', () => {
      delete process.env.MINIMAX_API_KEY;
      delete process.env.MINIMAX_GROUP_ID;

      const config = loadConfig();

      expect(config.minimax.apiKey).toBe('');
      expect(config.minimax.groupId).toBe('');
    });

    it('should handle empty API keys list', () => {
      delete process.env.AUTHORIZED_API_KEYS;

      const config = loadConfig();

      expect(config.authorizedApiKeys).toEqual([]);
    });
  });
});
