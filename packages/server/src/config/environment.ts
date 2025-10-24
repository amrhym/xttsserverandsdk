/**
 * Environment Configuration
 *
 * Loads and validates environment variables for the proxy server.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../utils/logger';
import { VoiceMapping } from '../voice/VoiceMapper';

// Load environment variables
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
  nodeEnv: string;
  maxConnections: number;
  authorizedApiKeys: string[];
  voiceMapping: VoiceMapping;
  voiceMappingFile: string;
  minimax: {
    apiKey: string;
    groupId: string;
  };
}

/**
 * Load voice mapping from file
 */
const loadVoiceMapping = (voiceMappingFile: string): VoiceMapping => {
  const component = 'Environment';

  try {
    // Read voice mapping file
    const fileContent = fs.readFileSync(voiceMappingFile, 'utf-8');
    const voiceMapping: VoiceMapping = JSON.parse(fileContent);

    log.info('Voice mapping loaded', component, {
      file: voiceMappingFile,
      voiceCount: Object.keys(voiceMapping).length,
    });

    return voiceMapping;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Failed to load voice mapping from ${voiceMappingFile}`, component, {
      error: errorMsg,
    });
    throw new Error(`Failed to load voice mapping: ${errorMsg}`);
  }
};

/**
 * Load and validate environment configuration
 */
export const loadConfig = (): ServerConfig => {
  const component = 'Environment';

  // Determine voice mapping file path
  const defaultVoiceMappingFile = path.join(__dirname, '..', '..', 'config', 'voices.json');
  const voiceMappingFile = process.env.VOICE_MAPPING_FILE || defaultVoiceMappingFile;

  // Load voice mapping
  const voiceMapping = loadVoiceMapping(voiceMappingFile);

  const config: ServerConfig = {
    port: parseInt(process.env.SERVER_PORT || '8080', 10),
    host: process.env.SERVER_HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100', 10),
    authorizedApiKeys: process.env.AUTHORIZED_API_KEYS
      ? process.env.AUTHORIZED_API_KEYS.split(',').map((k) => k.trim())
      : [],
    voiceMapping,
    voiceMappingFile,
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY || '',
      groupId: process.env.MINIMAX_GROUP_ID || '',
    },
  };

  // Validation
  if (isNaN(config.port) || config.port < 1 || config.port > 65535) {
    log.error(`Invalid SERVER_PORT: ${process.env.SERVER_PORT}`, component);
    throw new Error('Invalid SERVER_PORT environment variable');
  }

  if (isNaN(config.maxConnections) || config.maxConnections < 1) {
    log.error(`Invalid MAX_CONNECTIONS: ${process.env.MAX_CONNECTIONS}`, component);
    throw new Error('Invalid MAX_CONNECTIONS environment variable');
  }

  // Warnings for missing optional config
  if (config.authorizedApiKeys.length === 0) {
    log.warn('No AUTHORIZED_API_KEYS configured - authentication will fail', component);
  }

  if (!config.minimax.apiKey || !config.minimax.groupId) {
    log.warn('Minimax credentials not configured - TTS will fail', component);
  }

  // Validate voice mapping
  const voiceCount = Object.keys(config.voiceMapping).length;
  if (voiceCount === 0) {
    log.warn('No voices configured in voice mapping', component);
  }

  log.info('Configuration loaded successfully', component, {
    port: config.port,
    host: config.host,
    maxConnections: config.maxConnections,
    apiKeyCount: config.authorizedApiKeys.length,
    voiceCount,
  });

  return config;
};
