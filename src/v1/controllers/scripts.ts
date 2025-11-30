import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { GoogleScriptGenerator } from '../../lib/script-generator';

const generator = new GoogleScriptGenerator();

export async function generateScript(req: Request, res: Response) {
  try {
    const { ideaId } = req.body;

    if (!ideaId) {
      return res.status(400).json({
        success: false,
        message: 'ideaId is required',
      });
    }

    // Fetch the idea
    // Fetch the idea
    const idea = await prisma.content_ideas.findUnique({
      where: { id: ideaId },
      include: {
        video_blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Content idea not found',
      });
    }

    // If blocks already exist, return them
    if (idea.video_blocks.length > 0) {
      return res.json({
        success: true,
        data: idea.video_blocks,
        message: 'Script blocks retrieved successfully',
      });
    }

    // Generate script
    // We use the idea's title as "intent" context if script is short, 
    // or just pass the script as the user's draft.
    // The prompt expects (intent, userScript).
    // Let's use title as intent and script as userScript.
    const { blocks } = await generator.generateScript(idea.title, idea.script);

    // Save blocks to DB transactionally
    const result = await prisma.$transaction(async (tx) => {
      // Update idea status
      await tx.content_ideas.update({
        where: { id: ideaId },
        data: { status: 'SCRIPTED' },
      });

      // Delete existing blocks if any (re-generation support)
      await tx.video_blocks.deleteMany({
        where: { content_idea_id: ideaId },
      });

      // Create new blocks
      const createdBlocks:Array<{
        id: string;
        content_idea_id: string;
        type: string;
        script: string;
        instructions: string;
        duration_target: number;
        order: number;
        status: string;
      }> = []
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const createdBlock = await tx.video_blocks.create({
          data: {
            content_idea_id: ideaId,
            type: block.type,
            script: block.script,
            visual_prompt: block.visualPrompt,
            instructions: block.userInstructions,
            duration_target: block.durationTarget,
            order: i + 1,
            status: 'WAITING_INPUT',
          },
        });
        createdBlocks.push(createdBlock);
      }

      return createdBlocks;
    });

    return res.json({
      success: true,
      data: result,
      message: 'Script generated successfully',
    });

  } catch (error) {
    console.error('Error in generateScript:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate script',
    });
  }
}

import { stitchVideos } from '../../lib/video-processor';
import { downloadFile, uploadFile, getSignedUrl } from '../../lib/supabase';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function renderScriptVideo(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // 1. Fetch idea and blocks
    const idea = await prisma.content_ideas.findUnique({
      where: { id },
      include: {
        video_blocks: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Content idea not found',
      });
    }

    const blocks = idea.video_blocks;
    if (blocks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No blocks found for this idea',
      });
    }

    // 2. Validate blocks
    const readyBlocks = blocks.filter(
      (b) => (b.status === 'COMPLETED' || b.status === 'READY') && (b.generated_video_path || b.input_media_path)
    );

    if (readyBlocks.length !== blocks.length) {
      return res.status(400).json({
        success: false,
        message: 'Not all blocks are ready or have video content',
      });
    }

    // 3. Download videos
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-'));
    const videoPaths: string[] = [];

    for (const block of readyBlocks) {
      // Prefer generated video, fallback to input video (if it was a VIDEO input)
      const videoPath = block.generated_video_path || (block.input_media_type === 'VIDEO' ? block.input_media_path : null);
      
      if (!videoPath) {
        // Should not happen due to filter above, but safety check
        continue;
      }

      const buffer = await downloadFile(videoPath);
      if (!buffer) {
        throw new Error(`Failed to download video: ${videoPath}`);
      }

      const localPath = path.join(tempDir, `${block.id}.mp4`);
      fs.writeFileSync(localPath, buffer);
      videoPaths.push(localPath);
    }

    // 4. Stitch videos
    const outputPath = path.join(tempDir, 'final.mp4');
    await stitchVideos(videoPaths, outputPath);

    // 5. Upload final video
    const finalVideoBuffer = fs.readFileSync(outputPath);
    const uploadedPath = await uploadFile(`renders/${id}.mp4`, finalVideoBuffer, 'video/mp4');

    if (!uploadedPath) {
      throw new Error('Failed to upload final video');
    }

    // 6. Update idea
    const updatedIdea = await prisma.content_ideas.update({
      where: { id },
      data: {
        final_video_path: uploadedPath,
        status: 'COMPLETED',
      },
    });

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Generate signed URL
    const signedUrl = await getSignedUrl(uploadedPath);

    return res.json({
      success: true,
      data: {
        ...updatedIdea,
        signed_url: signedUrl,
      },
      message: 'Video rendered successfully',
    });

  } catch (error) {
    console.error('Error rendering video:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to render video',
    });
  }
}
