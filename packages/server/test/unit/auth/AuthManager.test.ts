/**
 * AuthManager Unit Tests
 *
 * Tests for API key authentication
 */

import { AuthManager } from '../../../src/auth/AuthManager';

describe('AuthManager', () => {
  const validKeys = ['valid_key_1', 'valid_key_2', 'valid_key_3'];
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager(validKeys);
  });

  describe('Constructor', () => {
    it('should initialize with authorized API keys', () => {
      expect(authManager.getKeyCount()).toBe(3);
    });

    it('should handle empty API keys list', () => {
      const emptyAuthManager = new AuthManager([]);
      expect(emptyAuthManager.getKeyCount()).toBe(0);
    });
  });

  describe('authenticate', () => {
    describe('Valid Authorization', () => {
      it('should authenticate with valid Bearer token', () => {
        const result = authManager.authenticate('Bearer valid_key_1');

        expect(result.authenticated).toBe(true);
        expect(result.apiKey).toBe('valid_key_1');
        expect(result.error).toBeUndefined();
      });

      it('should authenticate all valid API keys', () => {
        validKeys.forEach((key) => {
          const result = authManager.authenticate(`Bearer ${key}`);
          expect(result.authenticated).toBe(true);
          expect(result.apiKey).toBe(key);
        });
      });

      it('should handle Bearer token with extra whitespace', () => {
        const result = authManager.authenticate('  Bearer   valid_key_1  ');

        expect(result.authenticated).toBe(true);
        expect(result.apiKey).toBe('valid_key_1');
      });

      it('should complete authentication in <10ms', () => {
        const startTime = Date.now();
        authManager.authenticate('Bearer valid_key_1');
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(10);
      });
    });

    describe('Invalid Authorization', () => {
      it('should reject invalid API key', () => {
        const result = authManager.authenticate('Bearer invalid_key');

        expect(result.authenticated).toBe(false);
        expect(result.apiKey).toBeUndefined();
        expect(result.error).toBe('Invalid API key');
      });

      it('should reject missing Authorization header', () => {
        const result = authManager.authenticate(undefined);

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid or missing Authorization header');
      });

      it('should reject empty Authorization header', () => {
        const result = authManager.authenticate('');

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid or missing Authorization header');
      });

      it('should reject malformed Authorization header (no Bearer)', () => {
        const result = authManager.authenticate('valid_key_1');

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid or missing Authorization header');
      });

      it('should reject Authorization header with wrong scheme', () => {
        const result = authManager.authenticate('Basic valid_key_1');

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid or missing Authorization header');
      });

      it('should reject Authorization header with no token', () => {
        const result = authManager.authenticate('Bearer');

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid or missing Authorization header');
      });

      it('should reject Authorization header with multiple parts', () => {
        const result = authManager.authenticate('Bearer key extra');

        expect(result.authenticated).toBe(false);
        expect(result.error).toBe('Invalid or missing Authorization header');
      });
    });
  });

  describe('isValidKey', () => {
    it('should return true for valid API key', () => {
      expect(authManager.isValidKey('valid_key_1')).toBe(true);
      expect(authManager.isValidKey('valid_key_2')).toBe(true);
      expect(authManager.isValidKey('valid_key_3')).toBe(true);
    });

    it('should return false for invalid API key', () => {
      expect(authManager.isValidKey('invalid_key')).toBe(false);
      expect(authManager.isValidKey('')).toBe(false);
      expect(authManager.isValidKey('Bearer valid_key_1')).toBe(false);
    });
  });

  describe('getKeyCount', () => {
    it('should return correct count of authorized keys', () => {
      expect(authManager.getKeyCount()).toBe(3);
    });
  });

  describe('Performance', () => {
    it('should maintain O(1) lookup performance with many keys', () => {
      // Create auth manager with 1000 keys
      const manyKeys = Array.from({ length: 1000 }, (_, i) => `key_${i}`);
      const largeAuthManager = new AuthManager(manyKeys);

      // Test lookup at beginning
      const start1 = Date.now();
      largeAuthManager.authenticate('Bearer key_0');
      const duration1 = Date.now() - start1;

      // Test lookup at end
      const start2 = Date.now();
      largeAuthManager.authenticate('Bearer key_999');
      const duration2 = Date.now() - start2;

      // Both should be <10ms and similar duration (O(1) property)
      expect(duration1).toBeLessThan(10);
      expect(duration2).toBeLessThan(10);
      expect(Math.abs(duration1 - duration2)).toBeLessThan(5);
    });

    it('should handle rapid consecutive authentications', () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        authManager.authenticate('Bearer valid_key_1');
      }

      const totalDuration = Date.now() - startTime;
      const avgDuration = totalDuration / iterations;

      expect(avgDuration).toBeLessThan(10);
    });
  });
});
