/**
 * API Key Management
 *
 * Provides functionality to generate, store, and manage API keys
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { log } from '../utils/logger';

const COMPONENT = 'ApiKeyManager';

export interface ApiKey {
  key: string;
  name: string;
  description?: string;
  createdAt: Date;
  expiresAt?: Date;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  isActive: boolean;
}

export interface ApiKeyStorageData {
  keys: ApiKey[];
}

export class ApiKeyManager {
  private keys: Map<string, ApiKey> = new Map();
  private storageFile: string;

  constructor(storageFile: string = './api-keys.json') {
    this.storageFile = path.resolve(storageFile);
  }

  /**
   * Initialize the manager and load existing keys
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.storageFile, 'utf-8');
      const parsed: ApiKeyStorageData = JSON.parse(data);

      // Convert dates from strings
      parsed.keys.forEach(key => {
        key.createdAt = new Date(key.createdAt);
        if (key.expiresAt) {
          key.expiresAt = new Date(key.expiresAt);
        }
        this.keys.set(key.key, key);
      });

      log.info('API keys loaded', COMPONENT, {
        count: this.keys.size,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        log.info('No existing API keys file, starting fresh', COMPONENT);
        await this.save();
      } else {
        log.error('Failed to load API keys', COMPONENT, {
          error: (error as Error).message,
        });
        throw error;
      }
    }
  }

  /**
   * Save keys to disk
   */
  private async save(): Promise<void> {
    try {
      const data: ApiKeyStorageData = {
        keys: Array.from(this.keys.values()),
      };

      await fs.writeFile(
        this.storageFile,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      log.debug('API keys saved', COMPONENT);
    } catch (error) {
      log.error('Failed to save API keys', COMPONENT, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate a new API key
   */
  async generateKey(options: {
    name: string;
    description?: string;
    expiresAt?: Date;
    rateLimit?: {
      requestsPerMinute: number;
      requestsPerDay: number;
    };
  }): Promise<ApiKey> {
    // Generate a secure random key
    const randomBytes = crypto.randomBytes(24);
    const key = `xtts_${randomBytes.toString('base64url')}`;

    const apiKey: ApiKey = {
      key,
      name: options.name,
      description: options.description,
      createdAt: new Date(),
      expiresAt: options.expiresAt,
      rateLimit: options.rateLimit || {
        requestsPerMinute: 60,
        requestsPerDay: 10000,
      },
      isActive: true,
    };

    this.keys.set(key, apiKey);
    await this.save();

    log.info('API key generated', COMPONENT, {
      name: options.name,
      keyLast4: key.slice(-4),
    });

    return apiKey;
  }

  /**
   * Get an API key
   */
  getKey(key: string): ApiKey | undefined {
    return this.keys.get(key);
  }

  /**
   * List all API keys
   */
  listKeys(): ApiKey[] {
    return Array.from(this.keys.values());
  }

  /**
   * Revoke an API key
   */
  async revokeKey(key: string): Promise<boolean> {
    const apiKey = this.keys.get(key);
    if (!apiKey) {
      return false;
    }

    apiKey.isActive = false;
    await this.save();

    log.info('API key revoked', COMPONENT, {
      name: apiKey.name,
      keyLast4: key.slice(-4),
    });

    return true;
  }

  /**
   * Delete an API key
   */
  async deleteKey(key: string): Promise<boolean> {
    const apiKey = this.keys.get(key);
    if (!apiKey) {
      return false;
    }

    this.keys.delete(key);
    await this.save();

    log.info('API key deleted', COMPONENT, {
      name: apiKey.name,
      keyLast4: key.slice(-4),
    });

    return true;
  }

  /**
   * Validate an API key
   */
  validateKey(key: string): { valid: boolean; reason?: string } {
    const apiKey = this.keys.get(key);

    if (!apiKey) {
      return { valid: false, reason: 'Key not found' };
    }

    if (!apiKey.isActive) {
      return { valid: false, reason: 'Key is revoked' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, reason: 'Key has expired' };
    }

    return { valid: true };
  }

  /**
   * Get all active keys for AuthManager
   */
  getActiveKeys(): string[] {
    return Array.from(this.keys.values())
      .filter(k => k.isActive && (!k.expiresAt || k.expiresAt > new Date()))
      .map(k => k.key);
  }
}
