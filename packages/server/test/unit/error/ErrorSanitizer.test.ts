/**
 * Unit tests for ErrorSanitizer
 *
 * Tests comprehensive error sanitization to ensure no Minimax
 * information leaks to clients
 */

import { ErrorSanitizer, MinimaxError } from '../../../src/error/ErrorSanitizer';

describe('ErrorSanitizer', () => {
  let sanitizer: ErrorSanitizer;

  beforeEach(() => {
    sanitizer = new ErrorSanitizer();
  });

  describe('Provider Name Sanitization', () => {
    it('should replace "minimax" with "TTS service"', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'Minimax API error occurred',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('Minimax');
      expect(result.message).not.toContain('minimax');
      expect(result.message).toContain('TTS API'); // "Minimax API" → "TTS API"
    });

    it('should replace "moss" with "TTS"', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'Moss service unavailable',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('Moss');
      expect(result.message).not.toContain('moss');
      expect(result.message).toContain('TTS');
    });

    it('should replace "moss_audio" with "voice"', () => {
      const error: MinimaxError = {
        code: 400,
        message: 'Invalid moss_audio identifier format',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('moss_audio');
      expect(result.message).toContain('voice');
    });

    it('should be case-insensitive for provider names', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'MINIMAX service error, Minimax API failed, minimax timeout',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toMatch(/minimax/i);
      expect(result.message).toContain('TTS service');
    });
  });

  describe('API Endpoint Sanitization', () => {
    it('should replace API domains', () => {
      const error: MinimaxError = {
        code: 503,
        message: 'Connection to api.minimax.io failed',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('api.minimax.io');
      expect(result.message).toContain('TTS API');
    });

    it('should sanitize WebSocket URLs', () => {
      const error: MinimaxError = {
        code: 503,
        message: 'Failed to connect to wss://api.minimax.io/ws/v1/t2a_v2',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('wss://api.minimax.io');
      expect(result.message).toContain('TTS API endpoint');
    });
  });

  describe('Technical Detail Sanitization', () => {
    it('should replace voice_id with generic term', () => {
      const error: MinimaxError = {
        code: 400,
        message: 'Invalid voice_id format provided',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('voice_id');
      expect(result.message).toContain('voice identifier');
    });

    it('should replace group_id with generic term', () => {
      const error: MinimaxError = {
        code: 401,
        message: 'Invalid group_id for authentication',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('group_id');
      expect(result.message).toContain('account identifier');
    });

    it('should replace task operations', () => {
      const error: MinimaxError = {
        code: 400,
        message: 'task_start operation failed',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('task_start');
      expect(result.message).toContain('TTS operation');
    });
  });

  describe('Sensitive Data Stripping', () => {
    it('should remove stack traces', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'Error occurred at MinimaxService.connect at /app/src/service.js:42',
        stack: 'Error: Connection failed\\n    at MinimaxService.connect',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('at MinimaxService');
      expect(result.message).not.toContain('/app/src/service.js');
    });

    it('should remove file paths', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'Error in /usr/local/minimax/service.ts line 123',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('/usr/local/minimax/service.ts');
    });

    it('should remove IP addresses', () => {
      const error: MinimaxError = {
        code: 503,
        message: 'Connection to 192.168.1.100 failed',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('192.168.1.100');
      expect(result.message).toContain('server');
    });

    it('should remove port numbers', () => {
      const error: MinimaxError = {
        code: 503,
        message: 'Service unavailable on port :8080',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain(':8080');
    });

    it('should remove JWT tokens', () => {
      const error: MinimaxError = {
        code: 401,
        message: 'Invalid token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('eyJ');
      expect(result.message).toContain('[REDACTED]');
    });

    it('should remove UUIDs', () => {
      const error: MinimaxError = {
        code: 400,
        message: 'Voice 35736e9c-7d11-11f0-bb73-1e2a4cfcd245 not found',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('35736e9c-7d11-11f0-bb73-1e2a4cfcd245');
      expect(result.message).toContain('[ID]');
    });
  });

  describe('Error Code Mapping', () => {
    it('should map authentication errors to 401', () => {
      const error: MinimaxError = { code: 1001, message: 'Auth failed' };
      expect(sanitizer.sanitizeError(error).code).toBe(401);
    });

    it('should map request errors to 400', () => {
      const error: MinimaxError = { code: 2001, message: 'Invalid request' };
      expect(sanitizer.sanitizeError(error).code).toBe(400);
    });

    it('should map rate limit errors to 429', () => {
      const error: MinimaxError = { code: 3001, message: 'Rate limit' };
      expect(sanitizer.sanitizeError(error).code).toBe(429);
    });

    it('should map service errors to 503', () => {
      const error: MinimaxError = { code: 4001, message: 'Service down' };
      expect(sanitizer.sanitizeError(error).code).toBe(503);
    });

    it('should default unknown codes to 500', () => {
      const error: MinimaxError = { code: 9999, message: 'Unknown error' };
      expect(sanitizer.sanitizeError(error).code).toBe(500);
    });

    it('should map text too long to 413', () => {
      const error: MinimaxError = { code: 2004, message: 'Text exceeds limit' };
      expect(sanitizer.sanitizeError(error).code).toBe(413);
    });
  });

  describe('Leak Validation', () => {
    it('should return generic error if leak detected', () => {
      // Simulate a case where sanitization somehow fails
      const error: MinimaxError = {
        code: 500,
        message: 'This should not contain minimax', // Will be sanitized but tested
      };

      const result = sanitizer.sanitizeError(error);

      // Ensure result doesn't contain 'minimax'
      expect(result.message.toLowerCase()).not.toContain('minimax');
    });

    it('should fallback to generic error if message becomes empty', () => {
      const error: MinimaxError = {
        code: 500,
        message: '',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).toBe('An error occurred');
    });
  });

  describe('Useful Information Preservation', () => {
    it('should preserve useful error details', () => {
      const error: MinimaxError = {
        code: 413,
        message: 'Text too long, maximum 5000 characters allowed',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).toContain('Text too long');
      expect(result.message).toContain('5000');
      expect(result.message).toContain('characters');
    });

    it('should preserve field validation errors', () => {
      const error: MinimaxError = {
        code: 400,
        message: 'Field "text" is required',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).toContain('text');
      expect(result.message).toContain('required');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null or undefined message', () => {
      const error: MinimaxError = {
        code: 500,
        message: null as any,
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).toBe('An error occurred');
      expect(result.code).toBe(500);
    });

    it('should handle very long error messages', () => {
      const longMessage = 'Error: ' + 'A'.repeat(10000) + ' minimax failed';

      const error: MinimaxError = {
        code: 500,
        message: longMessage,
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).toBeDefined();
      expect(result.message).not.toContain('minimax');
    });

    it('should handle Unicode characters', () => {
      const error: MinimaxError = {
        code: 400,
        message: 'Minimax error: 你好世界 🌍',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('Minimax');
      expect(result.message).toContain('你好世界');
      expect(result.message).toContain('🌍');
    });

    it('should handle multiple provider terms in one message', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'Minimax moss_audio service at api.minimax.io with voice_id failed',
      };

      const result = sanitizer.sanitizeError(error);

      expect(result.message).not.toContain('Minimax');
      expect(result.message).not.toContain('moss_audio');
      expect(result.message).not.toContain('api.minimax.io');
      expect(result.message).not.toContain('voice_id');
    });
  });

  describe('Helper Methods', () => {
    it('should sanitize exceptions', () => {
      const exception = new Error('Minimax connection failed');

      const result = sanitizer.sanitizeException(exception);

      expect(result.code).toBe(500);
      expect(result.message).not.toContain('Minimax');
      expect(result.message).toContain('TTS service');
    });

    it('should sanitize simple strings', () => {
      const result = sanitizer.sanitizeString('Minimax API error', 503);

      expect(result.code).toBe(503);
      expect(result.message).not.toContain('Minimax');
    });
  });

  describe('Performance', () => {
    it('should sanitize in <10ms', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'Minimax service error with moss_audio at api.minimax.io',
      };

      const start = performance.now();
      sanitizer.sanitizeError(error);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    it('should handle 100 sanitizations in <100ms', () => {
      const error: MinimaxError = {
        code: 500,
        message: 'Minimax error occurred',
      };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        sanitizer.sanitizeError(error);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });
});
