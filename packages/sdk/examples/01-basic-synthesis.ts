/**
 * Example 1: Basic Synthesis
 *
 * Demonstrates:
 * - Connecting to XTTS server
 * - Simple text-to-speech synthesis
 * - Saving audio to file
 * - Error handling
 */

import { XTTSClient } from '../src';
import { writeFile } from 'fs/promises';

async function main() {
  // Create client with API key and voice
  const client = new XTTSClient({
    apiKey: process.env.XTTS_API_KEY || 'your-api-key',
    voice: 'emma'
  });

  try {
    console.log('Connecting to XTTS server...');
    await client.connect();
    console.log('Connected!');

    // Synthesize text to speech
    console.log('Synthesizing speech...');
    const audioBuffer = await client.synthesize({
      text: 'Hello! This is a basic text-to-speech example using XTTS SDK.'
    });

    // Save to file
    const outputPath = 'output-basic.mp3';
    await writeFile(outputPath, audioBuffer);
    console.log(`Audio saved to ${outputPath}`);
    console.log(`Size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always disconnect
    client.disconnect();
    console.log('Disconnected');
  }
}

main();
