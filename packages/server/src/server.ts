/**
 * XTTS Minimax Proxy Server Entry Point
 *
 * WebSocket server that accepts client connections for TTS requests.
 * Implements complete provider obfuscation through protocol translation.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, ServerConfig } from './config/environment';
import { log } from './utils/logger';

const COMPONENT = 'Server';

/**
 * Active WebSocket connections tracking
 */
const connections = new Map<string, WebSocket>();

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
    wss.on('connection', (ws: WebSocket) => {
      const clientId = generateClientId();
      connections.set(clientId, ws);

      log.info('Client connected', COMPONENT, {
        clientId,
        totalConnections: connections.size,
      });

      // Handle messages from client
      ws.on('message', (data: Buffer) => {
        log.debug('Message received from client', COMPONENT, {
          clientId,
          dataLength: data.length,
        });

        // Message handling will be implemented in later stories
        // For now, just acknowledge receipt
        ws.send(JSON.stringify({ status: 'received' }));
      });

      // Handle client disconnection
      ws.on('close', (code: number, reason: Buffer) => {
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
    connections.forEach((ws, clientId) => {
      log.debug('Closing client connection', COMPONENT, { clientId });
      ws.close(1001, 'Server shutting down');
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
