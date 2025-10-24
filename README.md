# XTTS Minimax Proxy

A WebSocket-based TTS (Text-to-Speech) proxy service that provides complete provider obfuscation through custom protocol translation, voice ID mapping, and multi-layer sanitization.

## Overview

XTTS Minimax Proxy enables developers to integrate high-quality TTS capabilities without vendor lock-in or credential exposure. The system consists of:

- **Proxy Server**: Node.js WebSocket server that translates custom protocols, manages connections, and handles provider obfuscation
- **Client SDK**: npm-distributed TypeScript SDK providing simple API for TTS integration

## Features

- ✅ **Complete Provider Obfuscation**: No provider references in code, errors, or network traffic
- ✅ **Real-time Streaming**: <100ms latency overhead with WebSocket streaming
- ✅ **Scalable Architecture**: 100 concurrent connections with queue-based overflow handling
- ✅ **Developer-Friendly SDK**: <15 minute time-to-first-synthesis
- ✅ **Type-Safe**: Full TypeScript support with strict mode enabled
- ✅ **Production-Ready**: Comprehensive testing, logging, and error handling

## Architecture

```
Client Application
    ↓
XTTS SDK (npm package)
    ↓ WebSocket (wss://)
Proxy Server
    ↓ Protocol Translation
Minimax TTS API (hidden)
```

## Quick Start

### Prerequisites

- Node.js 18.x LTS or higher
- npm 9.x or higher

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd xtts-minimax-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your Minimax credentials and API keys
```

4. Build all packages:
```bash
npm run build
```

### Development

Start the development server:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

Run linting:
```bash
npm run lint
```

## Project Structure

```
xtts-minimax-proxy/
├── packages/
│   ├── server/              # Proxy server
│   │   ├── src/             # Source code
│   │   ├── test/            # Tests
│   │   └── package.json
│   └── sdk/                 # Client SDK
│       ├── src/             # Source code
│       ├── test/            # Tests
│       ├── examples/        # Usage examples
│       └── package.json
├── docs/                    # Documentation
├── package.json             # Root package (workspaces)
├── tsconfig.json            # Shared TypeScript config
└── .env.example             # Environment template
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MINIMAX_API_KEY` | Minimax API key | Yes |
| `MINIMAX_GROUP_ID` | Minimax group ID | Yes |
| `SERVER_PORT` | Proxy server port (default: 8080) | No |
| `MAX_CONNECTIONS` | Max concurrent connections (default: 100) | No |
| `AUTHORIZED_API_KEYS` | Comma-separated list of authorized API keys | Yes |
| `LOG_LEVEL` | Logging level (info, debug, error) | No |
| `NODE_ENV` | Environment (development, production) | No |

## SDK Usage

Install the SDK:
```bash
npm install @yourorg/xtts-sdk
```

Basic usage:
```typescript
import { XTTSClient } from '@yourorg/xtts-sdk';

const client = new XTTSClient({
  serverUrl: 'wss://your-proxy-server.com',
  apiKey: 'your-api-key'
});

await client.initialize();

// Simple synthesis
const audioBuffer = await client.synthesize('Hello world');

// Streaming synthesis
await client.synthesizeToStream('Hello world', (chunk) => {
  // Process audio chunk
});

// Save to file
await client.synthesizeToFile('Hello world', './output.mp3');

await client.close();
```

## Development Workflow

### Monorepo Commands

- `npm run build` - Build all packages
- `npm run dev` - Start server in development mode
- `npm run test` - Run all tests
- `npm run lint` - Lint all packages
- `npm run clean` - Clean build artifacts

### Package-Specific Commands

Server:
```bash
cd packages/server
npm run dev        # Start with hot-reload
npm run build      # Build TypeScript
npm test           # Run tests
```

SDK:
```bash
cd packages/sdk
npm run build      # Build TypeScript
npm test           # Run tests
```

## Testing

- **Unit Tests**: >80% coverage requirement
- **Integration Tests**: Full WebSocket flow testing
- **Load Tests**: 100+ concurrent connection validation

Run tests with coverage:
```bash
npm run test -- --coverage
```

## Deployment

See [docs/architecture.md](docs/architecture.md) for deployment strategy and infrastructure requirements.

## Documentation

- [Product Requirements Document](docs/prd.md)
- [Architecture Document](docs/architecture.md)
- [Project Brief](docs/brief.md)
- [Brainstorming Session Results](docs/brainstorming-session-results.md)

## Contributing

1. Create a feature branch
2. Make changes with tests
3. Run `npm run lint` and `npm test`
4. Submit pull request

## License

MIT
