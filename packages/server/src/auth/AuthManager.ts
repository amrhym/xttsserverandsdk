/**
 * AuthManager - API Key Authentication
 *
 * Validates client API keys using Bearer token authentication.
 * Ensures <10ms validation performance using Set-based lookup.
 */

import { log } from '../utils/logger';

const COMPONENT = 'AuthManager';

export interface AuthResult {
  authenticated: boolean;
  apiKey?: string;
  error?: string;
}

/**
 * AuthManager handles API key validation for client connections
 */
export class AuthManager {
  private authorizedKeys: Set<string>;

  constructor(apiKeys: string[]) {
    // Use Set for O(1) lookup performance
    this.authorizedKeys = new Set(apiKeys);

    log.info('AuthManager initialized', COMPONENT, {
      keyCount: this.authorizedKeys.size,
    });
  }

  /**
   * Parse Authorization header and extract Bearer token
   */
  private parseAuthorizationHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    // Split on whitespace and filter out empty strings
    const parts = authHeader.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      log.warn('Invalid Authorization header format', COMPONENT, {
        format: authHeader.substring(0, 20) + '...',
      });
      return null;
    }

    return parts[1];
  }

  /**
   * Validate API key from Authorization header
   *
   * Performance: Must complete in <10ms (NFR10)
   */
  public authenticate(authHeader: string | undefined): AuthResult {
    const startTime = Date.now();

    // Parse Bearer token
    const apiKey = this.parseAuthorizationHeader(authHeader);

    if (!apiKey) {
      log.warn('Authentication failed: missing or invalid Authorization header', COMPONENT);
      return {
        authenticated: false,
        error: 'Invalid or missing Authorization header',
      };
    }

    // Validate API key (O(1) Set lookup)
    const isValid = this.authorizedKeys.has(apiKey);

    const duration = Date.now() - startTime;

    if (isValid) {
      log.info('Authentication successful', COMPONENT, {
        apiKeyLast4: apiKey.slice(-4),
        durationMs: duration,
      });

      return {
        authenticated: true,
        apiKey,
      };
    } else {
      log.warn('Authentication failed: invalid API key', COMPONENT, {
        apiKeyLast4: apiKey.slice(-4),
        durationMs: duration,
      });

      return {
        authenticated: false,
        error: 'Invalid API key',
      };
    }
  }

  /**
   * Check if API key is valid (direct key check without header parsing)
   */
  public isValidKey(apiKey: string): boolean {
    return this.authorizedKeys.has(apiKey);
  }

  /**
   * Get count of authorized API keys
   */
  public getKeyCount(): number {
    return this.authorizedKeys.size;
  }
}
