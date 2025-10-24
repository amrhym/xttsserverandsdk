/**
 * Unit tests for XTTSClient core functionality
 */

import { XTTSClient } from '../../src/XTTSClient';
import { XTTSClientConfig } from '../../src/types';

describe('XTTSClient - Core Structure', () => {
  describe('Constructor and Validation', () => {
    const validConfig: XTTSClientConfig = {
      apiKey: 'test-api-key',
      serverUrl: 'ws://localhost:8080',
      voice: 'emma',
    };

    it('should create instance with valid configuration', () => {
      const client = new XTTSClient(validConfig);
      expect(client).toBeInstanceOf(XTTSClient);
    });

    it('should throw error if apiKey is missing', () => {
      const invalidConfig = { ...validConfig, apiKey: '' };
      expect(() => new XTTSClient(invalidConfig)).toThrow(
        'apiKey is required and must be a non-empty string'
      );
    });

    it('should throw error if apiKey is not a string', () => {
      const invalidConfig = { ...validConfig, apiKey: 123 as any };
      expect(() => new XTTSClient(invalidConfig)).toThrow(
        'apiKey is required and must be a non-empty string'
      );
    });

    it('should use default serverUrl if not provided', () => {
      const config = { apiKey: 'test-api-key', voice: 'emma' };
      const client = new XTTSClient(config);
      expect(client.getConfig().serverUrl).toBe('wss://xttsws.xcai.io');
    });

    it('should throw error if serverUrl is empty string', () => {
      const invalidConfig = { ...validConfig, serverUrl: '' };
      expect(() => new XTTSClient(invalidConfig)).toThrow(
        'serverUrl must be a non-empty string if provided'
      );
    });

    it('should throw error if serverUrl does not start with ws:// or wss://', () => {
      const invalidConfig = { ...validConfig, serverUrl: 'http://localhost:8080' };
      expect(() => new XTTSClient(invalidConfig)).toThrow(
        'serverUrl must start with ws:// or wss://'
      );
    });

    it('should throw error if voice is missing', () => {
      const invalidConfig = { ...validConfig, voice: '' };
      expect(() => new XTTSClient(invalidConfig)).toThrow(
        'voice is required and must be a non-empty string'
      );
    });

    it('should accept wss:// URLs', () => {
      const config = { ...validConfig, serverUrl: 'wss://example.com' };
      const client = new XTTSClient(config);
      expect(client).toBeInstanceOf(XTTSClient);
    });

    it('should throw error if connectionTimeout is not positive', () => {
      const invalidConfig = { ...validConfig, connectionTimeout: -1000 };
      expect(() => new XTTSClient(invalidConfig)).toThrow(
        'connectionTimeout must be a positive number'
      );
    });

    it('should throw error if autoReconnect is not boolean', () => {
      const invalidConfig = { ...validConfig, autoReconnect: 'yes' as any };
      expect(() => new XTTSClient(invalidConfig)).toThrow(
        'autoReconnect must be a boolean'
      );
    });

    it('should accept valid optional parameters', () => {
      const config = {
        ...validConfig,
        connectionTimeout: 5000,
        autoReconnect: true,
      };
      const client = new XTTSClient(config);
      expect(client).toBeInstanceOf(XTTSClient);
    });
  });

  describe('Configuration Management', () => {
    const config: XTTSClientConfig = {
      apiKey: 'test-api-key',
      serverUrl: 'ws://localhost:8080',
      voice: 'emma',
    };

    it('should return configuration with getConfig()', () => {
      const client = new XTTSClient(config);
      const retrievedConfig = client.getConfig();

      expect(retrievedConfig.apiKey).toBe('test-api-key');
      expect(retrievedConfig.serverUrl).toBe('ws://localhost:8080');
      expect(retrievedConfig.voice).toBe('emma');
    });

    it('should return default values for optional parameters', () => {
      const client = new XTTSClient(config);
      const retrievedConfig = client.getConfig();

      expect(retrievedConfig.connectionTimeout).toBe(10000);
      expect(retrievedConfig.autoReconnect).toBe(false);
    });

    it('should return frozen configuration object (immutable)', () => {
      const client = new XTTSClient(config);
      const retrievedConfig = client.getConfig();

      expect(Object.isFrozen(retrievedConfig)).toBe(true);
    });

    it('should preserve custom optional parameters', () => {
      const configWithOptions = {
        ...config,
        connectionTimeout: 5000,
        autoReconnect: true,
      };
      const client = new XTTSClient(configWithOptions);
      const retrievedConfig = client.getConfig();

      expect(retrievedConfig.connectionTimeout).toBe(5000);
      expect(retrievedConfig.autoReconnect).toBe(true);
    });
  });

  describe('Connection State', () => {
    const config: XTTSClientConfig = {
      apiKey: 'test-api-key',
      serverUrl: 'ws://localhost:8080',
      voice: 'emma',
    };

    it('should start in disconnected state', () => {
      const client = new XTTSClient(config);
      expect(client.isConnected()).toBe(false);
    });

    it('should return false for isConnected() when not connected', () => {
      const client = new XTTSClient(config);
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('EventEmitter Functionality', () => {
    const config: XTTSClientConfig = {
      apiKey: 'test-api-key',
      serverUrl: 'ws://localhost:8080',
      voice: 'emma',
    };

    it('should support on() for event registration', () => {
      const client = new XTTSClient(config);
      const handler = jest.fn();

      client.on('connected', handler);
      client.emit('connected');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support once() for one-time event registration', () => {
      const client = new XTTSClient(config);
      const handler = jest.fn();

      client.once('connected', handler);
      client.emit('connected');
      client.emit('connected');

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support off() for event deregistration', () => {
      const client = new XTTSClient(config);
      const handler = jest.fn();

      client.on('connected', handler);
      client.off('connected', handler);
      client.emit('connected');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should emit disconnected event with code and reason', () => {
      const client = new XTTSClient(config);
      const handler = jest.fn();

      client.on('disconnected', handler);
      client.emit('disconnected', 1000, 'Normal closure');

      expect(handler).toHaveBeenCalledWith(1000, 'Normal closure');
    });

    it('should emit audioChunk event with audio data', () => {
      const client = new XTTSClient(config);
      const handler = jest.fn();
      const audioChunk = { audio: Buffer.from('test'), requestId: 'req-123' };

      client.on('audioChunk', handler);
      client.emit('audioChunk', audioChunk);

      expect(handler).toHaveBeenCalledWith(audioChunk);
    });

    it('should emit complete event with completion data', () => {
      const client = new XTTSClient(config);
      const handler = jest.fn();
      const completionData = { audio: Buffer.from('final'), requestId: 'req-123' };

      client.on('complete', handler);
      client.emit('complete', completionData);

      expect(handler).toHaveBeenCalledWith(completionData);
    });

    it('should emit error event with error data', () => {
      const client = new XTTSClient(config);
      const handler = jest.fn();
      const errorData = { code: 500, message: 'Server error', requestId: 'req-123' };

      client.on('error', handler);
      client.emit('error', errorData);

      expect(handler).toHaveBeenCalledWith(errorData);
    });

    it('should support multiple listeners for same event', () => {
      const client = new XTTSClient(config);
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      client.on('connected', handler1);
      client.on('connected', handler2);
      client.emit('connected');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Static Methods', () => {
    it('should return SDK version with getVersion()', () => {
      const version = XTTSClient.getVersion();
      expect(version).toBe('1.0.0');
    });

    it('should return version as string', () => {
      const version = XTTSClient.getVersion();
      expect(typeof version).toBe('string');
    });
  });
});
