# XTTS Minimax Proxy

Complete WebSocket-based text-to-speech proxy server with client SDK for Minimax TTS API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

## Overview

XTTS Minimax Proxy provides complete provider obfuscation for text-to-speech services. Clients connect via WebSocket and never know that Minimax TTS is being used.

## Quick Start

### SDK Installation

```bash
npm install xtts-sdk
```

### Basic Usage

```typescript
import { XTTSClient } from 'xtts-sdk';

const client = new XTTSClient({
  apiKey: 'your-api-key',
  voice: 'emma'
});

await client.connect();
const audio = await client.synthesize({ text: 'Hello!' });
client.disconnect();
```

## Documentation

- [SDK Documentation](./packages/sdk/README.md)
- [API Reference](./packages/sdk/API.md)
- [Examples](./packages/sdk/examples/)
- [Deployment Guide](./DEPLOYMENT-GUIDE.md)

## License

MIT
