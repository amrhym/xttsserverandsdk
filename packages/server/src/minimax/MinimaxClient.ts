/**
 * MinimaxClient - WebSocket Connection to Minimax TTS API
 *
 * Manages WebSocket connection to Minimax API for TTS requests.
 * Handles connection lifecycle, authentication, and message forwarding.
 */

import WebSocket from 'ws';
import { log } from '../utils/logger';

const COMPONENT = 'MinimaxClient';

export interface MinimaxConfig {
  apiKey: string;
  groupId: string;
}

export interface MinimaxMessage {
  event?: string;
  data?: any;
  [key: string]: any;
}

/**
 * MinimaxClient handles WebSocket connection to Minimax TTS API
 */
export class MinimaxClient {
  private ws: WebSocket | null = null;
  private config: MinimaxConfig;
  private connected: boolean = false;
  private clientId: string;

  constructor(config: MinimaxConfig, clientId: string) {
    this.config = config;
    this.clientId = clientId;
  }

  /**
   * Connect to Minimax WebSocket API
   */
  public async connect(): Promise<void> {
    const url = `wss://api.minimax.io/ws/v1/t2a_v2?GroupId=${this.config.groupId}`;

    log.info('Connecting to Minimax API', COMPONENT, {
      clientId: this.clientId,
      url: url.replace(this.config.groupId, '***'),
    });

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
        });

        // Connection opened
        this.ws.on('open', () => {
          log.info('Minimax WebSocket connection opened', COMPONENT, {
            clientId: this.clientId,
          });
        });

        // Handle messages from Minimax
        this.ws.on('message', (data: Buffer) => {
          try {
            const message: MinimaxMessage = JSON.parse(data.toString());

            // Handle connected_success event
            if (message.event === 'connected_success') {
              this.connected = true;
              log.info('Minimax connection successful', COMPONENT, {
                clientId: this.clientId,
              });
              resolve();
            }

            // Log other messages
            log.debug('Message received from Minimax', COMPONENT, {
              clientId: this.clientId,
              event: message.event,
            });
          } catch (error) {
            log.error('Failed to parse Minimax message', COMPONENT, {
              clientId: this.clientId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });

        // Handle connection errors
        this.ws.on('error', (error: Error) => {
          log.error('Minimax WebSocket error', COMPONENT, {
            clientId: this.clientId,
            error: error.message,
          });

          if (!this.connected) {
            reject(error);
          }
        });

        // Handle connection close
        this.ws.on('close', (code: number, reason: Buffer) => {
          this.connected = false;
          log.info('Minimax WebSocket connection closed', COMPONENT, {
            clientId: this.clientId,
            code,
            reason: reason.toString(),
          });
        });

        // Set timeout for connection
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Minimax connection timeout after 10 seconds'));
          }
        }, 10000);
      } catch (error) {
        log.error('Failed to create Minimax WebSocket', COMPONENT, {
          clientId: this.clientId,
          error: error instanceof Error ? error.message : String(error),
        });
        reject(error);
      }
    });
  }

  /**
   * Send message to Minimax
   */
  public send(data: string | Buffer | object): void {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to Minimax');
    }

    // If data is an object, stringify it
    const payload = typeof data === 'object' && !(data instanceof Buffer)
      ? JSON.stringify(data)
      : data;

    this.ws.send(payload);
    log.debug('Message sent to Minimax', COMPONENT, {
      clientId: this.clientId,
      dataLength: typeof payload === 'string' ? payload.length : payload.length,
    });
  }

  /**
   * Register message handler
   */
  public onMessage(handler: (message: MinimaxMessage) => void): void {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    this.ws.on('message', (data: Buffer) => {
      try {
        const message: MinimaxMessage = JSON.parse(data.toString());
        handler(message);
      } catch (error) {
        log.error('Failed to parse Minimax message in handler', COMPONENT, {
          clientId: this.clientId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  /**
   * Register close handler
   */
  public onClose(handler: (code: number, reason: Buffer) => void): void {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    this.ws.on('close', handler);
  }

  /**
   * Register error handler
   */
  public onError(handler: (error: Error) => void): void {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    this.ws.on('error', handler);
  }

  /**
   * Close connection to Minimax
   */
  public close(): void {
    if (this.ws) {
      log.info('Closing Minimax connection', COMPONENT, {
        clientId: this.clientId,
      });

      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  /**
   * Check if connected to Minimax
   */
  public isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get underlying WebSocket instance (for testing)
   */
  public getWebSocket(): WebSocket | null {
    return this.ws;
  }
}
