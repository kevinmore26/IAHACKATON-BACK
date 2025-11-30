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
    const idea = await prisma.content_ideas.findUnique({
      where: { id: ideaId },
    });

    if (!idea) {
      return res.status(404).json({
        success: false,
        message: 'Content idea not found',
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
