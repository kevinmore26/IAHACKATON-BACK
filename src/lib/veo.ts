import { GenerateVideosParameters } from '@google/genai';
import { withGoogleAIRetry } from './google-client';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function generateVideo(
  prompt: string,
  imageBuffer?: Buffer,
  durationSeconds: 4 | 6 | 8 = 6
): Promise<Buffer | null> {
  return withGoogleAIRetry(async (ai) => {
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
        throw new Error('No video generated in response'); // Throw to trigger retry
      }

      const video = operation.response.generatedVideos[0];
      
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
      throw error; // Re-throw to allow retry
    }
  });
}
