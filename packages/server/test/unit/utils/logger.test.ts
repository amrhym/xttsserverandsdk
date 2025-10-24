/**
 * Logger Unit Tests
 *
 * Tests for Winston logger configuration
 */

import { log } from '../../../src/utils/logger';
import winston from 'winston';

describe('Logger', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on winston logger methods
    logSpy = jest.spyOn(winston.Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe('log.info', () => {
    it('should log info messages with component', () => {
      log.info('Test message', 'TestComponent');

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Test message',
        expect.objectContaining({
          component: 'TestComponent',
        })
      );
    });

    it('should log info messages with component and metadata', () => {
      log.info('Test message', 'TestComponent', { key: 'value' });

      expect(logSpy).toHaveBeenCalledWith(
        'info',
        'Test message',
        expect.objectContaining({
          component: 'TestComponent',
          key: 'value',
        })
      );
    });
  });

  describe('log.error', () => {
    it('should log error messages with component', () => {
      log.error('Error message', 'TestComponent');

      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'Error message',
        expect.objectContaining({
          component: 'TestComponent',
        })
      );
    });

    it('should log error messages with metadata', () => {
      log.error('Error message', 'TestComponent', { error: 'details' });

      expect(logSpy).toHaveBeenCalledWith(
        'error',
        'Error message',
        expect.objectContaining({
          component: 'TestComponent',
          error: 'details',
        })
      );
    });
  });

  describe('log.warn', () => {
    it('should log warning messages with component', () => {
      log.warn('Warning message', 'TestComponent');

      expect(logSpy).toHaveBeenCalledWith(
        'warn',
        'Warning message',
        expect.objectContaining({
          component: 'TestComponent',
        })
      );
    });
  });

  describe('log.debug', () => {
    it('should log debug messages with component', () => {
      log.debug('Debug message', 'TestComponent');

      expect(logSpy).toHaveBeenCalledWith(
        'debug',
        'Debug message',
        expect.objectContaining({
          component: 'TestComponent',
        })
      );
    });
  });
});
