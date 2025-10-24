/**
 * Unit tests for ResponseSanitizer
 *
 * Verifies that no Minimax-specific information leaks through responses
 */

import { ResponseSanitizer, CUSTOM_HANDSHAKE_HEADERS } from '../../../src/response/ResponseSanitizer';
import { ClientResponse } from '../../../src/protocol/types';

describe('ResponseSanitizer', () => {
  let sanitizer: ResponseSanitizer;

  beforeEach(() => {
    sanitizer = new ResponseSanitizer();
  });

  describe('Clean Responses', () => {
    it('should pass through clean audio response unchanged', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: { chunk: 'base64audiodata...' },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });

    it('should pass through clean complete response unchanged', () => {
      const response: ClientResponse = {
        type: 'complete',
        data: { message: 'Audio generation complete' },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });

    it('should pass through clean error response unchanged', () => {
      const response: ClientResponse = {
        type: 'error',
        data: {
          code: 400,
          message: 'Invalid text format',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });

    it('should pass through ready response unchanged', () => {
      const response: ClientResponse = {
        type: 'ready',
        data: { message: 'Connected to TTS service' },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });
  });

  describe('Forbidden Field Detection', () => {
    it('should detect "minimax" in field names', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          minimax_version: '1.0',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).not.toHaveProperty('minimax_version');
    });

    it('should detect "moss" in field names', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          moss_audio_id: '12345',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).not.toHaveProperty('moss_audio_id');
    });

    it('should detect "group_id" in field names', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          group_id: 'test_group',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).not.toHaveProperty('group_id');
    });

    it('should detect "task_id" in field names', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          task_id: 'task_12345',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).not.toHaveProperty('task_id');
    });

    it('should detect "provider" in field names', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          provider: 'minimax',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).not.toHaveProperty('provider');
    });
  });

  describe('Nested Object Sanitization', () => {
    it('should remove forbidden fields from nested objects', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          metadata: {
            minimax_session: 'abc123',
            duration: 5000,
          },
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).toHaveProperty('metadata');
      expect((result.data as any).metadata).not.toHaveProperty('minimax_session');
      expect((result.data as any).metadata).toHaveProperty('duration');
    });

    it('should handle deeply nested forbidden fields', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          meta: {
            info: {
              debug: {
                moss_trace_id: 'xyz789',
              },
            },
          },
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect((result.data as any).meta.info.debug).not.toHaveProperty('moss_trace_id');
    });

    it('should preserve clean nested objects', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          metadata: {
            sampleRate: 48000,
            channels: 2,
          },
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).toEqual(response.data);
    });
  });

  describe('String Value Sanitization', () => {
    it('should detect forbidden terms in string values', () => {
      const response: ClientResponse = {
        type: 'error',
        data: {
          code: 500,
          message: 'Connection to minimax failed',
        },
      };

      // Note: String values with forbidden terms are detected but not modified
      // (ErrorSanitizer handles error message sanitization)
      const isValid = sanitizer.validateResponse(response);

      expect(isValid).toBe(false);
    });

    it('should allow clean string values', () => {
      const response: ClientResponse = {
        type: 'error',
        data: {
          code: 400,
          message: 'Text too long',
        },
      };

      const isValid = sanitizer.validateResponse(response);

      expect(isValid).toBe(true);
    });
  });

  describe('Response Validation', () => {
    it('should validate clean responses as safe', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: { chunk: 'base64data' },
      };

      const isValid = sanitizer.validateResponse(response);

      expect(isValid).toBe(true);
    });

    it('should detect violations in responses', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          minimax_version: '1.0',
        },
      };

      const isValid = sanitizer.validateResponse(response);

      expect(isValid).toBe(false);
    });

    it('should validate responses with requestId', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: { chunk: 'base64data' },
        requestId: 'req_123',
      };

      const isValid = sanitizer.validateResponse(response);

      expect(isValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle responses with null data', () => {
      const response: ClientResponse = {
        type: 'complete',
        data: null,
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });

    it('should handle responses with undefined data', () => {
      const response: ClientResponse = {
        type: 'complete',
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });

    it('should handle empty data objects', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {},
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });

    it('should handle arrays in data', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunks: ['chunk1', 'chunk2', 'chunk3'],
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result).toEqual(response);
    });

    it('should not mutate original response', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          minimax_id: '12345',
        },
      };

      const original = JSON.parse(JSON.stringify(response));
      sanitizer.sanitizeResponse(response);

      // Original should be unchanged
      expect(response).toEqual(original);
    });
  });

  describe('Multiple Violations', () => {
    it('should remove all forbidden fields', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          minimax_version: '1.0',
          moss_audio_id: 'abc',
          group_id: '123',
          task_id: 'xyz',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).toEqual({ chunk: 'data' });
    });

    it('should handle mixed clean and forbidden fields', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'base64data',
          sampleRate: 48000,
          minimax_session: 'abc123',
          channels: 2,
          moss_trace: 'xyz',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).toEqual({
        chunk: 'base64data',
        sampleRate: 48000,
        channels: 2,
      });
    });
  });

  describe('Custom Headers', () => {
    it('should return custom XTTS headers', () => {
      const headers = ResponseSanitizer.getCustomHeaders();

      expect(headers).toEqual(CUSTOM_HANDSHAKE_HEADERS);
    });

    it('should include Server header', () => {
      const headers = ResponseSanitizer.getCustomHeaders();

      expect(headers['Server']).toBe('XTTS-Proxy/1.0');
    });

    it('should include X-XTTS-Version header', () => {
      const headers = ResponseSanitizer.getCustomHeaders();

      expect(headers['X-XTTS-Version']).toBe('1.0.0');
    });

    it('should include X-Powered-By header', () => {
      const headers = ResponseSanitizer.getCustomHeaders();

      expect(headers['X-Powered-By']).toBe('XTTS');
    });

    it('should not mutate original headers', () => {
      const headers1 = ResponseSanitizer.getCustomHeaders();
      headers1['Test'] = 'modified';

      const headers2 = ResponseSanitizer.getCustomHeaders();

      expect(headers2).not.toHaveProperty('Test');
    });
  });

  describe('Case Insensitivity', () => {
    it('should detect uppercase forbidden terms', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          MINIMAX_VERSION: '1.0',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).not.toHaveProperty('MINIMAX_VERSION');
    });

    it('should detect mixed case forbidden terms', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'data',
          MiniMax_Session: 'abc',
        },
      };

      const result = sanitizer.sanitizeResponse(response);

      expect(result.data).not.toHaveProperty('MiniMax_Session');
    });
  });

  describe('Performance', () => {
    it('should sanitize in reasonable time (<5ms)', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: {
          chunk: 'base64data'.repeat(100),
          metadata: {
            sampleRate: 48000,
            channels: 2,
          },
        },
      };

      const start = Date.now();
      sanitizer.sanitizeResponse(response);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(5);
    });

    it('should handle 100 sanitizations in <50ms', () => {
      const response: ClientResponse = {
        type: 'audio',
        data: { chunk: 'base64data' },
      };

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        sanitizer.sanitizeResponse(response);
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});
