/**
 * ConnectionManager - Manages active connections and enforces concurrent limits
 *
 * Maintains a pool of active connections (max 100) and a FIFO queue for waiting clients.
 * When a connection closes, the next queued client is automatically promoted.
 */

import { WebSocket } from 'ws';
import { MinimaxClient } from '../minimax/MinimaxClient';
import { log } from '../utils/logger';

const COMPONENT = 'ConnectionManager';

/**
 * Information about an active connection
 */
export interface ConnectionInfo {
  socket: WebSocket;
  authenticated: boolean;
  apiKey?: string;
  minimaxClient?: MinimaxClient;
  requestId?: string;
}

/**
 * Information about a queued connection waiting for a slot
 */
export interface QueuedConnection {
  clientId: string;
  socket: WebSocket;
  apiKey: string;
  queuedAt: number;
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  activeConnections: number;
  queuedConnections: number;
  maxConnections: number;
  averageQueueTimeMs: number;
  maxQueueTimeMs: number;
}

/**
 * ConnectionManager manages the pool of active connections and queuing
 */
export class ConnectionManager {
  private activeConnections: Map<string, ConnectionInfo>;
  private connectionQueue: QueuedConnection[];
  private readonly maxConnections: number;
  private queueWaitTimes: number[]; // Track wait times for promoted connections

  /**
   * Create a new ConnectionManager
   *
   * @param maxConnections - Maximum number of concurrent connections (default 100)
   */
  constructor(maxConnections: number = 100) {
    this.maxConnections = maxConnections;
    this.activeConnections = new Map();
    this.connectionQueue = [];
    this.queueWaitTimes = [];

    log.info('ConnectionManager initialized', COMPONENT, {
      maxConnections: this.maxConnections,
    });
  }

  /**
   * Check if we can accept a new connection immediately
   *
   * @returns true if under the connection limit, false if at capacity
   */
  public canAcceptConnection(): boolean {
    return this.activeConnections.size < this.maxConnections;
  }

  /**
   * Add a new connection (immediately if under limit, or queue if at capacity)
   *
   * @param clientId - Unique client identifier
   * @param info - Connection information
   * @returns true if connected immediately, false if queued
   */
  public addConnection(clientId: string, info: ConnectionInfo): boolean {
    if (this.canAcceptConnection()) {
      this.activeConnections.set(clientId, info);
      log.info('Connection added to active pool', COMPONENT, {
        clientId,
        activeConnections: this.activeConnections.size,
        queuedConnections: this.connectionQueue.length,
      });
      return true; // Connected immediately
    } else {
      // Add to queue
      const queuedConnection: QueuedConnection = {
        clientId,
        socket: info.socket,
        apiKey: info.apiKey!,
        queuedAt: Date.now(),
      };

      this.connectionQueue.push(queuedConnection);

      log.info('Connection added to queue', COMPONENT, {
        clientId,
        queuePosition: this.connectionQueue.length,
        activeConnections: this.activeConnections.size,
      });

      return false; // Queued
    }
  }

  /**
   * Remove a connection and promote next in queue
   *
   * @param clientId - Client ID to remove
   * @returns Next queued connection to promote, or null if queue empty
   */
  public removeConnection(clientId: string): QueuedConnection | null {
    const existed = this.activeConnections.has(clientId);

    if (existed) {
      this.activeConnections.delete(clientId);

      log.info('Connection removed from active pool', COMPONENT, {
        clientId,
        activeConnections: this.activeConnections.size,
        queuedConnections: this.connectionQueue.length,
      });
    }

    // Promote next in queue if available
    if (this.connectionQueue.length > 0) {
      const promoted = this.connectionQueue.shift()!;
      const waitTime = Date.now() - promoted.queuedAt;

      // Track wait time for statistics
      this.queueWaitTimes.push(waitTime);
      // Keep only last 1000 wait times
      if (this.queueWaitTimes.length > 1000) {
        this.queueWaitTimes.shift();
      }

      log.info('Connection promoted from queue', COMPONENT, {
        clientId: promoted.clientId,
        waitTimeMs: waitTime,
        remainingInQueue: this.connectionQueue.length,
        activeConnections: this.activeConnections.size,
      });

      return promoted;
    }

    return null;
  }

