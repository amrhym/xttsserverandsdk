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
import { ResponseSanitizer } from './response/ResponseSanitizer';
import { ConnectionManager, ConnectionInfo } from './connection/ConnectionManager';
import { ClientMessage } from './protocol/types';

const COMPONENT = 'Server';

// Module-level connection manager (set during server start)
let connectionManager: ConnectionManager | null = null;

/**
 * Generate unique client ID
 */
const generateClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Connect a client to Minimax and set up message handlers
 * Used for both immediate connections and promoted queued connections
 */
const connectClientToMinimax = async (
  clientId: string,
  ws: WebSocket,
  apiKey: string,
  serverConfig: ServerConfig,
  connectionManager: ConnectionManager,
  translator: ProtocolTranslator,
  responseSanitizer: ResponseSanitizer
): Promise<void> => {
  // Create Minimax connection for this client
  const minimaxClient = new MinimaxClient(
    {
      apiKey: serverConfig.minimax.apiKey,
      groupId: serverConfig.minimax.groupId,
    },
    clientId
  );

  // Update connection info with Minimax client
  // (For immediate connections, the entry doesn't exist yet. For promoted connections, we update the existing queued entry)
  const existingConn = connectionManager.getConnection(clientId);
  if (existingConn) {
    // Promoted from queue - update existing entry
    existingConn.minimaxClient = minimaxClient;
  } else {
    // Immediate connection - add new entry
    const connectionInfo: ConnectionInfo = {
      socket: ws,
      authenticated: true,
      apiKey,
      minimaxClient,
    };
    connectionManager.addConnection(clientId, connectionInfo);
  }

  // Set up Minimax message handlers
  minimaxClient.onMessage((message) => {
    try {
      const connInfo = connectionManager.getConnection(clientId);
      if (!connInfo) return;

      // Skip connected_success event (already handled in connect())
      if (message.event === 'connected_success') {
        return;
      }

      // Translate Minimax response to client protocol
      const clientResponse = translator.translateFromMinimax(message as any, connInfo.requestId);

      // Sanitize response to ensure no provider information leaks
      const sanitizedResponse = responseSanitizer.sanitizeResponse(clientResponse);

      // Send sanitized response to client
      ws.send(JSON.stringify(sanitizedResponse));

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

    // Remove from active connections and check for promotion
    const promoted = connectionManager.removeConnection(clientId);

    if (promoted) {
      // Promote next client in queue
      log.info('Promoting queued connection', COMPONENT, {
        clientId: promoted.clientId,
        queuePosition: 1,
      });

      // Connect promoted client to Minimax
      connectClientToMinimax(
        promoted.clientId,
        promoted.socket,
        promoted.apiKey,
        serverConfig,
        connectionManager,
        translator,
        responseSanitizer
      ).catch((error) => {
        log.error('Failed to connect promoted client', COMPONENT, {
          clientId: promoted.clientId,
          error: (error as Error).message,
        });

        // Notify client and close
        if (promoted.socket.readyState === WebSocket.OPEN) {
          promoted.socket.send(
            JSON.stringify({
              type: 'error',
              data: {
                code: 503,
                message: 'TTS service unavailable',
              },
            })
          );
          promoted.socket.close(1011, 'Failed to connect to TTS service');
        }
      });
    }
  });

  try {
    // Connect to Minimax
    await minimaxClient.connect();

    // Send ready message to client
    ws.send(
      JSON.stringify({
        type: 'ready',
        data: { message: 'Connected to TTS service' },
      })
    );
  } catch (error) {
    log.error('Failed to connect to Minimax', COMPONENT, {
      clientId,
      error: (error as Error).message,
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

    ws.close(1011, 'Failed to connect to TTS service');

    // Remove from connection manager
    connectionManager.removeConnection(clientId);

    throw error;
  }
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

    // Initialize response sanitizer
    const responseSanitizer = new ResponseSanitizer();

    // Initialize connection manager
    const connMgr = new ConnectionManager(serverConfig.maxConnections);
    connectionManager = connMgr; // Store for shutdown

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

      log.info('Client authenticated', COMPONENT, {
        clientId,
        apiKeyLast4: authResult.apiKey?.slice(-4),
      });

      // Check if we can accept the connection or need to queue
      if (connMgr.canAcceptConnection()) {
        // Connect immediately
        log.info('Connecting client immediately', COMPONENT, {
          clientId,
          activeConnections: connMgr.getStats().activeConnections,
        });

        connectClientToMinimax(
          clientId,
          ws,
          authResult.apiKey!,
          serverConfig,
          connMgr,
          translator,
          responseSanitizer
        ).catch((error) => {
          log.error('Failed to connect client', COMPONENT, {
            clientId,
            error: (error as Error).message,
          });
        });
      } else {
        // Add to queue (silent queuing - no status update)
        connMgr.addConnection(clientId, {
          socket: ws,
          authenticated: true,
          apiKey: authResult.apiKey,
        });

        log.info('Client added to queue', COMPONENT, {
          clientId,
          queuePosition: connMgr.getQueuePosition(clientId),
          activeConnections: connMgr.getStats().activeConnections,
        });
      }

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        try {
          const connInfo = connMgr.getConnection(clientId);
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
        const connInfo = connMgr.getConnection(clientId);

        // Close Minimax connection if it exists
        if (connInfo?.minimaxClient) {
          connInfo.minimaxClient.close();
        }

        // Remove from connection manager (handles promotion)
        connMgr.removeConnection(clientId);

        log.info('Client disconnected', COMPONENT, {
          clientId,
          code,
          reason: reason.toString(),
          activeConnections: connMgr.getStats().activeConnections,
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
export const shutdown = async (wss: WebSocketServer): Promise<void> => {
  log.info('Shutting down server gracefully', COMPONENT, {
    activeConnections: connectionManager?.getStats().activeConnections || 0,
    queuedConnections: connectionManager?.getStats().queuedConnections || 0,
  });

  // Close all connections via ConnectionManager
  if (connectionManager) {
    await connectionManager.shutdown();
  }

  // Close the WebSocket server
  return new Promise((resolve) => {
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
