/**
 * Unit tests for VoiceMapper
 *
 * Tests voice ID mapping functionality with various scenarios
 */

import { VoiceMapper, VoiceMapping } from '../../../src/voice/VoiceMapper';

describe('VoiceMapper', () => {
  const validVoiceMapping: VoiceMapping = {
    fahd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
    emma: 'moss_audio_12345678-abcd-4321-9876-fedcba987654',
    noah: 'moss_audio_87654321-dcba-1234-5678-0123456789ab',
  };

  describe('Constructor', () => {
    it('should create VoiceMapper with valid mapping', () => {
      const mapper = new VoiceMapper(validVoiceMapping);
      expect(mapper).toBeInstanceOf(VoiceMapper);
      expect(mapper.getVoiceCount()).toBe(3);
    });

    it('should throw error for invalid mapping config (not an object)', () => {
      expect(() => new VoiceMapper(null as any)).toThrow(
        'Voice mapping configuration must be an object'
      );
    });

    it('should throw error for invalid Minimax voice ID format', () => {
      const invalidMapping = {
        fahd: 'invalid_voice_id',
      };

      expect(() => new VoiceMapper(invalidMapping)).toThrow('Invalid Minimax voice ID format');
    });

    it('should throw error for duplicate friendly names', () => {
      const duplicateMapping = {
        fahd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
        FAHD: 'moss_audio_12345678-abcd-4321-9876-fedcba987654',
      };

      expect(() => new VoiceMapper(duplicateMapping)).toThrow('Duplicate voice mapping');
    });

    it('should handle empty mapping', () => {
      const mapper = new VoiceMapper({});
      expect(mapper.getVoiceCount()).toBe(0);
    });
  });

  describe('getMinimaxVoiceId', () => {
    let mapper: VoiceMapper;

    beforeEach(() => {
      mapper = new VoiceMapper(validVoiceMapping);
    });

    it('should return correct Minimax voice ID for known voice', () => {
      const voiceId = mapper.getMinimaxVoiceId('fahd');
      expect(voiceId).toBe('moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245');
    });

    it('should be case-insensitive', () => {
      expect(mapper.getMinimaxVoiceId('FAHD')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
      expect(mapper.getMinimaxVoiceId('Fahd')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
      expect(mapper.getMinimaxVoiceId('fAhD')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
    });

    it('should throw error for unknown voice', () => {
      expect(() => mapper.getMinimaxVoiceId('unknown')).toThrow("Voice 'unknown' not available");
    });

    it('should handle all configured voices', () => {
      expect(mapper.getMinimaxVoiceId('fahd')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
      expect(mapper.getMinimaxVoiceId('emma')).toBe(
        'moss_audio_12345678-abcd-4321-9876-fedcba987654'
      );
      expect(mapper.getMinimaxVoiceId('noah')).toBe(
        'moss_audio_87654321-dcba-1234-5678-0123456789ab'
      );
    });

    it('should complete lookup in <1ms', () => {
      const start = performance.now();
      mapper.getMinimaxVoiceId('fahd');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1);
    });

    it('should maintain <1ms latency for 1000 lookups', () => {
      const times: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        mapper.getMinimaxVoiceId('fahd');
        times.push(performance.now() - start);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      expect(avgTime).toBeLessThan(1);
    });
  });

  describe('getFriendlyName', () => {
    let mapper: VoiceMapper;

    beforeEach(() => {
      mapper = new VoiceMapper(validVoiceMapping);
    });

    it('should return friendly name for known Minimax voice ID', () => {
      const friendlyName = mapper.getFriendlyName(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
      expect(friendlyName).toBe('fahd');
    });

    it('should return undefined for unknown Minimax voice ID', () => {
      const friendlyName = mapper.getFriendlyName('moss_audio_unknown-uuid-here');
      expect(friendlyName).toBeUndefined();
    });

    it('should handle all configured voice IDs', () => {
      expect(mapper.getFriendlyName('moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245')).toBe(
        'fahd'
      );
      expect(mapper.getFriendlyName('moss_audio_12345678-abcd-4321-9876-fedcba987654')).toBe(
        'emma'
      );
      expect(mapper.getFriendlyName('moss_audio_87654321-dcba-1234-5678-0123456789ab')).toBe(
        'noah'
      );
    });
  });

  describe('isValidVoice', () => {
    let mapper: VoiceMapper;

    beforeEach(() => {
      mapper = new VoiceMapper(validVoiceMapping);
    });

    it('should return true for valid voice names', () => {
      expect(mapper.isValidVoice('fahd')).toBe(true);
      expect(mapper.isValidVoice('emma')).toBe(true);
      expect(mapper.isValidVoice('noah')).toBe(true);
    });

    it('should return false for invalid voice names', () => {
      expect(mapper.isValidVoice('unknown')).toBe(false);
      expect(mapper.isValidVoice('')).toBe(false);
      expect(mapper.isValidVoice('invalid')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(mapper.isValidVoice('FAHD')).toBe(true);
      expect(mapper.isValidVoice('Fahd')).toBe(true);
      expect(mapper.isValidVoice('fAhD')).toBe(true);
    });
  });

  describe('getAllVoices', () => {
    let mapper: VoiceMapper;

    beforeEach(() => {
      mapper = new VoiceMapper(validVoiceMapping);
    });

    it('should return all voice names', () => {
      const voices = mapper.getAllVoices();
      expect(voices).toHaveLength(3);
      expect(voices).toContain('fahd');
      expect(voices).toContain('emma');
      expect(voices).toContain('noah');
    });

    it('should return sorted voice names', () => {
      const voices = mapper.getAllVoices();
      expect(voices).toEqual(['emma', 'fahd', 'noah']);
    });

    it('should return empty array for empty mapping', () => {
      const emptyMapper = new VoiceMapper({});
      expect(emptyMapper.getAllVoices()).toEqual([]);
    });
  });

  describe('getVoiceCount', () => {
    it('should return correct voice count', () => {
      const mapper = new VoiceMapper(validVoiceMapping);
      expect(mapper.getVoiceCount()).toBe(3);
    });

    it('should return 0 for empty mapping', () => {
      const emptyMapper = new VoiceMapper({});
      expect(emptyMapper.getVoiceCount()).toBe(0);
    });

    it('should return 1 for single voice', () => {
      const singleVoiceMapper = new VoiceMapper({
        fahd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
      });
      expect(singleVoiceMapper.getVoiceCount()).toBe(1);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      const result = VoiceMapper.validateConfig(validVoiceMapping);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid configuration (not an object)', () => {
      const result = VoiceMapper.validateConfig(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Voice mapping configuration must be an object');
    });

    it('should warn about empty configuration', () => {
      const result = VoiceMapper.validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No voice mappings configured');
    });

    it('should reject invalid voice ID format', () => {
      const invalidConfig = {
        fahd: 'invalid_voice_id',
      };

      const result = VoiceMapper.validateConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid voice ID format'))).toBe(true);
    });

    it('should reject duplicate voice names', () => {
      const duplicateConfig = {
        fahd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
        FAHD: 'moss_audio_12345678-abcd-4321-9876-fedcba987654',
      };

      const result = VoiceMapper.validateConfig(duplicateConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate voice name'))).toBe(true);
    });

    it('should reject duplicate voice IDs', () => {
      const duplicateIdConfig = {
        fahd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
        emma: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
      };

      const result = VoiceMapper.validateConfig(duplicateIdConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate voice ID'))).toBe(true);
    });

    it('should handle multiple validation errors', () => {
      const badConfig = {
        fahd: 'invalid_id',
        '': 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
        emma: 'also_invalid',
      };

      const result = VoiceMapper.validateConfig(badConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle voice names with special characters', () => {
      const specialMapping = {
        'voice-1': 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
        'voice_2': 'moss_audio_12345678-abcd-4321-9876-fedcba987654',
        'voice.3': 'moss_audio_87654321-dcba-1234-5678-0123456789ab',
      };

      const mapper = new VoiceMapper(specialMapping);
      expect(mapper.getMinimaxVoiceId('voice-1')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
      expect(mapper.getMinimaxVoiceId('voice_2')).toBe(
        'moss_audio_12345678-abcd-4321-9876-fedcba987654'
      );
      expect(mapper.getMinimaxVoiceId('voice.3')).toBe(
        'moss_audio_87654321-dcba-1234-5678-0123456789ab'
      );
    });

    it('should handle voice names with numbers', () => {
      const numericMapping = {
        voice1: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
        voice2: 'moss_audio_12345678-abcd-4321-9876-fedcba987654',
      };

      const mapper = new VoiceMapper(numericMapping);
      expect(mapper.getMinimaxVoiceId('voice1')).toBeDefined();
      expect(mapper.getMinimaxVoiceId('voice2')).toBeDefined();
    });

    it('should normalize to lowercase consistently', () => {
      const mixedCaseMapping = {
        FaHd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
      };

      const mapper = new VoiceMapper(mixedCaseMapping);
      expect(mapper.getMinimaxVoiceId('fahd')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
      expect(mapper.getMinimaxVoiceId('FAHD')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
      expect(mapper.getMinimaxVoiceId('FaHd')).toBe(
        'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245'
      );
    });
  });
});
