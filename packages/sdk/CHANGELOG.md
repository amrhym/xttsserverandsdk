# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-24

### Added

#### Core Features
- Initial release of XTTS SDK
- WebSocket-based client for XTTS text-to-speech proxy server
- Complete provider obfuscation - client never knows which TTS provider is used
- Full TypeScript support with comprehensive type definitions

#### Synthesis Methods
- `synthesize()` - Buffer collection mode for complete audio
- `synthesizeStream()` - Callback-based streaming for real-time audio delivery
- `synthesizeToFile()` - Direct file writing for memory-efficient long-form synthesis
- `cancelStream()` - Cancel active streaming synthesis requests

#### Connection Management
- `connect()` - Establish WebSocket connection to XTTS server
- `disconnect()` - Gracefully close connection
- `isConnected()` - Check current connection status
- `getConnectionState()` - Get detailed connection state information
- `reconnect()` - Manual reconnection trigger
- Auto-reconnection with exponential backoff (optional)
- Connection state tracking: DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING

#### Event System
- `connected` - Emitted when connection is established and ready
- `disconnected` - Emitted when connection closes
- `reconnecting` - Emitted during auto-reconnection attempts
- `audioChunk` - Emitted for each audio chunk received
- `complete` - Emitted when synthesis completes
- `error` - Emitted on errors with categorization

#### Error Handling
- Comprehensive error categorization system
- Six error categories: AUTH, VALIDATION, TIMEOUT, CONNECTION, SERVER, CLIENT
- Automatic error classification based on HTTP status codes
- `ErrorData` includes error category and original error object
- Request-specific error correlation with request IDs

#### Configuration
- API key authentication
- Voice selection
- Optional custom server URL (defaults to `wss://xttsws.xcai.io`)
- Configurable connection timeout
- Optional auto-reconnection

#### TypeScript Support
- Full type definitions for all APIs
- Exported enums: `ConnectionState`, `ErrorCategory`
- Exported interfaces for all configuration and event types
- Type-safe event emitter methods

### Documentation
- Comprehensive README with usage examples
- API reference documentation
- Quick start guide
- Advanced usage examples
- TypeScript type documentation

### Testing
- 146+ unit tests
- 100% code coverage
- Tests for all synthesis methods
- Connection lifecycle tests
- Error handling tests
- Event forwarding tests

### Technical Details
- Minimum Node.js version: 18.0.0
- TypeScript 5.3+
- WebSocket protocol for real-time communication
- Buffer-based audio handling
- Request ID correlation for concurrent requests
- Timeout handling for all operations
- Proper resource cleanup on disconnect

## [Unreleased]

### Planned
- Browser support (currently Node.js only)
- Audio format selection
- Voice cloning support
- Rate limiting helpers
- Retry strategies
- Circuit breaker pattern
- Metrics and telemetry

---

[1.0.0]: https://github.com/yourusername/xtts-minimax-proxy/releases/tag/v1.0.0
