# XTTS Minimax Proxy - Deployment Guide

Complete guide for deploying the XTTS WebSocket proxy server and SDK.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Server Deployment](#server-deployment)
- [SDK Publishing](#sdk-publishing)
- [Production Configuration](#production-configuration)
- [Security Considerations](#security-considerations)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The XTTS Minimax Proxy consists of two main components:

1. **WebSocket Server** - Proxy server that interfaces with Minimax TTS API
2. **SDK (npm package)** - Client library for connecting to the WebSocket server

```
┌─────────────┐          ┌──────────────────┐          ┌─────────────┐
│   Client    │          │  XTTS WebSocket  │          │   Minimax   │
│ Application │ ◄─────► │     Server       │ ◄─────► │  TTS API    │
│  (SDK)      │  WSS    │   (Proxy)        │  HTTPS   │             │
└─────────────┘          └──────────────────┘          └─────────────┘
```

**Key Features:**
- Complete provider obfuscation - clients never know Minimax is being used
- WebSocket-based real-time streaming
- API key authentication
- SSL/TLS encryption
- Auto-reconnection support

---

## Prerequisites

### System Requirements

**Server:**
- Linux server (Ubuntu 20.04+ recommended)
- Node.js >= 18.0.0
- npm >= 9.0.0
- 1GB RAM minimum (2GB recommended)
- SSL certificate (Let's Encrypt recommended)

**Domain:**
- Domain name pointed to your server
- DNS configured (e.g., xttsws.xcai.io)

**API Keys:**
- Minimax API key (from Minimax console)
- Minimax Group ID

### Software Installation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

---

## Server Deployment

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/yourusername/xtts-minimax-proxy.git
cd xtts-minimax-proxy

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Environment Configuration

Create `.env` file in project root:

```bash
# Minimax API Configuration
MINIMAX_API_KEY=your_minimax_api_key_here
MINIMAX_GROUP_ID=your_minimax_group_id_here

# Server Configuration
PORT=8080
HOST=0.0.0.0

# Security
API_KEYS=api-key-1,api-key-2,api-key-3

# Optional: Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Optional: Logging
LOG_LEVEL=info
```

### 3. SSL Certificate Setup

```bash
# Get SSL certificate (replace with your domain)
sudo certbot certonly --nginx -d xttsws.xcai.io

# Certificates will be stored at:
# /etc/letsencrypt/live/xttsws.xcai.io/fullchain.pem
# /etc/letsencrypt/live/xttsws.xcai.io/privkey.pem
```

### 4. Nginx Configuration

Create `/etc/nginx/sites-available/xtts`:

```nginx
upstream xtts_backend {
    server localhost:8080;
    keepalive 64;
}

server {
    listen 80;
    server_name xttsws.xcai.io;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name xttsws.xcai.io;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/xttsws.xcai.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xttsws.xcai.io/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    # WebSocket Configuration
    location / {
        proxy_pass http://xtts_backend;
        proxy_http_version 1.1;

        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;

        # Buffer settings
        proxy_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://xtts_backend/health;
        access_log off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/xtts /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Start Server with PM2

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'xtts-server',
    script: './dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false
  }]
};
```

Start the server:

```bash
# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Check status
pm2 status
pm2 logs xtts-server
```

### 6. Verify Deployment

```bash
# Test WebSocket connection
wscat -c wss://xttsws.xcai.io

# Send test message
> {"action":"connect","voice":"voice_id","apiKey":"your-api-key"}
```

---

## SDK Publishing

### 1. Prepare for Publishing

```bash
cd packages/sdk

# Verify package
npm pack --dry-run

# Run tests
npm test

# Check coverage
npm run test:coverage
```

### 2. Publish to npm

```bash
# Login to npm
npm login

# Publish (public package)
npm publish

# Or publish scoped package
npm publish --access public
```

### 3. Verify Publication

```bash
# Install from npm
npm install xtts-sdk

# Test installation
node -e "console.log(require('xtts-sdk').XTTSClient)"
```

---

## Production Configuration

### Server Hardening

**1. Firewall Configuration:**

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

**2. Rate Limiting:**

Add to Nginx configuration:

```nginx
limit_req_zone $binary_remote_addr zone=xtts_limit:10m rate=10r/s;

server {
    location / {
        limit_req zone=xtts_limit burst=20;
        # ... rest of config
    }
}
```

**3. Connection Limits:**

```nginx
# In http block
limit_conn_zone $binary_remote_addr zone=addr:10m;

# In server block
limit_conn addr 10;
```

### Monitoring Setup

**1. PM2 Monitoring:**

```bash
# Enable PM2 monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

**2. Nginx Access Logs:**

```nginx
access_log /var/log/nginx/xtts-access.log;
error_log /var/log/nginx/xtts-error.log;
```

**3. Application Metrics:**

Add to your server code:

```javascript
// Track connections
let activeConnections = 0;

wss.on('connection', (ws) => {
  activeConnections++;
  console.log(`Active connections: ${activeConnections}`);

  ws.on('close', () => {
    activeConnections--;
  });
});
```

---

## Security Considerations

### API Key Management

**Generate Strong Keys:**

```javascript
const crypto = require('crypto');
const apiKey = crypto.randomBytes(32).toString('hex');
console.log(apiKey);
```

**Environment Variables:**

- Never commit `.env` files
- Use secret management (AWS Secrets Manager, HashiCorp Vault)
- Rotate API keys regularly

### Rate Limiting

Implement both Nginx and application-level rate limiting:

```javascript
// Application-level rate limiting
const rateLimiter = new Map();

function checkRateLimit(apiKey) {
  const now = Date.now();
  const userLimit = rateLimiter.get(apiKey) || { count: 0, resetTime: now + 60000 };

  if (now > userLimit.resetTime) {
    userLimit.count = 0;
    userLimit.resetTime = now + 60000;
  }

  userLimit.count++;
  rateLimiter.set(apiKey, userLimit);

  return userLimit.count <= 100; // 100 requests per minute
}
```

### CORS Configuration

If needed for browser clients:

```javascript
const cors = require('cors');
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true
}));
```

---

## Monitoring and Logging

### Health Check Endpoint

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    connections: activeConnections,
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});
```

### Logging Best Practices

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log all connections
logger.info('WebSocket connection', {
  apiKey: apiKey.substring(0, 8),
  voice: voice,
  timestamp: new Date()
});
```

### Monitoring Tools

**Recommended:**
- PM2 Plus (process monitoring)
- Datadog or New Relic (application monitoring)
- Sentry (error tracking)
- Prometheus + Grafana (metrics)

---

## Troubleshooting

### Common Issues

**1. WebSocket Connection Fails:**

```bash
# Check if server is running
pm2 status

# Check logs
pm2 logs xtts-server

# Test local connection
wscat -c ws://localhost:8080
```

**2. SSL Certificate Issues:**

```bash
# Renew certificate
sudo certbot renew

# Test certificate
sudo certbot certificates
```

**3. High Memory Usage:**

```bash
# Check memory
pm2 monit

# Restart with memory limit
pm2 restart xtts-server --max-memory-restart 500M
```

**4. Rate Limiting Too Strict:**

Adjust in Nginx or application config.

**5. Slow Response Times:**

- Check Minimax API latency
- Increase worker processes
- Optimize buffer sizes

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
export LOG_LEVEL=debug

# Restart server
pm2 restart xtts-server
```

### Useful Commands

```bash
# Check all PM2 processes
pm2 list

# Monitor in real-time
pm2 monit

# Reload without downtime
pm2 reload xtts-server

# View logs
pm2 logs xtts-server --lines 100

# Check Nginx status
sudo systemctl status nginx

# Test Nginx config
sudo nginx -t

# Check open connections
sudo netstat -tulpn | grep 8080
```

---

## Backup and Recovery

### Backup Configuration

```bash
# Backup script
#!/bin/bash
BACKUP_DIR=/backups/xtts
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup code
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /path/to/xtts-minimax-proxy

# Backup .env
cp .env $BACKUP_DIR/.env_$DATE

# Backup Nginx config
cp /etc/nginx/sites-available/xtts $BACKUP_DIR/nginx_$DATE.conf

# Backup PM2 config
pm2 save
cp ~/.pm2/dump.pm2 $BACKUP_DIR/pm2_$DATE.dump

# Keep only last 7 days
find $BACKUP_DIR -mtime +7 -delete
```

### Disaster Recovery

1. Restore code from backup
2. Restore `.env` file
3. Install dependencies: `npm install`
4. Rebuild: `npm run build`
5. Restore Nginx config
6. Restore PM2 config: `pm2 resurrect`
7. Restart services

---

## Performance Optimization

### Server Tuning

```bash
# Increase file descriptor limits
echo "* soft nofile 65535" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65535" | sudo tee -a /etc/security/limits.conf

# Optimize Node.js
export NODE_OPTIONS="--max-old-space-size=2048"
```

### Nginx Tuning

```nginx
# Worker processes
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
}

http {
    # Enable keepalive
    keepalive_timeout 65;
    keepalive_requests 100;
}
```

---

## Support

- **Documentation**: See README.md files
- **Issues**: GitHub Issues
- **Email**: support@yourdomain.com

## License

MIT License - See LICENSE file
