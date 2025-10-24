/**
 * XTTS Minimax Proxy Server Entry Point
 *
 * WebSocket server that accepts client connections for TTS requests.
 * Implements complete provider obfuscation through protocol translation.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { loadConfig, ServerConfig } from './config/environment';
import { log } from './utils/logger';
import { AuthManager } from './auth/AuthManager';
import { MinimaxClient } from './minimax/MinimaxClient';
import { ProtocolTranslator } from './protocol/ProtocolTranslator';
import { VoiceMapper } from './voice/VoiceMapper';
import { ClientMessage } from './protocol/types';

const COMPONENT = 'Server';

/**
 * Active WebSocket connections tracking with authentication status and Minimax connection
 */
interface ConnectionInfo {
  socket: WebSocket;
  authenticated: boolean;
  apiKey?: string;
  minimaxClient?: MinimaxClient;
  requestId?: string;
}

const connections = new Map<string, ConnectionInfo>();

/**
 * Generate unique client ID
 */
const generateClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Start the WebSocket server
 */
export const startServer = async (config?: ServerConfig): Promise<WebSocketServer> => {
  // Load configuration
  const serverConfig = config || loadConfig();

  log.info('Starting XTTS Minimax Proxy Server', COMPONENT, {
    port: serverConfig.port,
    host: serverConfig.host,
    maxConnections: serverConfig.maxConnections,
  });

  return new Promise((resolve, reject) => {
    // Initialize authentication manager
    const authManager = new AuthManager(serverConfig.authorizedApiKeys);

    // Initialize voice mapper
    const voiceMapper = new VoiceMapper(serverConfig.voiceMapping);

    // Initialize protocol translator
    const translator = new ProtocolTranslator(voiceMapper);

    // Create WebSocket server
    const wss = new WebSocketServer({
      port: serverConfig.port,
      host: serverConfig.host,
    });

    // Handle server-level errors
    wss.on('error', (error: Error) => {
      log.error('WebSocket server error', COMPONENT, {
        error: error.message,
        stack: error.stack,
      });
      reject(error);
    });

    // Handle new client connections
    wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = generateClientId();

      // Authenticate the connection
      const authHeader = request.headers['authorization'];
      const authResult = authManager.authenticate(authHeader);

      if (!authResult.authenticated) {
        log.warn('Connection rejected: authentication failed', COMPONENT, {
          clientId,
          error: authResult.error,
        });

        // Send error message before closing
        ws.send(
          JSON.stringify({
            error: 'Authentication failed',
            code: 401,
            message: authResult.error,
          })
        );

        // Close connection with policy violation code
        ws.close(1008, authResult.error);
        return;
      }

      // Create Minimax connection for this client
      const minimaxClient = new MinimaxClient(
        {
          apiKey: serverConfig.minimax.apiKey,
          groupId: serverConfig.minimax.groupId,
        },
        clientId
      );

      // Store authenticated connection
      connections.set(clientId, {
        socket: ws,
        authenticated: true,
        apiKey: authResult.apiKey,
        minimaxClient,
      });

      log.info('Client authenticated and connected', COMPONENT, {
        clientId,
        apiKeyLast4: authResult.apiKey?.slice(-4),
        totalConnections: connections.size,
      });

      // Connect to Minimax first, then set up handlers
      minimaxClient
        .connect()
        .then(() => {
          log.info('Minimax connection established for client', COMPONENT, {
            clientId,
          });

          // Set up Minimax message handlers AFTER connection succeeds
          minimaxClient.onMessage((message) => {
            try {
              const connInfo = connections.get(clientId);
              if (!connInfo) return;

              // Skip connected_success event (already handled in connect())
              if (message.event === 'connected_success') {
                return;
              }

              // Translate Minimax response to client protocol
              const clientResponse = translator.translateFromMinimax(message as any, connInfo.requestId);

              // Send translated response to client
              ws.send(JSON.stringify(clientResponse));

              log.debug('Forwarded translated response to client', COMPONENT, {
                clientId,
                responseType: clientResponse.type,
              });
            } catch (error) {
              log.error('Error translating Minimax message', COMPONENT, {
                clientId,
                error: (error as Error).message,
              });
            }
          });

          minimaxClient.onError((error) => {
            log.error('Minimax connection error', COMPONENT, {
              clientId,
              error: error.message,
            });

            // Send generic error to client (obfuscating Minimax)
            ws.send(
              JSON.stringify({
                type: 'error',
                data: {
                  code: 500,
                  message: 'TTS service error',
                },
              })
            );
          });

          minimaxClient.onClose(() => {
            log.info('Minimax connection closed', COMPONENT, { clientId });

            // Close client connection
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(1011, 'TTS service connection closed');
            }

            // Clean up
            connections.delete(clientId);
          });

          // Send ready message to client
          ws.send(
            JSON.stringify({
              type: 'ready',
              data: { message: 'Connected to TTS service' },
            })
          );
        })
        .catch((error: Error) => {
          log.error('Failed to connect to Minimax', COMPONENT, {
            clientId,
            error: error.message,
          });

          // Notify client and close connection
          ws.send(
            JSON.stringify({
              type: 'error',
              data: {
                code: 503,
                message: 'TTS service unavailable',
              },
            })
          );
          ws.close(1011, 'TTS service connection failed');

          // Clean up
          connections.delete(clientId);
        });

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        try {
          const connInfo = connections.get(clientId);
          if (!connInfo || !connInfo.minimaxClient) {
            log.warn('Message received for unknown or uninitialized client', COMPONENT, { clientId });
            return;
          }

          // Parse client message
          const clientMessage: ClientMessage = JSON.parse(data.toString());

          log.debug('Message received from client', COMPONENT, {
            clientId,
            action: clientMessage.action,
            hasText: Boolean(clientMessage.text),
          });

          // Store requestId for correlation
          if (clientMessage.requestId) {
            connInfo.requestId = clientMessage.requestId;
          }

          // Translate client message to Minimax protocol
          const minimaxMessage = translator.translateToMinimax(clientMessage);

          // Forward translated message to Minimax
          connInfo.minimaxClient.send(minimaxMessage);

          log.debug('Forwarded translated message to Minimax', COMPONENT, {
            clientId,
            event: minimaxMessage.event,
          });
        } catch (error) {
          log.error('Error handling client message', COMPONENT, {
            clientId,
            error: (error as Error).message,
          });

          // Send error response to client
          ws.send(
            JSON.stringify({
              type: 'error',
              data: {
                code: 400,
                message: 'Invalid message format',
              },
            })
          );
        }
      });

      // Handle client disconnection
      ws.on('close', (code: number, reason: Buffer) => {
        const connInfo = connections.get(clientId);

        // Close Minimax connection if it exists
        if (connInfo?.minimaxClient) {
          connInfo.minimaxClient.close();
        }

        connections.delete(clientId);
        log.info('Client disconnected', COMPONENT, {
          clientId,
          code,
          reason: reason.toString(),
          totalConnections: connections.size,
        });
      });

      // Handle client errors
      ws.on('error', (error: Error) => {
        log.error('Client WebSocket error', COMPONENT, {
          clientId,
          error: error.message,
        });
      });
    });

    // Server started successfully
    wss.on('listening', () => {
      log.info('WebSocket server listening', COMPONENT, {
        port: serverConfig.port,
        host: serverConfig.host,
      });
      resolve(wss);
    });
  });
};

