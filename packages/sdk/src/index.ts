/**
 * XTTS Client SDK Entry Point
 *
 * TypeScript client library for connecting to XTTS WebSocket proxy server.
 * Provides a simple, event-driven API for text-to-speech synthesis with
 * complete provider obfuscation.
 *
 * @packageDocumentation
 */

export { XTTSClient } from './XTTSClient';
export {
  XTTSClientConfig,
  XTTSClientEvents,
  AudioChunk,
  CompletionData,
  ErrorData,
  ErrorCategory,
  SynthesisOptions,
  StreamSynthesisOptions,
  FileSynthesisOptions,
  FileSynthesisResult,
  ConnectionState,
  ConnectionInfo,
} from './types';

/**
 * SDK Version
 */
export const version = '1.0.0';
