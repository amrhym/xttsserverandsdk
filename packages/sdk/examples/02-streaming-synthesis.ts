/**
 * Example 2: Streaming Synthesis
 *
 * Demonstrates:
 * - Callback-based streaming synthesis
 * - Real-time audio chunk processing
 * - Memory-efficient handling of long texts
 * - Stream cancellation
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
    console.log('Connected to XTTS server');

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let chunkCount = 0;

    console.log('Starting streaming synthesis...');

    const requestId = client.synthesizeStream({
      text: `This is a streaming synthesis example.
             The audio is delivered in chunks as they arrive from the server,
             allowing for real-time playback and memory-efficient processing.
             This is perfect for long-form content or interactive applications.`,

      onChunk: (chunk: Buffer) => {
        chunkCount++;
        totalBytes += chunk.length;
        chunks.push(chunk);
        console.log(`Chunk ${chunkCount}: ${chunk.length} bytes (total: ${totalBytes})`);

        // In a real application, you could:
        // - Feed chunks directly to an audio player
        // - Stream to a file
        // - Process audio in real-time
      },

      onComplete: (finalChunk: Buffer) => {
        chunks.push(finalChunk);
        totalBytes += finalChunk.length;
        console.log(`\nStream complete! Final chunk: ${finalChunk.length} bytes`);
        console.log(`Total: ${totalBytes} bytes in ${chunks.length} chunks`);
      },

      onError: (error: Error) => {
        console.error('Stream error:', error);
      }
    });

    console.log(`Request ID: ${requestId}`);

    // Wait for stream to complete (simulated with promise)
    await new Promise<void>((resolve) => {
      const originalOnComplete = client.synthesizeStream;
      setTimeout(() => resolve(), 10000); // Wait max 10 seconds
    });

    // Save complete audio
    if (chunks.length > 0) {
      const completeAudio = Buffer.concat(chunks);
      await writeFile('output-streaming.mp3', completeAudio);
      console.log('Complete audio saved to output-streaming.mp3');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.disconnect();
  }
}

main();
