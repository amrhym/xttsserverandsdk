/**
 * Winston Logger Configuration
 *
 * Provides structured logging with JSON format for production
 * and human-readable format for development.
 *
 * Critical Rule: NEVER use console.log - always use this logger
 */

import winston from 'winston';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

// Development format - human readable
const devFormat = printf(({ level, message, timestamp, component, ...metadata }) => {
  let log = `${timestamp} [${level}]`;
  if (component) {
    log += ` [${component}]`;
  }
  log += `: ${message}`;

  // Add metadata if present
  if (Object.keys(metadata).length > 0) {
    log += ` ${JSON.stringify(metadata)}`;
  }

  return log;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  defaultMeta: { service: 'xtts-proxy-server' },
  transports: [],
});

// Add transports based on environment
if (process.env.NODE_ENV === 'production') {
  // Production: JSON format for log aggregation
  logger.add(
    new winston.transports.Console({
      format: combine(json()),
    })
  );

  // TODO: Add file transport in production deployment
  // logger.add(new winston.transports.File({ filename: 'error.log', level: 'error' }));
  // logger.add(new winston.transports.File({ filename: 'combined.log' }));
} else {
  // Development: Colorized, human-readable format
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), devFormat),
    })
  );
}

/**
 * Log with component context
 */
export const log = {
  error: (message: string, component: string, metadata?: Record<string, unknown>): void => {
    logger.error(message, { component, ...metadata });
  },
  warn: (message: string, component: string, metadata?: Record<string, unknown>): void => {
    logger.warn(message, { component, ...metadata });
  },
  info: (message: string, component: string, metadata?: Record<string, unknown>): void => {
    logger.info(message, { component, ...metadata });
  },
  debug: (message: string, component: string, metadata?: Record<string, unknown>): void => {
    logger.debug(message, { component, ...metadata });
  },
};

export default logger;
