/**
 * Example 3: File Synthesis
 *
 * Demonstrates:
 * - Direct file writing without buffering
 * - Progress tracking
 * - Memory-efficient handling of large texts
 * - Result statistics
 */

import { XTTSClient } from '../src';

async function main() {
  const client = new XTTSClient({
    apiKey: process.env.XTTS_API_KEY || 'your-api-key',
    voice: 'emma'
  });

  try {
    await client.connect();
    console.log('Connected to XTTS server');

    const longText = `
      This is a file synthesis example that writes audio directly to disk.
      This method is the most memory-efficient because it doesn't buffer
      the entire audio in memory before writing.

      It's perfect for very long texts, batch processing, or when you have
      memory constraints. The SDK writes each chunk directly to the file
      as it arrives from the server.

      You can track progress in real-time and get detailed statistics
      about the synthesis operation when it completes.
    `.trim();

    console.log('Starting file synthesis...');
    const startTime = Date.now();

    const result = await client.synthesizeToFile({
      text: longText,
      filePath: 'output-file.mp3',

      onProgress: (bytesWritten, chunksReceived) => {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = bytesWritten / elapsed;

        console.log(
          `Progress: ${(bytesWritten / 1024).toFixed(2)} KB ` +
          `(${chunksReceived} chunks) @ ${(rate / 1024).toFixed(2)} KB/s`
        );
      }
    });

    const elapsed = (Date.now() - startTime) / 1000;

    console.log('\n✅ File synthesis complete!');
    console.log(`File: ${result.filePath}`);
    console.log(`Size: ${(result.bytesWritten / 1024).toFixed(2)} KB`);
    console.log(`Chunks: ${result.chunksReceived}`);
    console.log(`Time: ${elapsed.toFixed(2)}s`);
    console.log(`Average rate: ${(result.bytesWritten / 1024 / elapsed).toFixed(2)} KB/s`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
  }
}

main();
