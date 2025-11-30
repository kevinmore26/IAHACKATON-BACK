import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

async function listVoices() {
  try {
    const response = await axios.get(`${BASE_URL}/voices`, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });
    
    console.log('Total voices:', response.data.voices.length);
    const voices = response.data.voices;
    
    const targetIds = ['5vkxOzoz40FrElmLP4P7', '7uSWXMmzGnsyxZwYFfmK'];
    
    targetIds.forEach(id => {
        const found = voices.find((v: any) => v.voice_id === id);
        if (found) {
            console.log(`Found ${id}: ${found.name}`);
            console.log('Samples:', found.samples);
        } else {
            console.log(`Voice ${id} NOT found in /v1/voices`);
        }
    });

  } catch (error: any) {
    console.error('Error listing voices:', error.message);
  }
}

listVoices();