/**
 * Graceful shutdown handler
 */
export const shutdown = (wss: WebSocketServer): Promise<void> => {
  return new Promise((resolve) => {
    log.info('Shutting down server gracefully', COMPONENT, {
      activeConnections: connections.size,
    });

    // Close all active connections
    connections.forEach((connInfo, clientId) => {
      log.debug('Closing client connection', COMPONENT, { clientId });
      connInfo.socket.close(1001, 'Server shutting down');
    });
    connections.clear();

    // Close the server
    wss.close(() => {
      log.info('Server shutdown complete', COMPONENT);
      resolve();
    });
  });
};

// Only start server if this file is run directly
if (require.main === module) {
  let server: WebSocketServer;

  // Start the server
  startServer()
    .then((wss) => {
      server = wss;
    })
    .catch((error: Error) => {
      log.error('Failed to start server', COMPONENT, {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    });

  // Graceful shutdown on SIGTERM/SIGINT
  const gracefulShutdown = (signal: string): void => {
    log.info(`Received ${signal}, shutting down`, COMPONENT);
    if (server) {
      shutdown(server)
        .then(() => {
          process.exit(0);
        })
        .catch((error: Error) => {
          log.error('Error during shutdown', COMPONENT, { error: error.message });
          process.exit(1);
        });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
