/**
 * Voice Mapper
 *
 * Maps friendly voice names (e.g., "fahd") to Minimax voice UUIDs.
 * This is a critical obfuscation layer - clients only see friendly names,
 * never Minimax-specific voice_id values.
 *
 * Performance: O(1) lookup using Map
 * Security: Voice UUIDs never exposed to clients
 */

import { log } from '../utils/logger';

const COMPONENT = 'VoiceMapper';

export interface VoiceMapping {
  [friendlyName: string]: string;
}

export class VoiceMapper {
  private voiceMap: Map<string, string>;
  private reverseMap: Map<string, string>;

  constructor(mappingConfig: VoiceMapping) {
    this.voiceMap = new Map();
    this.reverseMap = new Map();

    // Validate and load mappings
    this.loadMappings(mappingConfig);

    log.info('VoiceMapper initialized', COMPONENT, {
      voiceCount: this.voiceMap.size,
      voices: Array.from(this.voiceMap.keys()),
    });
  }

  /**
   * Load voice mappings from configuration
   */
  private loadMappings(mappingConfig: VoiceMapping): void {
    if (!mappingConfig || typeof mappingConfig !== 'object') {
      throw new Error('Voice mapping configuration must be an object');
    }

    const entries = Object.entries(mappingConfig);

    if (entries.length === 0) {
      log.warn('No voice mappings configured', COMPONENT);
    }

    for (const [friendlyName, minimaxVoiceId] of entries) {
      // Validate friendly name
      if (!friendlyName || typeof friendlyName !== 'string') {
        throw new Error(`Invalid friendly name: ${friendlyName}`);
      }

      // Validate Minimax voice ID format (moss_audio_[UUID])
      if (!this.isValidMinimaxVoiceId(minimaxVoiceId)) {
        throw new Error(
          `Invalid Minimax voice ID format for '${friendlyName}': ${minimaxVoiceId}`
        );
      }

      // Normalize friendly name to lowercase for case-insensitive lookup
      const normalizedName = friendlyName.toLowerCase();

      // Check for duplicates
      if (this.voiceMap.has(normalizedName)) {
        throw new Error(`Duplicate voice mapping for: ${friendlyName}`);
      }

      // Store mappings
      this.voiceMap.set(normalizedName, minimaxVoiceId);
      this.reverseMap.set(minimaxVoiceId, normalizedName);

      log.debug('Loaded voice mapping', COMPONENT, {
        friendlyName: normalizedName,
        voiceIdPrefix: minimaxVoiceId.substring(0, 20) + '...',
      });
    }
  }

  /**
   * Validate Minimax voice ID format
   */
  private isValidMinimaxVoiceId(voiceId: string): boolean {
    if (!voiceId || typeof voiceId !== 'string') {
      return false;
    }

    // Format: moss_audio_[UUID]
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const pattern = /^moss_audio_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return pattern.test(voiceId);
  }

  /**
   * Get Minimax voice ID from friendly name
   * @throws Error if voice not found
   */
  public getMinimaxVoiceId(friendlyName: string): string {
    const startTime = performance.now();

    // Normalize to lowercase for case-insensitive lookup
    const normalizedName = friendlyName.toLowerCase();

    const voiceId = this.voiceMap.get(normalizedName);

    if (!voiceId) {
      log.warn('Unknown voice requested', COMPONENT, {
        requestedVoice: friendlyName,
        availableVoices: Array.from(this.voiceMap.keys()),
      });
      throw new Error(`Voice '${friendlyName}' not available`);
    }

    const elapsed = performance.now() - startTime;
    log.debug('Voice mapping lookup', COMPONENT, {
      friendlyName,
      lookupTime: elapsed.toFixed(2),
    });

    return voiceId;
  }

  /**
   * Get friendly name from Minimax voice ID (reverse lookup)
   * Used for internal debugging only - never exposed to clients
   */
  public getFriendlyName(minimaxVoiceId: string): string | undefined {
    return this.reverseMap.get(minimaxVoiceId);
  }

  /**
   * Check if a friendly voice name is valid
   */
  public isValidVoice(friendlyName: string): boolean {
    const normalizedName = friendlyName.toLowerCase();
    return this.voiceMap.has(normalizedName);
  }

  /**
   * Get list of all available friendly voice names
   */
  public getAllVoices(): string[] {
    return Array.from(this.voiceMap.keys()).sort();
  }

  /**
   * Get number of configured voices
   */
  public getVoiceCount(): number {
    return this.voiceMap.size;
  }

  /**
   * Validate voice mapping configuration without loading
   * Static method for pre-validation during startup
   */
  public static validateConfig(mappingConfig: VoiceMapping): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!mappingConfig || typeof mappingConfig !== 'object') {
      errors.push('Voice mapping configuration must be an object');
      return { valid: false, errors };
    }

    const entries = Object.entries(mappingConfig);

    if (entries.length === 0) {
      errors.push('No voice mappings configured');
    }

    const seenNames = new Set<string>();
    const seenIds = new Set<string>();

    for (const [friendlyName, minimaxVoiceId] of entries) {
      // Validate friendly name
      if (!friendlyName || typeof friendlyName !== 'string') {
        errors.push(`Invalid friendly name: ${friendlyName}`);
        continue;
      }

      const normalizedName = friendlyName.toLowerCase();

      // Check for duplicate names
      if (seenNames.has(normalizedName)) {
        errors.push(`Duplicate voice name: ${friendlyName}`);
      }
      seenNames.add(normalizedName);

      // Validate Minimax voice ID format
      const pattern = /^moss_audio_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!pattern.test(minimaxVoiceId)) {
        errors.push(`Invalid voice ID format for '${friendlyName}': ${minimaxVoiceId}`);
      }

      // Check for duplicate IDs
      if (seenIds.has(minimaxVoiceId)) {
        errors.push(`Duplicate voice ID: ${minimaxVoiceId}`);
      }
      seenIds.add(minimaxVoiceId);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
