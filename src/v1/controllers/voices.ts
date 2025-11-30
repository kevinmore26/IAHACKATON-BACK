import { Response } from 'express';
import prisma from '../../lib/prisma';
import { AuthRequest } from '../../middleware/auth';
import { cloneVoice as elevenLabsCloneVoice, generateAudio } from '../../lib/elevenlabs';
import { uploadFile, getPublicUrl } from '../../lib/supabase';
import fs from 'fs';

export async function cloneVoice(req: AuthRequest, res: Response) {
  try {
    const { name, organization_id } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!name || !files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name and at least one audio file are required',
      });
    }

    // If organization_id is provided, verify user belongs to it
    if (organization_id) {
      const userOrg = await prisma.user_organizations.findUnique({
        where: {
          user_id_organization_id: {
            user_id: req.user.id,
            organization_id: organization_id,
          },
        },
      });

      if (!userOrg) {
        return res.status(403).json({
          success: false,
          message: 'User does not belong to this organization',
        });
      }
    }

    // Clone voice using ElevenLabs
    const audioPaths = files.map(file => file.path);
    const voiceId = await elevenLabsCloneVoice(name, audioPaths);

    // Clean up uploaded files
    for (const path of audioPaths) {
      fs.unlink(path, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
    }

    // Generate preview audio
    let previewUrl = '';
    try {
      const previewText = "¡Hola! Esta es una vista previa de mi voz clonada. Puedo leer cualquier texto que me des con alta calidad y realismo. ¡Pruébame en tu próximo proyecto de video!";
      const audioBuffer = await generateAudio(previewText, voiceId);
      
      const fileName = `voices/previews/${voiceId}.mp3`;
      const uploadedPath = await uploadFile(fileName, audioBuffer, 'audio/mpeg', 'public-assets');
      
      if (uploadedPath) {
        previewUrl = getPublicUrl(uploadedPath, 'public-assets');
      }
    } catch (error) {
      console.error('Error generating preview for cloned voice:', error);
      // Continue even if preview generation fails
    }

    // Save voice to database
    const voice = await prisma.voices.create({
      data: {
        name,
        elevenlabs_voice_id: voiceId,
        organization_id: organization_id || null,
        preview_url: previewUrl,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        voice,
      },
      message: 'Voice cloned successfully',
    });
  } catch (error) {
    console.error('Error in cloneVoice:', error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || 'Internal server error',
    });
  }
}
