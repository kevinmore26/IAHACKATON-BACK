import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

if (!ELEVENLABS_API_KEY) {
  console.warn('ELEVENLABS_API_KEY is not set');
}

export async function transformAudio(audioPath: string, voiceId: string): Promise<Buffer> {
  try {
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioPath));
    formData.append('model_id', 'eleven_multilingual_sts_v2'); // Using Speech-to-Speech model

    const response = await axios.post(
      `${BASE_URL}/speech-to-speech/${voiceId}`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        responseType: 'arraybuffer',
        params: {
            output_format: 'mp3_44100_128'
        }
      }
    );

    return Buffer.from(response.data);
  } catch (error: any) {
    console.error('Error transforming audio with ElevenLabs:', error.response?.data || error.message);
    throw new Error('Failed to transform audio');
  }
}
