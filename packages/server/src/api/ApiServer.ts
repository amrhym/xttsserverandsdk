/**
 * HTTP API Server for Management Operations
 *
 * Provides REST API endpoints for API key management, health checks, and monitoring
 */

import * as http from 'http';
import { URL } from 'url';
import { ApiKeyManager } from '../auth/ApiKeyManager';
import { log } from '../utils/logger';

const COMPONENT = 'ApiServer';

export interface ApiServerConfig {
  port: number;
  host: string;
  adminToken?: string; // Optional admin token for protected operations
}

export class ApiServer {
  private server: http.Server | null = null;
  private keyManager: ApiKeyManager;
  private config: ApiServerConfig;

  constructor(keyManager: ApiKeyManager, config: ApiServerConfig) {
    this.keyManager = keyManager;
    this.config = config;
  }

  /**
   * Start the HTTP API server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          log.error('Error handling request', COMPONENT, {
            error: (error as Error).message,
            path: req.url,
          });

          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        });
      });

      this.server.on('error', (error) => {
        log.error('API server error', COMPONENT, {
          error: (error as Error).message,
        });
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        log.info('API server started', COMPONENT, {
          port: this.config.port,
          host: this.config.host,
        });
        resolve();
      });
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          log.info('API server stopped', COMPONENT);
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    log.debug('API request', COMPONENT, {
      method: req.method,
      path,
    });

    try {
      // Route requests
      if (path === '/health' || path === '/api/health') {
        await this.handleHealth(req, res);
      } else if (path === '/api/generate-key') {
        await this.handleGenerateKey(req, res);
      } else if (path === '/api/keys') {
        await this.handleListKeys(req, res);
      } else if (path.startsWith('/api/keys/')) {
        const key = path.substring('/api/keys/'.length);
        await this.handleKeyOperation(req, res, key);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      log.error('Request handler error', COMPONENT, {
        error: (error as Error).message,
        path,
      });

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  /**
   * Health check endpoint
   */
  private async handleHealth(
    _req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'xtts-server',
    }));
  }

  /**
   * Generate new API key
   */
  private async handleGenerateKey(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Read request body
    const body = await this.readBody(req);
    let data: any;

    try {
      data = JSON.parse(body);
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    // Validate required fields
    if (!data.name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Name is required' }));
      return;
    }

    // Generate key
    const apiKey = await this.keyManager.generateKey({
      name: data.name,
      description: data.description,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      rateLimit: data.rateLimit,
    });

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      apiKey: apiKey.key,
      name: apiKey.name,
      description: apiKey.description,
      createdAt: apiKey.createdAt,
      expiresAt: apiKey.expiresAt,
      rateLimit: apiKey.rateLimit,
    }));
  }

  /**
   * List all API keys
   */
  private async handleListKeys(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const keys = this.keyManager.listKeys();

    // Return keys with masked key values
    const maskedKeys = keys.map(k => ({
      key: `${k.key.substring(0, 10)}...${k.key.slice(-4)}`,
      name: k.name,
      description: k.description,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      rateLimit: k.rateLimit,
      isActive: k.isActive,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ keys: maskedKeys }));
  }

  /**
   * Handle operations on specific keys (GET, DELETE)
   */
  private async handleKeyOperation(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    key: string
  ): Promise<void> {
    if (req.method === 'GET') {
      const apiKey = this.keyManager.getKey(key);

      if (!apiKey) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Key not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        key: `${key.substring(0, 10)}...${key.slice(-4)}`,
        name: apiKey.name,
        description: apiKey.description,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
      }));
    } else if (req.method === 'DELETE') {
      const deleted = await this.keyManager.deleteKey(key);

      if (!deleted) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Key not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Key deleted successfully' }));
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
    }
  }

  /**
   * Read request body
   */
  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', () => {
        resolve(body);
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }
}
