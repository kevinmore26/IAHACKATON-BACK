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
    let errorMessage = 'Failed to transform audio';
    let errorStatus = 'unknown';

    if (error.response?.data) {
        try {
            // Try to parse the buffer as JSON
            const errorData = JSON.parse(error.response.data.toString());
            errorMessage = errorData.detail?.message || errorData.message || errorMessage;
            errorStatus = errorData.detail?.status || errorStatus;
            
            if (errorStatus === 'quota_exceeded') {
                throw new Error('ELEVENLABS_QUOTA_EXCEEDED');
            }
        } catch (e) {
            // If parsing fails, use the raw message if available
            errorMessage = error.message || errorMessage;
        }
    }

    console.error('Error transforming audio with ElevenLabs:', errorMessage);
    throw new Error(errorMessage);
  }
}
