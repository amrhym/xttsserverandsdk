# Nginx + Let's Encrypt SSL Setup for XTTS Proxy

This guide explains how to configure Nginx as a reverse proxy with SSL/TLS encryption using Let's Encrypt for the XTTS WebSocket server.

## Architecture

```
Internet (wss://xttsws.xcai.io)
         ↓
    Nginx (443) + SSL
         ↓
  XTTS Server (8080)
```

## Prerequisites

- Ubuntu/Debian server with root access
- Domain name `xttsws.xcai.io` pointing to your server's IP address
- Ports 80 and 443 open in firewall
- XTTS server running on `localhost:8080`

## Step 1: Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

## Step 2: Install Certbot (Let's Encrypt client)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

## Step 3: Configure Nginx for XTTS WebSocket Proxy

Create Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/xtts-proxy
```

Add the following configuration:

```nginx
# /etc/nginx/sites-available/xtts-proxy

# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name xttsws.xcai.io;

    # Allow Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server - WebSocket proxy
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name xttsws.xcai.io;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/xttsws.xcai.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/xttsws.xcai.io/privkey.pem;

    # SSL configuration - Mozilla Intermediate (recommended)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # HSTS (optional, but recommended)
    add_header Strict-Transport-Security "max-age=63072000" always;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/xttsws.xcai.io/chain.pem;

    # Resolver for OCSP stapling
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Access and error logs
    access_log /var/log/nginx/xtts-proxy-access.log;
    error_log /var/log/nginx/xtts-proxy-error.log;

    # WebSocket proxy configuration
    location / {
        # Proxy to XTTS server on localhost:8080
        proxy_pass http://localhost:8080;

        # WebSocket headers
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeouts (adjust as needed)
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 60s;

        # Buffering settings for WebSocket
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint (optional)
    location /health {
        access_log off;
        return 200 "OK\n";
        add_header Content-Type text/plain;
    }
}
```

## Step 4: Enable the Configuration

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/xtts-proxy /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t
```

## Step 5: Obtain SSL Certificate with Let's Encrypt

**Important**: Make sure your domain `xttsws.xcai.io` is pointing to your server's IP address before running this command.

```bash
# Obtain certificate and configure Nginx automatically
sudo certbot --nginx -d xttsws.xcai.io

# Or obtain certificate manually without auto-configuration
sudo certbot certonly --nginx -d xttsws.xcai.io
```

Follow the prompts:
1. Enter your email address
2. Agree to Terms of Service
3. Choose whether to share email with EFF
4. Certbot will automatically obtain and install the certificate

## Step 6: Reload Nginx

```bash
sudo systemctl reload nginx
```

## Step 7: Verify SSL Configuration

Test your SSL configuration:

```bash
# Check if server is accessible
curl -I https://xttsws.xcai.io/health

# Test WebSocket connection with SSL
wscat -c wss://xttsws.xcai.io
```

Online SSL test: https://www.ssllabs.com/ssltest/analyze.html?d=xttsws.xcai.io

## Step 8: Enable Auto-Renewal

Let's Encrypt certificates expire after 90 days. Certbot installs a cron job to auto-renew:

```bash
# Test renewal process (dry run)
sudo certbot renew --dry-run

# Check certbot timer status
sudo systemctl status certbot.timer

# Manual renewal (if needed)
sudo certbot renew
```

## Step 9: Firewall Configuration

If using UFW firewall:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
sudo ufw status
```

If using iptables:

```bash
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

## Systemd Service for XTTS Server

Create a systemd service to auto-start XTTS server:

```bash
sudo nano /etc/systemd/system/xtts-server.service
```

Add the following:

```ini
[Unit]
Description=XTTS WebSocket Proxy Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/xtts-minimax-proxy/packages/server
Environment="NODE_ENV=production"
Environment="PORT=8080"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=xtts-server

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable xtts-server
sudo systemctl start xtts-server
sudo systemctl status xtts-server
```

## Monitoring and Logs

```bash
# Nginx access logs
sudo tail -f /var/log/nginx/xtts-proxy-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/xtts-proxy-error.log

# XTTS server logs
sudo journalctl -u xtts-server -f

# Check Nginx status
sudo systemctl status nginx

# Check SSL certificate expiry
sudo certbot certificates
```

## Troubleshooting

### WebSocket connection fails

```bash
# Check if XTTS server is running
curl http://localhost:8080

# Check Nginx error logs
sudo tail -n 50 /var/log/nginx/xtts-proxy-error.log

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSL certificate not working

```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --force-renewal

# Check Nginx SSL configuration
sudo nginx -t
```

### Port 80/443 already in use

```bash
# Find what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting service (e.g., Apache)
sudo systemctl stop apache2
sudo systemctl disable apache2
```

## Performance Tuning

For high-traffic deployments, add to `/etc/nginx/nginx.conf`:

```nginx
worker_processes auto;
worker_connections 4096;

events {
    use epoll;
    multi_accept on;
}

http {
    # Connection keep-alive
    keepalive_timeout 65;
    keepalive_requests 100;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    output_buffers 1 32k;
    postpone_output 1460;
}
```

## Security Recommendations

1. **Rate limiting**: Add to server block to prevent abuse:

```nginx
limit_req_zone $binary_remote_addr zone=xtts_limit:10m rate=10r/s;
limit_req zone=xtts_limit burst=20 nodelay;
```

2. **IP whitelisting** (optional): Restrict access to specific IPs:

```nginx
allow 192.168.1.0/24;
allow 10.0.0.0/8;
deny all;
```

3. **DDoS protection**: Use Cloudflare or similar CDN with WebSocket support

4. **Fail2ban**: Install fail2ban to ban IPs with suspicious activity

```bash
sudo apt install fail2ban
```

## Testing the Complete Setup

1. **SDK Connection Test**:

```typescript
import { XTTSClient } from 'xtts-sdk';

const client = new XTTSClient({
  apiKey: 'your-api-key',
  voice: 'emma'
  // serverUrl defaults to wss://xttsws.xcai.io
});

client.on('connected', () => {
  console.log('✅ Connected to XTTS server with SSL');
});

await client.connect();
```

2. **Command-line Test**:

```bash
# Test with wscat
npm install -g wscat
wscat -c wss://xttsws.xcai.io
```

## Certificate Renewal Timeline

- **Day 0**: Certificate issued (valid for 90 days)
- **Day 60**: Certbot auto-renewal begins attempting renewal
- **Day 90**: Certificate expires (if not renewed)

Certbot runs twice daily via systemd timer to check and renew certificates.

## Summary

After completing this setup:

✅ XTTS server runs on `localhost:8080`
✅ Nginx reverse proxy on port 443 with SSL/TLS
✅ Let's Encrypt SSL certificate (auto-renews)
✅ WebSocket connections encrypted with wss://
✅ SDK clients connect to `wss://xttsws.xcai.io`
✅ HTTP traffic redirects to HTTPS
✅ A+ SSL rating on SSLLabs
✅ Production-ready systemd service
✅ Automatic certificate renewal

## Next Steps

- Configure API key generation endpoint on server
- Set up monitoring and alerting (Prometheus, Grafana)
- Implement rate limiting per API key
- Add load balancing for multiple XTTS server instances
- Configure backup and disaster recovery
