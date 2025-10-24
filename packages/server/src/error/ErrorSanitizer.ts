/**
 * Error Sanitizer
 *
 * Sanitizes Minimax-specific errors before forwarding to clients.
 * This is a critical security component - ensures no provider information leaks.
 *
 * Strategy:
 * 1. Pattern Replacement - Replace provider-specific terms
 * 2. Code Mapping - Map Minimax codes to generic HTTP codes
 * 3. Detail Stripping - Remove stack traces and internal details
 *
 * Security: All errors MUST pass through this sanitizer before client delivery
 */

import { log } from '../utils/logger';

const COMPONENT = 'ErrorSanitizer';

export interface MinimaxError {
  code: number;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface SanitizedError {
  code: number;
  message: string;
}

/**
 * Sanitization patterns for provider-specific terms
 * Order matters: More specific patterns first!
 */
const SANITIZATION_PATTERNS = [
  // API endpoints and domains (MUST come first before general replacements)
  { pattern: /wss?:\/\/[^\s]+minimax[^\s]*/gi, replacement: 'TTS API endpoint' },
  { pattern: /api\.minimax\.io/gi, replacement: 'TTS API' },

  // Specific patterns before general ones
  { pattern: /minimax\s+api/gi, replacement: 'TTS API' },
  { pattern: /minimax\s+service/gi, replacement: 'TTS service' },
  { pattern: /moss\s+audio\s+service/gi, replacement: 'TTS service' },
  { pattern: /moss_audio/gi, replacement: 'voice' },

  // Technical implementation details
  { pattern: /voice_id/gi, replacement: 'voice identifier' },
  { pattern: /group_id/gi, replacement: 'account identifier' },
  { pattern: /task_(start|continue|finish)/gi, replacement: 'TTS operation' },

  // General provider names (LAST!)
  { pattern: /minimax/gi, replacement: 'TTS service' },
  { pattern: /moss/gi, replacement: 'TTS' },
];

/**
 * Error code mapping: Minimax codes → Generic HTTP codes
 */
const ERROR_CODE_MAP: Record<number, number> = {
  // Authentication errors
  1001: 401, // Invalid API key
  1002: 401, // Expired token
  1003: 403, // Insufficient permissions

  // Request errors
  2001: 400, // Invalid request format
  2002: 400, // Missing required field
  2003: 400, // Invalid field value
  2004: 413, // Text too long
  2005: 400, // Invalid voice ID

  // Rate limiting
  3001: 429, // Rate limit exceeded
  3002: 429, // Concurrent limit exceeded

  // Service errors
  4001: 503, // Service unavailable
  4002: 504, // Service timeout
  4003: 500, // Internal service error

  // Unknown/unmapped errors default to 500
};

export class ErrorSanitizer {
  /**
   * Sanitize a Minimax error before sending to client
   */
  public sanitizeError(error: MinimaxError): SanitizedError {
    const startTime = performance.now();

    // Log original error for debugging (server-side only)
    log.warn('Sanitizing error before sending to client', COMPONENT, {
      originalCode: error.code,
      originalMessage: error.message,
      hasDetails: Boolean(error.details),
      hasStack: Boolean(error.stack),
    });

    // Sanitize message text
    const sanitizedMessage = this.sanitizeMessage(error.message);

    // Map error code
    const sanitizedCode = this.mapErrorCode(error.code);

    // Validate no leaks
    const sanitized: SanitizedError = {
      code: sanitizedCode,
      message: sanitizedMessage,
    };

    if (!this.validateNoLeaks(sanitized)) {
      log.error('Sanitization validation failed - leak detected!', COMPONENT, {
        sanitized,
        original: error.message,
      });
      // Fallback to generic error if validation fails
      return {
        code: 500,
        message: 'TTS service error occurred',
      };
    }

    const elapsed = performance.now() - startTime;
    log.debug(`Error sanitized in ${elapsed.toFixed(2)}ms`, COMPONENT, {
      sanitizedCode,
      messageLength: sanitizedMessage.length,
    });

    return sanitized;
  }

  /**
   * Sanitize error message text
   */
  private sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return 'An error occurred';
    }

    let sanitized = message;

    // Apply all sanitization patterns
    for (const { pattern, replacement } of SANITIZATION_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }

    // Remove stack traces (anything after "at " or "    at")
    sanitized = sanitized.replace(/\s+at\s+.*/gi, '');

    // Remove file paths
    sanitized = sanitized.replace(/\/[\w\-_.\/]+\.(js|ts|py|go)/gi, '');

    // Remove IP addresses
    sanitized = sanitized.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, 'server');

    // Remove port numbers after domains
    sanitized = sanitized.replace(/:(\d{2,5})\b/g, '');

    // Remove API keys (common JWT pattern)
    sanitized = sanitized.replace(/ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');

    // Remove UUIDs (moss_audio_xxx pattern already handled by SANITIZATION_PATTERNS)
    sanitized = sanitized.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[ID]');

    // Clean up multiple spaces
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // If message becomes too generic or empty, provide fallback
    if (!sanitized || sanitized.length < 5) {
      return 'An error occurred with the TTS service';
    }

    return sanitized;
  }

  /**
   * Map Minimax error code to generic HTTP code
   */
  private mapErrorCode(minimaxCode: number): number {
    // If it's already a standard HTTP code (< 1000), pass through
    if (minimaxCode < 1000) {
      return minimaxCode;
    }

    // Check if we have a mapping
    if (ERROR_CODE_MAP[minimaxCode]) {
      return ERROR_CODE_MAP[minimaxCode];
    }

    // Default mapping based on code range
    if (minimaxCode >= 1000 && minimaxCode < 2000) {
      return 401; // Auth errors
    } else if (minimaxCode >= 2000 && minimaxCode < 3000) {
      return 400; // Request errors
    } else if (minimaxCode >= 3000 && minimaxCode < 4000) {
      return 429; // Rate limiting
    } else if (minimaxCode >= 4000 && minimaxCode < 5000) {
      return 503; // Service errors
    }

    // Unknown code defaults to 500
    return 500;
  }

  /**
   * Validate that sanitized error contains no leaks
   */
  private validateNoLeaks(sanitized: SanitizedError): boolean {
    const message = sanitized.message.toLowerCase();

    // Check for provider-specific terms
    const leakPatterns = [
      'minimax',
      'moss',
      'moss_audio',
      'api.minimax.io',
      'group_id',
      'task_start',
      'task_continue',
      'task_finish',
    ];

    for (const pattern of leakPatterns) {
      if (message.includes(pattern)) {
        log.error('Leak detected in sanitized error', COMPONENT, {
          pattern,
          message: sanitized.message,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize error from exception/Error object
   */
  public sanitizeException(error: Error): SanitizedError {
    return this.sanitizeError({
      code: 500,
      message: error.message,
      stack: error.stack,
    });
  }

  /**
   * Quick sanitize for simple string errors
   */
  public sanitizeString(errorMessage: string, code: number = 500): SanitizedError {
    return this.sanitizeError({
      code,
      message: errorMessage,
    });
  }
}
