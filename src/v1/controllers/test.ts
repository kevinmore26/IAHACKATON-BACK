import { Request, Response } from 'express';
import axios from 'axios';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;


import { transformAudio } from '../../lib/elevenlabs';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function testElevenLabs(req: Request, res: Response) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({
        success: false,
        message: 'ELEVENLABS_API_KEY is not set in environment variables',
      });
    }

    // 1. Download a sample audio file for testing
    const sampleAudioUrl = 'https://github.com/rafaelreis-hotmart/Audio-Sample-files/raw/master/sample.mp3';
    const tempInputPath = path.join(os.tmpdir(), `test_input_${Date.now()}.mp3`);
    const tempTrimmedPath = path.join(os.tmpdir(), `test_input_trimmed_${Date.now()}.mp3`);
    
    console.log('Downloading sample audio...');
    const audioResponse = await axios.get(sampleAudioUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(tempInputPath, audioResponse.data);
    console.log('Sample audio saved to:', tempInputPath);

    // Trim to 3 seconds using fluent-ffmpeg
    console.log('Trimming audio to 3 seconds...');
    const ffmpeg = require('fluent-ffmpeg');
    await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
            .setStartTime(0)
            .setDuration(3)
            .output(tempTrimmedPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
    console.log('Audio trimmed to:', tempTrimmedPath);

    // 2. Test transformAudio
    const voiceId = '5vkxOzoz40FrElmLP4P7';
    console.log(`Testing transformAudio with voice ${voiceId}...`);
    
    let transformResult = 'success';
    let errorDetails = null;

    try {
        const outputBuffer = await transformAudio(tempTrimmedPath, voiceId);
        console.log('Transformation successful, output size:', outputBuffer.length);
    } catch (error: any) {
        console.error('Transform failed:', error.response?.data || error.message);
        transformResult = 'failed';
        errorDetails = {
            message: error.message,
            data: error.response?.data ? error.response.data.toString() : null,
            status: error.response?.status
        };
    }

    // Cleanup
    try {
        fs.unlinkSync(tempInputPath);
        fs.unlinkSync(tempTrimmedPath);
    } catch (e) {}

    return res.json({
      success: true,
      data: {
        test_type: 'speech-to-speech',
        voice_id: voiceId,
        result: transformResult,
        error: errorDetails
      },
      message: 'ElevenLabs transformAudio test completed',
    });

  } catch (error: any) {
    console.error('Test Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test execution failed',
      error: error.message,
    });
  }
}
