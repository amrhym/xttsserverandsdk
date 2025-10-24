/**
 * Custom Client Protocol Types
 *
 * This protocol completely abstracts away Minimax, providing a clean
 * interface for TTS operations without exposing provider details.
 */

export type ClientAction = 'connect' | 'speak' | 'disconnect';

export interface ClientMessage {
  action: ClientAction;
  voice: string;        // Friendly name like "fahd"
  text?: string;        // Required for 'speak', optional otherwise
  requestId?: string;   // Optional correlation ID
}

export type ClientResponseType = 'ready' | 'audio' | 'complete' | 'error';

export interface ClientResponse {
  type: ClientResponseType;
  data?: unknown;       // Audio buffer, error details, etc.
  requestId?: string;
}

/**
 * Minimax Protocol Types
 *
 * Based on Minimax API documentation for WebSocket T2A v2 endpoint.
 * These types are NEVER exposed to clients.
 */

export type MinimaxEvent = 'task_start' | 'task_continue' | 'task_finish';

export interface VoiceSetting {
  speed: number;   // 0.5 - 2.0
  vol: number;     // 0.1 - 10.0
  pitch: number;   // -12 to 12
}

export interface AudioSetting {
  sample_rate: number;  // 8000, 16000, 22050, 24000, 32000, 44100, 48000
  bitrate: number;      // 64000, 128000, 256000
  format: 'mp3' | 'pcm' | 'wav';
  channel: 1 | 2;
}

export interface MinimaxTaskStart {
  event: 'task_start';
  voice_id: string;
  voice_setting: VoiceSetting;
  audio_setting: AudioSetting;
}

export interface MinimaxTaskContinue {
  event: 'task_continue';
  text: string;
}

export interface MinimaxTaskFinish {
  event: 'task_finish';
}

export type MinimaxClientMessage = MinimaxTaskStart | MinimaxTaskContinue | MinimaxTaskFinish;

export interface MinimaxDataResponse {
  event: 'data';
  data: {
    audio: string;      // Hex-encoded audio data
    is_final: boolean;
  };
}

export interface MinimaxErrorResponse {
  event: 'error';
  error: {
    code: number;
    message: string;
  };
}

export type MinimaxServerMessage = MinimaxDataResponse | MinimaxErrorResponse;

/**
 * Default audio settings for Minimax connections
 */
export const DEFAULT_AUDIO_SETTING: AudioSetting = {
  sample_rate: 32000,
  bitrate: 128000,
  format: 'mp3',
  channel: 1,
};

/**
 * Default voice settings for Minimax connections
 */
export const DEFAULT_VOICE_SETTING: VoiceSetting = {
  speed: 1.0,
  vol: 1.0,
  pitch: 0,
};
