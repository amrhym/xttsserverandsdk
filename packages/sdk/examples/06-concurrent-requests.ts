/**
 * Example 6: Concurrent Synthesis Requests
 *
 * Demonstrates:
 * - Multiple concurrent synthesis operations
 * - Request ID tracking
 * - Parallel processing
 * - Request correlation
 */

import { XTTSClient } from '../src';
import { writeFile } from 'fs/promises';

async function main() {
  const client = new XTTSClient({
    apiKey: process.env.XTTS_API_KEY || 'your-api-key',
    voice: 'emma'
  });

  try {
    await client.connect();
    console.log('Connected to XTTS server\n');

    // Define multiple texts to synthesize concurrently
    const texts = [
      'This is the first concurrent request.',
      'This is the second concurrent request.',
      'This is the third concurrent request.',
      'This is the fourth concurrent request.',
      'This is the fifth concurrent request.'
    ];

    console.log(`Starting ${texts.length} concurrent synthesis requests...\n`);
    const startTime = Date.now();

    // Create all synthesis promises with request IDs
    const requests = texts.map((text, index) => {
      const requestId = `request-${index + 1}`;
      console.log(`📤 Queued: ${requestId}`);

      return client.synthesize({
        text,
        requestId
      }).then(audio => ({
        requestId,
        audio,
        size: audio.length
      }));
    });

    // Wait for all to complete
    console.log('\n⏳ Waiting for all requests to complete...\n');
    const results = await Promise.all(requests);

    const elapsed = Date.now() - startTime;

    // Display results
    console.log('✅ All requests completed!\n');
    console.log('Results:');
    results.forEach(({ requestId, size }) => {
      console.log(`  ${requestId}: ${(size / 1024).toFixed(2)} KB`);
    });

    const totalSize = results.reduce((sum, r) => sum + r.size, 0);
    console.log(`\nTotal size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`Total time: ${(elapsed / 1000).toFixed(2)}s`);
    console.log(`Average per request: ${(elapsed / results.length / 1000).toFixed(2)}s`);

    // Save all audio files
    console.log('\nSaving audio files...');
    await Promise.all(
      results.map(({ requestId, audio }) =>
        writeFile(`output-${requestId}.mp3`, audio)
      )
    );
    console.log('All files saved!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
  }
}

main();
