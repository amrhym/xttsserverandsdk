#!/usr/bin/env node

/**
 * Simple script to generate API keys via HTTP API
 *
 * Usage:
 *   node scripts/generate-api-key.js "My App Name" "Optional description"
 *   node scripts/generate-api-key.js --list
 */

const http = require('http');

const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 8765;

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
XTTS API Key Generator

Usage:
  node generate-api-key.js "App Name" ["Description"]    Generate a new API key
  node generate-api-key.js --list                        List all API keys
  node generate-api-key.js --delete <key>                Delete an API key

Environment Variables:
  API_HOST    API server hostname (default: localhost)
  API_PORT    API server port (default: 8765)

Examples:
  node generate-api-key.js "Test Client"
  node generate-api-key.js "Production App" "Main production API key"
  node generate-api-key.js --list
  node generate-api-key.js --delete xtts_abc123...
`);
  process.exit(0);
}

// List keys
if (args[0] === '--list') {
  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: '/api/keys',
    method: 'GET',
  };

  const req = http.request(options, (res) => {
    let body = '';

    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(body);

        if (response.keys && response.keys.length > 0) {
          console.log('\nAPI Keys:\n');
          response.keys.forEach((key, index) => {
            console.log(`${index + 1}. ${key.name}`);
            console.log(`   Key: ${key.key}`);
            console.log(`   Status: ${key.isActive ? 'Active' : 'Inactive'}`);
            console.log(`   Created: ${new Date(key.createdAt).toLocaleString()}`);
            if (key.description) {
              console.log(`   Description: ${key.description}`);
            }
            if (key.expiresAt) {
              console.log(`   Expires: ${new Date(key.expiresAt).toLocaleString()}`);
            }
            if (key.rateLimit) {
              console.log(`   Rate Limit: ${key.rateLimit.requestsPerMinute}/min, ${key.rateLimit.requestsPerDay}/day`);
            }
            console.log('');
          });
        } else {
          console.log('\nNo API keys found.\n');
        }
      } catch (error) {
        console.error('Error parsing response:', error.message);
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error listing API keys:', error.message);
    console.error('\nMake sure the server is running:');
    console.error(`  npm run start\n`);
    process.exit(1);
  });

  req.end();
  return;
}

// Delete key
if (args[0] === '--delete') {
  if (!args[1]) {
    console.error('Error: Please provide the API key to delete');
    process.exit(1);
  }

  const keyToDelete = args[1];

  const options = {
    hostname: API_HOST,
    port: API_PORT,
    path: `/api/keys/${keyToDelete}`,
    method: 'DELETE',
  };

  const req = http.request(options, (res) => {
    let body = '';

    res.on('data', (chunk) => {
      body += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(body);

        if (res.statusCode === 200) {
          console.log(`\n✓ API key deleted successfully\n`);
        } else {
          console.error(`\n✗ Error: ${response.error}\n`);
          process.exit(1);
        }
      } catch (error) {
        console.error('Error parsing response:', error.message);
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Error deleting API key:', error.message);
    process.exit(1);
  });

  req.end();
  return;
}

// Generate new key
const name = args[0];
const description = args[1] || '';

const data = JSON.stringify({
  name,
  description,
});

const options = {
  hostname: API_HOST,
  port: API_PORT,
  path: '/api/generate-key',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
  },
};

const req = http.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(body);

      if (res.statusCode === 201) {
        console.log('\n' + '='.repeat(70));
        console.log('✓ API Key Generated Successfully!');
        console.log('='.repeat(70));
        console.log('');
        console.log('Name:', response.name);
        if (response.description) {
          console.log('Description:', response.description);
        }
        console.log('');
        console.log('API Key:', response.apiKey);
        console.log('');
        console.log('Created:', new Date(response.createdAt).toLocaleString());
        if (response.expiresAt) {
          console.log('Expires:', new Date(response.expiresAt).toLocaleString());
        } else {
          console.log('Expires: Never');
        }
        console.log('');
        if (response.rateLimit) {
          console.log('Rate Limits:');
          console.log(`  - ${response.rateLimit.requestsPerMinute} requests per minute`);
          console.log(`  - ${response.rateLimit.requestsPerDay} requests per day`);
          console.log('');
        }
        console.log('='.repeat(70));
        console.log('');
        console.log('IMPORTANT: Save this API key securely!');
        console.log('You will need it to authenticate with the XTTS SDK.');
        console.log('');
        console.log('Example usage:');
        console.log('  const client = new XTTSClient({');
        console.log(`    apiKey: '${response.apiKey}',`);
        console.log(`    serverUrl: 'ws://${API_HOST}:${API_PORT}',`);
        console.log('  });');
        console.log('');
        console.log('='.repeat(70));
        console.log('');
      } else {
        console.error('\n✗ Error generating API key:', response.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error parsing response:', error.message);
      console.error('Response body:', body);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('\n✗ Error generating API key:', error.message);
  console.error('\nMake sure the server is running:');
  console.error(`  cd packages/server`);
  console.error(`  npm run start\n`);
  process.exit(1);
});

req.write(data);
req.end();
