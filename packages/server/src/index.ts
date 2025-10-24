/**
 * XTTS Server Entry Point
 *
 * Starts both WebSocket server and HTTP API server
 */

import { startServer, shutdown } from './server';
import { ApiKeyManager } from './auth/ApiKeyManager';
import { ApiServer } from './api/ApiServer';
import { loadConfig } from './config/environment';
import { log } from './utils/logger';
import { WebSocketServer } from 'ws';

const COMPONENT = 'Main';

async function main() {
  let wss: WebSocketServer | null = null;
  let apiServer: ApiServer | null = null;

  try {
    // Load configuration
    const config = loadConfig();

    log.info('Starting XTTS Server', COMPONENT);

    // Initialize API key manager
    const keyManager = new ApiKeyManager('./data/api-keys.json');
    await keyManager.initialize();

    // Update server config with active keys
    const activeKeys = keyManager.getActiveKeys();
    if (activeKeys.length === 0) {
      log.warn('No active API keys found', COMPONENT);
      log.info('Generate a key using: node scripts/generate-api-key.js "Client Name"', COMPONENT);
    } else {
      log.info('Loaded active API keys', COMPONENT, { count: activeKeys.length });
    }

    // Update authorized keys
    config.authorizedApiKeys = activeKeys;

    // Start HTTP API server for key management
    apiServer = new ApiServer(keyManager, {
      port: config.port,
      host: config.host,
    });
    await apiServer.start();

    // Start WebSocket server
    wss = await startServer(config);

    log.info('All servers started successfully', COMPONENT, {
      wsPort: config.port,
      apiPort: config.port,
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      log.info(`Received ${signal}, shutting down gracefully`, COMPONENT);

      try {
        if (apiServer) {
          await apiServer.stop();
        }

        if (wss) {
          await shutdown(wss);
        }

        log.info('Shutdown complete', COMPONENT);
        process.exit(0);
      } catch (error) {
        log.error('Error during shutdown', COMPONENT, {
          error: (error as Error).message,
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    log.error('Failed to start server', COMPONENT, {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  main();
}

export { main };
