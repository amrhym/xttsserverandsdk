/**
 * ResponseSanitizer - Sanitizes outgoing responses to prevent provider information leaks
 *
 * Ensures no Minimax-specific fields or metadata leak through to clients.
 * Validates all outgoing messages before delivery.
 */

import { ClientResponse } from '../protocol/types';
import { log } from '../utils/logger';

const COMPONENT = 'ResponseSanitizer';

/**
 * Fields that should never appear in client responses
 * These are Minimax-specific fields that could leak provider identity
 */
const FORBIDDEN_FIELDS = [
  'minimax',
  'moss',
  'moss_audio',
  'group_id',
  'task_id',
  'session_id',
  'minimax_version',
  'provider',
  'upstream',
  'backend',
];

/**
 * Custom headers for WebSocket handshake response
 * These mask the origin and present XTTS as the server
 */
export const CUSTOM_HANDSHAKE_HEADERS = {
  Server: 'XTTS-Proxy/1.0',
  'X-XTTS-Version': '1.0.0',
  'X-Powered-By': 'XTTS',
};

/**
 * ResponseSanitizer validates and sanitizes outgoing responses
 */
export class ResponseSanitizer {
  /**
   * Sanitize a client response before sending
   *
   * Validates that no forbidden fields exist in the response.
   * If forbidden fields are detected, they are removed and logged.
   *
   * @param response - The response to sanitize
   * @returns Sanitized response safe to send to client
   */
  public sanitizeResponse(response: ClientResponse): ClientResponse {
    // Deep clone to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(response)) as ClientResponse;

    // Check for forbidden fields in the entire response object
    const violations = this.detectViolations(sanitized);

    if (violations.length > 0) {
      log.warn('Detected forbidden fields in response, removing', COMPONENT, {
        violations,
        responseType: response.type,
      });

      // Remove forbidden fields
      this.removeForbiddenFields(sanitized);
    }

    return sanitized;
  }

  /**
   * Detect forbidden field names anywhere in the response object
   *
   * @param obj - Object to scan
   * @param path - Current path for nested objects (for logging)
   * @returns Array of violation paths
   */
  private detectViolations(obj: unknown, path = ''): string[] {
    const violations: string[] = [];

    if (obj === null || obj === undefined) {
      return violations;
    }

    if (typeof obj !== 'object') {
      return violations;
    }

    // Check all keys in the object
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const lowerKey = key.toLowerCase();

      // Check if key is forbidden
      if (FORBIDDEN_FIELDS.some((forbidden) => lowerKey.includes(forbidden))) {
        violations.push(currentPath);
      }

      // Check string values for forbidden terms
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        for (const forbidden of FORBIDDEN_FIELDS) {
          if (lowerValue.includes(forbidden)) {
            violations.push(`${currentPath}[value contains '${forbidden}']`);
          }
        }
      }

      // Recursively check nested objects
      if (typeof value === 'object' && value !== null) {
        violations.push(...this.detectViolations(value, currentPath));
      }
    }

    return violations;
  }

  /**
   * Remove forbidden fields from object
   *
   * @param obj - Object to clean
   */
  private removeForbiddenFields(obj: unknown): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return;
    }

    // Remove forbidden keys
    for (const key of Object.keys(obj)) {
      const lowerKey = key.toLowerCase();

      if (FORBIDDEN_FIELDS.some((forbidden) => lowerKey.includes(forbidden))) {
        delete (obj as Record<string, unknown>)[key];
        continue;
      }

      // Recursively clean nested objects
      const value = (obj as Record<string, unknown>)[key];
      if (typeof value === 'object' && value !== null) {
        this.removeForbiddenFields(value);
      }
    }
  }

  /**
   * Get custom headers for WebSocket handshake
   *
   * These headers mask the upstream provider and present XTTS as the server.
   * Note: ws library has limited support for custom response headers.
   * This is provided for future use with HTTP upgrade handling.
   *
   * @returns Custom headers object
   */
  public static getCustomHeaders(): Record<string, string> {
    return { ...CUSTOM_HANDSHAKE_HEADERS };
  }

  /**
   * Validate that a response is safe to send (no forbidden fields)
   *
   * @param response - Response to validate
   * @returns true if safe, false if violations detected
   */
  public validateResponse(response: ClientResponse): boolean {
    const violations = this.detectViolations(response);
    return violations.length === 0;
  }
}
