/**
 * Environment Configuration
 *
 * Loads and validates environment variables for the proxy server.
 */

import * as dotenv from 'dotenv';
import { log } from '../utils/logger';

// Load environment variables
dotenv.config();

export interface ServerConfig {
  port: number;
  host: string;
  logLevel: string;
  nodeEnv: string;
  maxConnections: number;
  authorizedApiKeys: string[];
  minimax: {
    apiKey: string;
    groupId: string;
  };
}

/**
 * Load and validate environment configuration
 */
export const loadConfig = (): ServerConfig => {
  const component = 'Environment';

  const config: ServerConfig = {
    port: parseInt(process.env.SERVER_PORT || '8080', 10),
    host: process.env.SERVER_HOST || '0.0.0.0',
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '100', 10),
    authorizedApiKeys: process.env.AUTHORIZED_API_KEYS
      ? process.env.AUTHORIZED_API_KEYS.split(',').map((k) => k.trim())
      : [],
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

  log.info('Configuration loaded successfully', component, {
    port: config.port,
    host: config.host,
    maxConnections: config.maxConnections,
    apiKeyCount: config.authorizedApiKeys.length,
  });

  return config;
};
