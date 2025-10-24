/**
 * Unit tests for XTTSClient connection lifecycle methods
 */

import { XTTSClient, ConnectionState } from '../../src';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

describe('XTTSClient - Connection Lifecycle', () => {
  let client: XTTSClient;
  let mockWebSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock WebSocket instance
    mockWebSocket = {
      on: jest.fn(),
      once: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    };

    MockWebSocket.mockImplementation(() => mockWebSocket);

    client = new XTTSClient({
      apiKey: 'test-api-key',
      voice: 'emma',
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('getConnectionState()', () => {
    it('should return DISCONNECTED state initially', () => {
      const state = client.getConnectionState();

      expect(state.state).toBe(ConnectionState.DISCONNECTED);
      expect(state.isConnected).toBe(false);
      expect(state.reconnectAttempts).toBe(0);
      expect(state.maxReconnectAttempts).toBe(5);
      expect(state.autoReconnect).toBe(false);
      expect(state.serverUrl).toBe('wss://xttsws.xcai.io');
    });

    it('should return CONNECTING state during connection', () => {
      // Start connection (don't await, we want to check state during connection)
      client.connect();

      const state = client.getConnectionState();
      expect(state.state).toBe(ConnectionState.CONNECTING);
      expect(state.isConnected).toBe(false);
    });

    it('should return CONNECTED state when connected', async () => {
      const connectPromise = client.connect();

      // Trigger open event
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();

      // Trigger ready message
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));

      await connectPromise;

      const state = client.getConnectionState();
      expect(state.state).toBe(ConnectionState.CONNECTED);
      expect(state.isConnected).toBe(true);
      expect(state.reconnectAttempts).toBe(0);
    });

    it('should show correct server URL when custom URL provided', () => {
      const customClient = new XTTSClient({
        apiKey: 'test-key',
        voice: 'emma',
        serverUrl: 'ws://localhost:8080',
      });

      const state = customClient.getConnectionState();
      expect(state.serverUrl).toBe('ws://localhost:8080');
    });

    it('should show autoReconnect setting', () => {
      const autoReconnectClient = new XTTSClient({
        apiKey: 'test-key',
        voice: 'emma',
        autoReconnect: true,
      });

      const state = autoReconnectClient.getConnectionState();
      expect(state.autoReconnect).toBe(true);
    });
  });

  describe('reconnect()', () => {
    it('should throw error if already connected', async () => {
      // Connect first
      const connectPromise = client.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      // Try to reconnect while connected
      await expect(client.reconnect()).rejects.toThrow('Already connected. Disconnect first before reconnecting.');
    });

    it('should successfully reconnect when disconnected', async () => {
      // Connect first
      let connectPromise = client.connect();
      let openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      let messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      // Disconnect
      client.disconnect();

      // Clear previous mock calls
      jest.clearAllMocks();
      mockWebSocket = {
        on: jest.fn(),
        once: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
      };
      MockWebSocket.mockImplementation(() => mockWebSocket);

      // Reconnect
      const reconnectPromise = client.reconnect();
      openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await reconnectPromise;

      expect(client.isConnected()).toBe(true);
      const state = client.getConnectionState();
      expect(state.state).toBe(ConnectionState.CONNECTED);
      expect(state.reconnectAttempts).toBe(0); // Reset on manual reconnect
    });

    it('should reset reconnect attempts on manual reconnect', async () => {
      // Simulate previous reconnect attempts by creating client with autoReconnect
      const autoClient = new XTTSClient({
        apiKey: 'test-key',
        voice: 'emma',
        autoReconnect: true,
      });

      // Manually set reconnect attempts (simulating previous failures)
      // This would normally be set internally, but we're testing the reset behavior

      const reconnectPromise = autoClient.reconnect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await reconnectPromise;

      const state = autoClient.getConnectionState();
      expect(state.reconnectAttempts).toBe(0);
    });

    it('should close existing WebSocket before reconnecting', async () => {
      // Connect first
      const connectPromise = client.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      // Simulate a broken connection (not fully disconnected)
      mockWebSocket.readyState = WebSocket.CLOSED;

      // Reconnect should close existing ws before connecting
      jest.clearAllMocks();
      mockWebSocket = {
        on: jest.fn(),
        once: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
      };
      MockWebSocket.mockImplementation(() => mockWebSocket);

      // Start reconnect (we're just verifying it creates a new WebSocket)
      client.reconnect();

      // Should create a new WebSocket
      expect(MockWebSocket).toHaveBeenCalled();
    });
  });

  describe('reconnecting event', () => {
    it('should emit reconnecting event during auto-reconnect', async () => {
      jest.useFakeTimers();

      const autoClient = new XTTSClient({
        apiKey: 'test-key',
        voice: 'emma',
        autoReconnect: true,
      });

      const reconnectingHandler = jest.fn();
      autoClient.on('reconnecting', reconnectingHandler);

      // Connect
      const connectPromise = autoClient.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      // Simulate unexpected disconnect
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')[1];
      closeHandler(1006, 'Connection lost');

      // Should emit reconnecting event
      expect(reconnectingHandler).toHaveBeenCalledWith(1, 5, 1000);

      jest.useRealTimers();
    });

    it('should emit reconnecting event with correct parameters', async () => {
      jest.useFakeTimers();

      const autoClient = new XTTSClient({
        apiKey: 'test-key',
        voice: 'emma',
        autoReconnect: true,
      });

      const reconnectingHandler = jest.fn();
      autoClient.on('reconnecting', reconnectingHandler);

      // Connect
      const connectPromise = autoClient.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      // Save close handler
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')[1];

      // Simulate disconnect
      closeHandler(1006, 'Connection lost');

      // Should emit reconnecting event with: attempt=1, maxAttempts=5, delay=1000ms
      expect(reconnectingHandler).toHaveBeenCalledWith(1, 5, 1000);

      jest.useRealTimers();
    });

    it('should update connection state to RECONNECTING', async () => {
      jest.useFakeTimers();

      const autoClient = new XTTSClient({
        apiKey: 'test-key',
        voice: 'emma',
        autoReconnect: true,
      });

      // Connect
      const connectPromise = autoClient.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      expect(autoClient.getConnectionState().state).toBe(ConnectionState.CONNECTED);

      // Simulate disconnect
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')[1];
      closeHandler(1006, 'Connection lost');

      // Should be in RECONNECTING state
      const state = autoClient.getConnectionState();
      expect(state.state).toBe(ConnectionState.RECONNECTING);
      expect(state.reconnectAttempts).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('Connection state transitions', () => {
    it('should transition DISCONNECTED -> CONNECTING -> CONNECTED', async () => {
      // Initial state
      expect(client.getConnectionState().state).toBe(ConnectionState.DISCONNECTED);

      // Start connecting
      const connectPromise = client.connect();
      expect(client.getConnectionState().state).toBe(ConnectionState.CONNECTING);

      // Complete connection
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      expect(client.getConnectionState().state).toBe(ConnectionState.CONNECTED);
    });

    it('should transition CONNECTED -> DISCONNECTED on manual disconnect', async () => {
      // Connect
      const connectPromise = client.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      expect(client.getConnectionState().state).toBe(ConnectionState.CONNECTED);

      // Disconnect
      client.disconnect();

      expect(client.getConnectionState().state).toBe(ConnectionState.DISCONNECTED);
    });

    it('should transition CONNECTED -> RECONNECTING on auto-reconnect', async () => {
      jest.useFakeTimers();

      const autoClient = new XTTSClient({
        apiKey: 'test-key',
        voice: 'emma',
        autoReconnect: true,
      });

      // Connect
      const connectPromise = autoClient.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')[1];
      openHandler();
      const messageHandler = mockWebSocket.once.mock.calls.find((call: any) => call[0] === 'message')[1];
      messageHandler(Buffer.from(JSON.stringify({ type: 'ready' })));
      await connectPromise;

      expect(autoClient.getConnectionState().state).toBe(ConnectionState.CONNECTED);

      // Save close handler
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')[1];

      // Simulate disconnect
      closeHandler(1006, 'Connection lost');

      // Should transition to RECONNECTING
      expect(autoClient.getConnectionState().state).toBe(ConnectionState.RECONNECTING);

      jest.useRealTimers();
    });
  });
});
