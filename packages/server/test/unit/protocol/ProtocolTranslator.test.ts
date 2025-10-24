/**
 * Unit tests for ProtocolTranslator
 *
 * Tests bidirectional protocol translation between custom client protocol
 * and Minimax protocol format.
 */

import { ProtocolTranslator } from '../../../src/protocol/ProtocolTranslator';
import { VoiceMapper, VoiceMapping } from '../../../src/voice/VoiceMapper';
import {
  ClientMessage,
  MinimaxServerMessage,
  DEFAULT_AUDIO_SETTING,
  DEFAULT_VOICE_SETTING,
} from '../../../src/protocol/types';

describe('ProtocolTranslator', () => {
  let translator: ProtocolTranslator;
  let voiceMapper: VoiceMapper;

  const testVoiceMapping: VoiceMapping = {
    fahd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
    emma: 'moss_audio_12345678-abcd-4321-9876-fedcba987654',
  };

  beforeEach(() => {
    voiceMapper = new VoiceMapper(testVoiceMapping);
    translator = new ProtocolTranslator(voiceMapper);
  });

  describe('translateToMinimax', () => {
    it('should translate client connect action to Minimax task_start', () => {
      const clientMessage: ClientMessage = {
        action: 'connect',
        voice: 'fahd',
      };

      const result = translator.translateToMinimax(clientMessage);

      expect(result.event).toBe('task_start');
      expect((result as any).voice_id).toBe('moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245');
      expect((result as any).voice_setting).toEqual(DEFAULT_VOICE_SETTING);
      expect((result as any).audio_setting).toEqual(DEFAULT_AUDIO_SETTING);
    });

    it('should throw error for unknown voice', () => {
      const clientMessage: ClientMessage = {
        action: 'connect',
        voice: 'unknown_voice',
      };

      expect(() => translator.translateToMinimax(clientMessage)).toThrow(
        "Voice 'unknown_voice' not available"
      );
    });

    it('should translate client speak action to Minimax task_continue', () => {
      const clientMessage: ClientMessage = {
        action: 'speak',
        voice: 'fahd',
        text: 'Hello world',
      };

      const result = translator.translateToMinimax(clientMessage);

      expect(result.event).toBe('task_continue');
      expect((result as any).text).toBe('Hello world');
    });

    it('should throw error if speak action has no text', () => {
      const clientMessage: ClientMessage = {
        action: 'speak',
        voice: 'fahd',
      };

      expect(() => translator.translateToMinimax(clientMessage)).toThrow(
        'Text is required for speak action'
      );
    });

    it('should translate client disconnect action to Minimax task_finish', () => {
      const clientMessage: ClientMessage = {
        action: 'disconnect',
        voice: 'fahd',
      };

      const result = translator.translateToMinimax(clientMessage);

      expect(result.event).toBe('task_finish');
      expect(Object.keys(result)).toEqual(['event']);
    });

    it('should throw error for unknown action', () => {
      const clientMessage = {
        action: 'invalid',
        voice: 'fahd',
      } as unknown as ClientMessage;

      expect(() => translator.translateToMinimax(clientMessage)).toThrow('Unknown action');
    });

    it('should handle requestId in client message', () => {
      const clientMessage: ClientMessage = {
        action: 'speak',
        voice: 'fahd',
        text: 'Test message',
        requestId: 'req_123',
      };

      // requestId is not part of Minimax protocol, so it should not appear in result
      const result = translator.translateToMinimax(clientMessage);
      expect((result as any).requestId).toBeUndefined();
    });

    it('should translate multiple messages in sequence', () => {
      const messages: ClientMessage[] = [
        { action: 'connect', voice: 'fahd' },
        { action: 'speak', voice: 'fahd', text: 'First message' },
        { action: 'speak', voice: 'fahd', text: 'Second message' },
        { action: 'disconnect', voice: 'fahd' },
      ];

      const results = messages.map((msg) => translator.translateToMinimax(msg));

      expect(results[0].event).toBe('task_start');
      expect(results[1].event).toBe('task_continue');
      expect((results[1] as any).text).toBe('First message');
      expect(results[2].event).toBe('task_continue');
      expect((results[2] as any).text).toBe('Second message');
      expect(results[3].event).toBe('task_finish');
    });
  });

  describe('translateFromMinimax', () => {
    it('should translate Minimax data event to client audio response', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'data',
        data: {
          audio: '48656c6c6f', // Hex-encoded "Hello"
          is_final: false,
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage);

      expect(result.type).toBe('audio');
      expect(result.data).toBeDefined();
      expect((result.data as any).audio).toBeInstanceOf(Buffer);
      expect((result.data as any).audio.toString()).toBe('Hello');
    });

    it('should translate Minimax data event with is_final to client complete response', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'data',
        data: {
          audio: '576f726c64', // Hex-encoded "World"
          is_final: true,
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage);

      expect(result.type).toBe('complete');
      expect(result.data).toBeDefined();
      expect((result.data as any).audio).toBeInstanceOf(Buffer);
      expect((result.data as any).audio.toString()).toBe('World');
    });

    it('should translate Minimax error event to client error response', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'error',
        error: {
          code: 1001,
          message: 'Invalid request',
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage);

      expect(result.type).toBe('error');
      expect(result.data).toBeDefined();
      expect((result.data as any).code).toBe(401); // 1001 mapped to 401 by ErrorSanitizer
      expect((result.data as any).message).toBe('Invalid request');
    });

    it('should sanitize Minimax references in error messages', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'error',
        error: {
          code: 500,
          message: 'Minimax API error occurred',
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage);

      expect(result.type).toBe('error');
      expect((result.data as any).message).toBe('TTS API error occurred'); // "Minimax API" → "TTS API"
      expect((result.data as any).message).not.toContain('Minimax');
    });

    it('should include requestId when provided', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'data',
        data: {
          audio: '48656c6c6f',
          is_final: false,
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage, 'req_456');

      expect(result.requestId).toBe('req_456');
    });

    it('should throw error for unknown Minimax event', () => {
      const minimaxMessage = {
        event: 'unknown_event',
      } as unknown as MinimaxServerMessage;

      expect(() => translator.translateFromMinimax(minimaxMessage)).toThrow(
        'Unknown Minimax event'
      );
    });

    it('should handle empty audio data', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'data',
        data: {
          audio: '',
          is_final: false,
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage);

      expect(result.type).toBe('audio');
      expect((result.data as any).audio).toBeInstanceOf(Buffer);
      expect((result.data as any).audio.length).toBe(0);
    });

    it('should handle large audio data', () => {
      // Create 1MB of hex-encoded data
      const largeHexData = '00'.repeat(1024 * 1024);

      const minimaxMessage: MinimaxServerMessage = {
        event: 'data',
        data: {
          audio: largeHexData,
          is_final: false,
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage);

      expect(result.type).toBe('audio');
      expect((result.data as any).audio).toBeInstanceOf(Buffer);
      expect((result.data as any).audio.length).toBe(1024 * 1024);
    });
  });

  describe('performance', () => {
    it('should translate client to Minimax in <10ms', () => {
      const clientMessage: ClientMessage = {
        action: 'speak',
        voice: 'fahd',
        text: 'Performance test message',
      };

      const start = performance.now();
      translator.translateToMinimax(clientMessage);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    it('should translate Minimax to client in <10ms', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'data',
        data: {
          audio: '48656c6c6f20576f726c64',
          is_final: false,
        },
      };

      const start = performance.now();
      translator.translateFromMinimax(minimaxMessage);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(10);
    });

    it('should maintain <10ms latency for 100 consecutive translations', () => {
      const clientMessage: ClientMessage = {
        action: 'speak',
        voice: 'fahd',
        text: 'Batch test message',
      };

      const times: number[] = [];

      for (let i = 0; i < 100; i++) {
        const start = performance.now();
        translator.translateToMinimax(clientMessage);
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(10);
    });
  });

  describe('edge cases', () => {
    it('should handle unicode text in speak action', () => {
      const clientMessage: ClientMessage = {
        action: 'speak',
        voice: 'fahd',
        text: '你好世界 🌍 مرحبا',
      };

      const result = translator.translateToMinimax(clientMessage);

      expect(result.event).toBe('task_continue');
      expect((result as any).text).toBe('你好世界 🌍 مرحبا');
    });

    it('should handle very long text in speak action', () => {
      const longText = 'A'.repeat(10000);
      const clientMessage: ClientMessage = {
        action: 'speak',
        voice: 'fahd',
        text: longText,
      };

      const result = translator.translateToMinimax(clientMessage);

      expect(result.event).toBe('task_continue');
      expect((result as any).text).toBe(longText);
    });

    it('should handle case-insensitive Minimax sanitization', () => {
      const minimaxMessage: MinimaxServerMessage = {
        event: 'error',
        error: {
          code: 500,
          message: 'MINIMAX service unavailable, minimax error, MiniMax failed',
        },
      };

      const result = translator.translateFromMinimax(minimaxMessage);

      expect((result.data as any).message).not.toMatch(/minimax/i);
      expect((result.data as any).message).toContain('TTS service');
    });
  });
});