  /**
   * Get connection info for a client
   *
   * @param clientId - Client ID
   * @returns Connection info or undefined if not found
   */
  public getConnection(clientId: string): ConnectionInfo | undefined {
    return this.activeConnections.get(clientId);
  }

  /**
   * Check if a client is in the active pool
   *
   * @param clientId - Client ID
   * @returns true if client has an active connection
   */
  public hasConnection(clientId: string): boolean {
    return this.activeConnections.has(clientId);
  }

  /**
   * Check if a client is in the queue
   *
   * @param clientId - Client ID
   * @returns true if client is queued
   */
  public isQueued(clientId: string): boolean {
    return this.connectionQueue.some((conn) => conn.clientId === clientId);
  }

  /**
   * Get queue position for a client (1-indexed)
   *
   * @param clientId - Client ID
   * @returns Queue position (1 = next to be promoted) or -1 if not in queue
   */
  public getQueuePosition(clientId: string): number {
    const index = this.connectionQueue.findIndex((conn) => conn.clientId === clientId);
    return index === -1 ? -1 : index + 1;
  }

  /**
   * Get connection statistics
   *
   * @returns Current connection statistics
   */
  public getStats(): ConnectionStats {
    return {
      activeConnections: this.activeConnections.size,
      queuedConnections: this.connectionQueue.length,
      maxConnections: this.maxConnections,
      averageQueueTimeMs: this.calculateAverageQueueTime(),
      maxQueueTimeMs: this.calculateMaxQueueTime(),
    };
  }

  /**
   * Calculate average queue wait time from recent promotions
   *
   * @returns Average wait time in milliseconds
   */
  private calculateAverageQueueTime(): number {
    if (this.queueWaitTimes.length === 0) {
      return 0;
    }

    const sum = this.queueWaitTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.queueWaitTimes.length);
  }

  /**
   * Calculate maximum queue wait time from recent promotions
   *
   * @returns Maximum wait time in milliseconds
   */
  private calculateMaxQueueTime(): number {
    if (this.queueWaitTimes.length === 0) {
      return 0;
    }

    return Math.max(...this.queueWaitTimes);
  }

  /**
   * Get current queue wait time for oldest queued connection
   *
   * @returns Estimated wait time in milliseconds, or 0 if queue empty
   */
  public getCurrentQueueWaitTime(): number {
    if (this.connectionQueue.length === 0) {
      return 0;
    }

    const oldest = this.connectionQueue[0];
    return Date.now() - oldest.queuedAt;
  }

  /**
   * Graceful shutdown - close all connections and clear queue
   *
   * @returns Promise that resolves when all connections are closed
   */
  public async shutdown(): Promise<void> {
    log.info('Starting graceful shutdown', COMPONENT, {
      activeConnections: this.activeConnections.size,
      queuedConnections: this.connectionQueue.length,
    });

    // Close all active connections
    for (const [clientId, info] of this.activeConnections.entries()) {
      // Close WebSocket
      if (info.socket.readyState === WebSocket.OPEN) {
        info.socket.close(1001, 'Server shutting down');
      }

      // Close Minimax connection (synchronous)
      if (info.minimaxClient) {
        try {
          info.minimaxClient.close();
        } catch (error) {
          log.error('Error closing Minimax connection during shutdown', COMPONENT, {
            clientId,
            error: (error as Error).message,
          });
        }
      }
    }

    // Close all queued connections
    for (const queued of this.connectionQueue) {
      if (queued.socket.readyState === WebSocket.OPEN) {
        queued.socket.close(1001, 'Server shutting down');
      }
    }

    // Clear data structures
    this.activeConnections.clear();
    this.connectionQueue = [];
    this.queueWaitTimes = [];

    log.info('Graceful shutdown complete', COMPONENT);
  }

  /**
   * Get all active connection client IDs
   *
   * @returns Array of active client IDs
   */
  public getActiveClientIds(): string[] {
    return Array.from(this.activeConnections.keys());
  }

  /**
   * Get all queued connection client IDs
   *
   * @returns Array of queued client IDs
   */
  public getQueuedClientIds(): string[] {
    return this.connectionQueue.map((conn) => conn.clientId);
  }
}
