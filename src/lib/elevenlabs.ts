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

export async function cloneVoice(name: string, audioPaths: string[]): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('name', name);
    
    for (const path of audioPaths) {
      formData.append('files', fs.createReadStream(path));
    }

    const response = await axios.post(
      `${BASE_URL}/voices/add`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    return response.data.voice_id;
  } catch (error: any) {
    let errorMessage = 'Failed to clone voice';
    
    if (error.response?.data) {
        try {
            const errorData = typeof error.response.data === 'string' 
                ? JSON.parse(error.response.data) 
                : error.response.data;
            errorMessage = errorData.detail?.message || errorData.message || errorMessage;
        } catch (e) {
            errorMessage = error.message || errorMessage;
        }
    }

    console.error('Error cloning voice with ElevenLabs:', errorMessage);
    throw new Error(errorMessage);
  }
}

export async function generateAudio(text: string, voiceId: string): Promise<Buffer> {
  try {
    const response = await axios.post(
      `${BASE_URL}/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    return Buffer.from(response.data);
  } catch (error: any) {
    let errorMessage = 'Failed to generate audio';
    
    if (error.response?.data) {
        try {
            const errorData = JSON.parse(error.response.data.toString());
            errorMessage = errorData.detail?.message || errorData.message || errorMessage;
        } catch (e) {
            errorMessage = error.message || errorMessage;
        }
    }

    console.error('Error generating audio with ElevenLabs:', errorMessage);
    throw new Error(errorMessage);
  }
}

export interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export async function alignAudio(audioBuffer: Buffer, text: string): Promise<AlignmentData> {
  try {
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
    formData.append('text', text);

    const response = await axios.post(
      `${BASE_URL}/forced-alignment`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    let errorMessage = 'Failed to align audio';
    
    if (error.response?.data) {
        try {
            const errorData = typeof error.response.data === 'string' 
                ? JSON.parse(error.response.data) 
                : error.response.data;
            errorMessage = errorData.detail?.message || errorData.message || errorMessage;
        } catch (e) {
            errorMessage = error.message || errorMessage;
        }
    }

    console.error('Error aligning audio with ElevenLabs:', errorMessage);
    if (error.response?.data) {
        console.error('Full error details:', JSON.stringify(error.response.data, null, 2));
    }
    throw new Error(errorMessage);
  }
}
