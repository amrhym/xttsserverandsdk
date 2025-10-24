/**
 * Protocol Translator
 *
 * Translates between custom client protocol and Minimax protocol format.
 * This is the CORE obfuscation mechanism - clients never see Minimax
 * event names or message structures.
 *
 * Performance requirement: <10ms per message translation
 */

import { log } from '../utils/logger';
import { VoiceMapper } from '../voice/VoiceMapper';
import {
  ClientMessage,
  ClientResponse,
  MinimaxClientMessage,
  MinimaxServerMessage,
  DEFAULT_AUDIO_SETTING,
  DEFAULT_VOICE_SETTING,
} from './types';

const COMPONENT = 'ProtocolTranslator';

export class ProtocolTranslator {
  private voiceMapper: VoiceMapper;

  constructor(voiceMapper: VoiceMapper) {
    this.voiceMapper = voiceMapper;
  }
  /**
   * Translates client message to Minimax protocol format.
   * Client 'connect' → Minimax 'task_start'
   * Client 'speak' → Minimax 'task_continue'
   * Client 'disconnect' → Minimax 'task_finish'
   */
  public translateToMinimax(message: ClientMessage): MinimaxClientMessage {
    const startTime = performance.now();

    let result: MinimaxClientMessage;

    switch (message.action) {
      case 'connect':
        // Map friendly voice name to Minimax voice_id
        const voiceId = this.voiceMapper.getMinimaxVoiceId(message.voice);
        result = {
          event: 'task_start',
          voice_id: voiceId,
          voice_setting: DEFAULT_VOICE_SETTING,
          audio_setting: DEFAULT_AUDIO_SETTING,
        };
        break;

      case 'speak':
        if (!message.text) {
          throw new Error('Text is required for speak action');
        }
        result = {
          event: 'task_continue',
          text: message.text,
        };
        break;

      case 'disconnect':
        result = {
          event: 'task_finish',
        };
        break;

      default:
        throw new Error(`Unknown action: ${(message as ClientMessage).action}`);
    }

    const elapsed = performance.now() - startTime;
    log.debug(`Translated client → Minimax in ${elapsed.toFixed(2)}ms`, COMPONENT, {
      action: message.action,
      event: result.event,
    });

    return result;
  }

  /**
   * Translates Minimax response to custom client protocol format.
   * Minimax 'data' → Client 'audio'
   * Minimax 'is_final: true' → Client 'complete'
   * Minimax 'error' → Client 'error'
   */
  public translateFromMinimax(message: MinimaxServerMessage, requestId?: string): ClientResponse {
    const startTime = performance.now();

    let result: ClientResponse;

    switch (message.event) {
      case 'data':
        // Extract hex-encoded audio and convert to Buffer
        const audioBuffer = Buffer.from(message.data.audio, 'hex');

        if (message.data.is_final) {
          // Final audio chunk - send complete message
          result = {
            type: 'complete',
            data: { audio: audioBuffer },
            requestId,
          };
        } else {
          // Intermediate audio chunk
          result = {
            type: 'audio',
            data: { audio: audioBuffer },
            requestId,
          };
        }
        break;

      case 'error':
        // Sanitize error message (Story 1.7 will add more comprehensive sanitization)
        result = {
          type: 'error',
          data: {
            code: message.error.code,
            message: this.sanitizeErrorMessage(message.error.message),
          },
          requestId,
        };
        break;

      default:
        throw new Error(`Unknown Minimax event: ${(message as MinimaxServerMessage).event}`);
    }

    const elapsed = performance.now() - startTime;
    log.debug(`Translated Minimax → client in ${elapsed.toFixed(2)}ms`, COMPONENT, {
      event: message.event,
      type: result.type,
    });

    return result;
  }


  /**
   * Basic error message sanitization.
   * Story 1.7 will add comprehensive sanitization rules.
   */
  private sanitizeErrorMessage(message: string): string {
    // Basic sanitization: remove "Minimax" references
    return message.replace(/minimax/gi, 'TTS service');
  }
}
