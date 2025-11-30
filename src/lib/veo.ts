import { GenerateVideosParameters, GoogleGenAI } from '@google/genai';
import { env } from '../env';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });

export async function generateVideo(
  prompt: string,
  imageBuffer?: Buffer,
  durationSeconds: 4 | 6 | 8 = 6
): Promise<Buffer | null> {
  try {
    console.log('Starting Veo generation...');
    let operation;

    const commonParams: GenerateVideosParameters = {
      model: 'veo-3.1-generate-preview',
      prompt: prompt,
      ...imageBuffer ? {
        image: {
          imageBytes: imageBuffer.toString('base64'),
          mimeType: 'image/png',
        },
      } : {},
      config: { 
        aspectRatio: '9:16',
        durationSeconds: durationSeconds,
      }
    };

    operation = await ai.models.generateVideos(commonParams);

    console.log('Video generation operation started:', operation.name);

    // Poll for completion
    while (!operation.done) {
      console.log('Waiting for video generation to complete...');
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10s
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
    }

    if (!operation.response || !operation.response.generatedVideos || operation.response.generatedVideos.length === 0) {
      console.error('No video generated in response');
      return null;
    }

    const video = operation.response.generatedVideos[0];
    
    // Download the video
    // The library provides a download helper, but we need the bytes.
    // Usually we can get the URI and fetch it, or if the library supports stream/buffer.
    // The docs example uses `ai.files.download({ file: ..., downloadPath: ... })`.
    // We want to avoid writing to disk if possible, or write to temp.
    
    const tempPath = path.join(os.tmpdir(), `veo-${Date.now()}.mp4`);
    
    await ai.files.download({
      file: video.video,
      downloadPath: tempPath,
    });

    const videoBuffer = fs.readFileSync(tempPath);
    
    // Cleanup temp file
    fs.unlinkSync(tempPath);

    return videoBuffer;

  } catch (error) {
    console.error('Error generating video with Veo:', error);
    return null;
  }
}
