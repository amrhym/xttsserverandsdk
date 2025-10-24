/**
 * Test Configuration Helpers
 *
 * Provides standard test configuration objects to avoid duplication
 */

import { ServerConfig } from '../../src/config/environment';
import { VoiceMapping } from '../../src/voice/VoiceMapper';

export const testVoiceMapping: VoiceMapping = {
  fahd: 'moss_audio_35736e9c-7d11-11f0-bb73-1e2a4cfcd245',
  emma: 'moss_audio_12345678-abcd-4321-9876-fedcba987654',
  noah: 'moss_audio_87654321-dcba-1234-5678-0123456789ab',
};

export const createTestConfig = (overrides?: Partial<ServerConfig>): ServerConfig => {
  return {
    port: 0, // Use random available port
    host: '127.0.0.1',
    logLevel: 'error', // Suppress logs in tests
    nodeEnv: 'test',
    maxConnections: 10,
    authorizedApiKeys: ['test_key'],
    voiceMapping: testVoiceMapping,
    voiceMappingFile: 'test/voices.json', // Not actually used in tests
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY || 'test_minimax_key',
      groupId: process.env.MINIMAX_GROUP_ID || 'test_group_id',
    },
    ...overrides,
  };
};
