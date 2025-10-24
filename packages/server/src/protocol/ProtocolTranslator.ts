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
import { ErrorSanitizer } from '../error/ErrorSanitizer';
import {
  ClientMessage,
  ClientResponse,
  MinimaxClientMessage,
  MinimaxServerMessage,
  DEFAULT_AUDIO_SETTING,
  DEFAULT_VOICE_SETTING_BASE,
} from './types';

const COMPONENT = 'ProtocolTranslator';

export class ProtocolTranslator {
  private voiceMapper: VoiceMapper;
  private errorSanitizer: ErrorSanitizer;

  constructor(voiceMapper: VoiceMapper) {
    this.voiceMapper = voiceMapper;
    this.errorSanitizer = new ErrorSanitizer();
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
          model: 'speech-2.5-turbo-preview',
          voice_setting: {
            voice_id: voiceId,
            ...DEFAULT_VOICE_SETTING_BASE,
          },
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
      case 'task_continued':
        // Extract hex-encoded audio and convert to Buffer, then to base64 for client
        const audioHex = message.data.audio;
        const audioBuffer = audioHex ? Buffer.from(audioHex, 'hex') : Buffer.alloc(0);
        const audioBase64 = audioBuffer.toString('base64');

        // Check is_final at top level or in data
        const isFinal = message.is_final ?? message.data.is_final ?? false;

        if (isFinal) {
          // Final audio chunk - send complete message with base64-encoded audio
          result = {
            type: 'complete',
            data: { audio: audioBase64 },
            requestId,
          };
        } else {
          // Intermediate audio chunk with base64-encoded audio
          result = {
            type: 'audio',
            data: { audio: audioBase64 },
            requestId,
          };
        }
        break;

      case 'error':
        // Sanitize error message using ErrorSanitizer
        const sanitized = this.errorSanitizer.sanitizeError({
          code: message.error.code,
          message: message.error.message,
        });

        result = {
          type: 'error',
          data: sanitized,
          requestId,
        };
        break;

      case 'task_failed':
        // Handle task_failed events from Minimax
        const failedMessage = message as any;
        const errorCode = failedMessage.base_resp?.status_code || 500;
        const errorMessage = failedMessage.base_resp?.status_msg || 'Task failed';

        const sanitizedFailed = this.errorSanitizer.sanitizeError({
          code: errorCode,
          message: errorMessage,
        });

        result = {
          type: 'error',
          data: sanitizedFailed,
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


}
