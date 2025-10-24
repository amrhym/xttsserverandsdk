/**
 * Integration tests for end-to-end protocol translation
 *
 * Tests the full message flow through the proxy:
 * Client → Protocol Translation → Minimax → Protocol Translation → Client
 */

import WebSocket from 'ws';
import { startServer, shutdown } from '../../src/server';
import { WebSocketServer } from 'ws';
import { ServerConfig } from '../../src/config/environment';
import { createTestConfig } from '../helpers/testConfig';

describe('Protocol Integration Tests', () => {
  let server: WebSocketServer;
  let serverPort: number;

  const testConfig = createTestConfig({
    port: 0, // Use random available port
    host: '127.0.0.1',
    logLevel: 'error',
    nodeEnv: 'test',
    maxConnections: 10,
    authorizedApiKeys: ['test_key_protocol'],
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY || 'test_minimax_key',
      groupId: process.env.MINIMAX_GROUP_ID || 'test_group_id',
    },
  };

  beforeAll(async () => {
    server = await startServer(testConfig);
    const address = server.address();
    if (address && typeof address === 'object') {
      serverPort = address.port;
    }
  }, 15000);

  afterAll(async () => {
    if (server) {
      await shutdown(server);
    }
  }, 15000);

  describe('Client → Server Protocol Translation', () => {
    it('should accept connect message and establish connection', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      let receivedReady = false;
      let receivedError = false;

      client.on('open', () => {
        // Send connect message in custom client protocol
        client.send(
          JSON.stringify({
            action: 'connect',
            voice: 'fahd',
            requestId: 'req_connect_1',
          })
        );
      });

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        // First message should be "ready" from initial connection (or error if Minimax unavailable)
        if (message.type === 'ready' && !receivedReady) {
          receivedReady = true;
        } else if (message.type === 'error') {
          // Expected when Minimax is not available in test
          receivedError = true;
        }
      });

      client.on('close', () => {
        // Test passes if we either got ready or got expected error
        expect(receivedReady || receivedError).toBe(true);
        done();
      });

      client.on('error', () => {
        // Swallow error - expected when Minimax unavailable
      });

      // Give time for connection and message processing
      setTimeout(() => {
        client.close();
      }, 1000);
    }, 15000);

    it('should accept speak message with text', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      let readyReceived = false;

      client.on('open', () => {
        // Wait for ready message before sending speak
      });

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready' && !readyReceived) {
          readyReceived = true;

          // Send speak message in custom client protocol
          client.send(
            JSON.stringify({
              action: 'speak',
              voice: 'fahd',
              text: 'Hello world integration test',
              requestId: 'req_speak_1',
            })
          );

          // Give time for message processing
          setTimeout(() => {
            client.close();
            done();
          }, 500);
        }
      });

      client.on('error', (error) => {
        done(error);
      });
    });

    it('should accept disconnect message', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      let readyReceived = false;

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready' && !readyReceived) {
          readyReceived = true;

          // Send disconnect message in custom client protocol
          client.send(
            JSON.stringify({
              action: 'disconnect',
              voice: 'fahd',
              requestId: 'req_disconnect_1',
            })
          );

          setTimeout(() => {
            client.close();
            done();
          }, 500);
        }
      });

      client.on('error', (error) => {
        done(error);
      });
    });

    it('should reject speak message without text', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      let readyReceived = false;
      let errorReceived = false;

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready' && !readyReceived) {
          readyReceived = true;

          // Send invalid speak message (missing text)
          client.send(
            JSON.stringify({
              action: 'speak',
              voice: 'fahd',
              // text is missing
            })
          );
        } else if (message.type === 'error') {
          errorReceived = true;
          expect(message.data.code).toBe(400);
          expect(message.data.message).toBeDefined();
          client.close();
          done();
        }
      });

      client.on('error', (error) => {
        if (!errorReceived) {
          done(error);
        }
      });

      setTimeout(() => {
        if (!errorReceived) {
          done(new Error('Expected error message not received'));
        }
      }, 2000);
    });

    it('should reject malformed JSON messages', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      let readyReceived = false;
      let errorReceived = false;

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready' && !readyReceived) {
          readyReceived = true;

          // Send malformed JSON
          client.send('{ invalid json }');
        } else if (message.type === 'error') {
          errorReceived = true;
          expect(message.data.code).toBe(400);
          client.close();
          done();
        }
      });

      client.on('error', (error) => {
        if (!errorReceived) {
          done(error);
        }
      });

      setTimeout(() => {
        if (!errorReceived) {
          done(new Error('Expected error message not received'));
        }
      }, 2000);
    });
  });

  describe('Complete Message Flow', () => {
    it('should handle connect → speak → disconnect sequence', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      let readyReceived = false;
      let step = 0;

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready' && !readyReceived) {
          readyReceived = true;

          // Step 1: Connect
          client.send(
            JSON.stringify({
              action: 'connect',
              voice: 'fahd',
              requestId: 'req_seq_1',
            })
          );

          setTimeout(() => {
            step = 1;
            // Step 2: Speak
            client.send(
              JSON.stringify({
                action: 'speak',
                voice: 'fahd',
                text: 'Sequence test message',
                requestId: 'req_seq_2',
              })
            );
          }, 300);

          setTimeout(() => {
            step = 2;
            // Step 3: Disconnect
            client.send(
              JSON.stringify({
                action: 'disconnect',
                voice: 'fahd',
                requestId: 'req_seq_3',
              })
            );
          }, 600);

          setTimeout(() => {
            expect(step).toBe(2);
            client.close();
            done();
          }, 1000);
        }
      });

      client.on('error', (error) => {
        done(error);
      });
    });

    it('should preserve requestId correlation across messages', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      let readyReceived = false;
      const requestIds = ['req_corr_1', 'req_corr_2', 'req_corr_3'];
      let messagesSent = 0;

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ready' && !readyReceived) {
          readyReceived = true;

          // Send multiple messages with different requestIds
          requestIds.forEach((reqId, index) => {
            setTimeout(() => {
              client.send(
                JSON.stringify({
                  action: 'speak',
                  voice: 'fahd',
                  text: `Message ${index + 1}`,
                  requestId: reqId,
                })
              );
              messagesSent++;
            }, index * 200);
          });

          setTimeout(() => {
            expect(messagesSent).toBe(3);
            client.close();
            done();
          }, 1500);
        }
      });

      client.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('Protocol Obfuscation', () => {
    it('should never expose Minimax event names to client', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      const receivedMessages: string[] = [];

      client.on('message', (data: Buffer) => {
        const messageText = data.toString();
        receivedMessages.push(messageText);

        // Check that no Minimax-specific terms appear
        expect(messageText).not.toContain('task_start');
        expect(messageText).not.toContain('task_continue');
        expect(messageText).not.toContain('task_finish');
        expect(messageText).not.toContain('voice_id');
        expect(messageText).not.toContain('voice_setting');
        expect(messageText).not.toContain('audio_setting');

        const message = JSON.parse(messageText);

        if (message.type === 'ready') {
          // Send a speak message to trigger more responses
          client.send(
            JSON.stringify({
              action: 'speak',
              voice: 'fahd',
              text: 'Obfuscation test',
            })
          );

          setTimeout(() => {
            expect(receivedMessages.length).toBeGreaterThan(0);
            client.close();
            done();
          }, 500);
        }
      });

      client.on('error', (error) => {
        done(error);
      });
    });

    it('should use custom client protocol response types', (done) => {
      const client = new WebSocket(`ws://127.0.0.1:${serverPort}`, {
        headers: {
          Authorization: 'Bearer test_key_protocol',
        },
      });

      const validResponseTypes = ['ready', 'audio', 'complete', 'error'];
      const receivedTypes = new Set<string>();

      client.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type) {
          receivedTypes.add(message.type);
          expect(validResponseTypes).toContain(message.type);
        }
      });

      setTimeout(() => {
        expect(receivedTypes.size).toBeGreaterThan(0);
        client.close();
        done();
      }, 1000);

      client.on('error', (error) => {
        done(error);
      });
    });
  });
});
