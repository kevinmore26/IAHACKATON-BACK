import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { uploadFile, getPublicUrl, supabase } from '../src/lib/supabase';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

const VOICES_TO_SEED = [
  { id: '5vkxOzoz40FrElmLP4P7', name: 'Gaby', gender: 'Female' },
  { id: '7uSWXMmzGnsyxZwYFfmK', name: 'Alexander', gender: 'Male' },
];



// Helper to handle the non-unique upsert issue if strictly following previous schema
async function safeSeed() {
    if (!ELEVENLABS_API_KEY) {
        console.error('ELEVENLABS_API_KEY is not set');
        process.exit(1);
    }

    // Ensure bucket exists
    const { error: bucketError } = await supabase.storage.createBucket('public-assets', {
        public: true,
    });
    if (bucketError) {
        // Ignore if it already exists (code 400 or specific error message), otherwise log
        if (!bucketError.message.includes('already exists')) {
             console.log('Bucket creation note:', bucketError.message);
        }
    } else {
        console.log('Created public-assets bucket');
    }
    
    for (const voice of VOICES_TO_SEED) {
        try {
            console.log(`Processing voice: ${voice.name} (${voice.id})`);

            // 0. Add to VoiceLab (ignore error if already exists)
            try {
                await axios.post(
                    `${BASE_URL}/voices/add/${voice.id}`,
                    { name: voice.name },
                    { headers: { 'xi-api-key': ELEVENLABS_API_KEY } }
                );
                console.log(`Added ${voice.name} to VoiceLab`);
            } catch (e: any) {
                // Ignore if already added or other error, proceed to check if we can fetch it
                console.log(`Note: Could not add to VoiceLab (might already exist): ${e.message}`);
            }
            
            // 1. Get Voice Details to find a sample
            const voiceDetailsResponse = await axios.get(`${BASE_URL}/voices/${voice.id}`, {
                headers: { 'xi-api-key': ELEVENLABS_API_KEY },
            });
            console.log('Voice Details:', JSON.stringify(voiceDetailsResponse.data, null, 2));
            let audioBuffer: Buffer;

            const samples = voiceDetailsResponse.data.samples;
            if (samples && samples.length > 0) {
                const sampleId = samples[0].sample_id;
                console.log(`Found sample ID: ${sampleId}`);
                const audioResponse = await axios.get(
                    `${BASE_URL}/voices/${voice.id}/samples/${sampleId}/audio`,
                    {
                        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
                        responseType: 'arraybuffer',
                    }
                );
                audioBuffer = Buffer.from(audioResponse.data);
            } else if (voiceDetailsResponse.data.preview_url) {
                console.log(`No samples found, using preview_url: ${voiceDetailsResponse.data.preview_url}`);
                const audioResponse = await axios.get(voiceDetailsResponse.data.preview_url, {
                    responseType: 'arraybuffer',
                });
                audioBuffer = Buffer.from(audioResponse.data);
            } else {
                console.warn(`No samples or preview_url found for voice ${voice.name}`);
                continue;
            }
            
            const fileName = `voices/${voice.id}.mp3`;
            const uploadedPath = await uploadFile(fileName, audioBuffer, 'audio/mpeg', 'public-assets');
            
            if (!uploadedPath) {
                 console.error(`Failed to upload sample for ${voice.name}`);
                 continue;
            }
            
            const publicUrl = getPublicUrl(uploadedPath, 'public-assets');
            
            // DB Operation
            const existing = await prisma.voices.findFirst({
                where: { elevenlabs_voice_id: voice.id }
            });
            
            if (existing) {
                await prisma.voices.update({
                    where: { id: existing.id },
                    data: { 
                        name: voice.name,
                        preview_url: publicUrl
                    }
                });
                console.log(`Updated voice ${voice.name}`);
            } else {
                await prisma.voices.create({
                    data: {
                        elevenlabs_voice_id: voice.id,
                        name: voice.name,
                        preview_url: publicUrl
                    }
                });
                console.log(`Created voice ${voice.name}`);
            }
            
        } catch (e: any) {
            console.error(`Failed voice ${voice.name}: ${e.message}`);
            if (e.response) {
                console.error('Response data:', JSON.stringify(e.response.data, null, 2));
            }
        }
    }
}

safeSeed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
