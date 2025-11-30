import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../env";

export interface Block {
  type: "NARRATOR" | "SHOWCASE";
  durationTarget: number;
  script: string;
  userInstructions: string;
}

export interface IScriptGenerator {
  generateScript(intent: string, userScript: string): Promise<{ blocks: Block[] }>;
}

// Define the schema for the output
const blockSchema = z.object({
  type: z.enum(["NARRATOR", "SHOWCASE"]).describe("The type of the block."),
  durationTarget: z.number().describe("Target duration in seconds."),
  script: z.string().describe("The exact script/words to be spoken or shown."),
  userInstructions: z.string().describe("Direct instructions for the user on what to film or upload."),
});

const responseSchema = z.object({
  blocks: z.array(blockSchema).describe("List of video blocks/scenes."),
});

export class GoogleScriptGenerator implements IScriptGenerator {
  private client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });
  }

  async generateScript(intent: string, userScript: string): Promise<{ blocks: Block[] }> {
    const prompt = `
      You are an expert TikTok video director. Your goal is to create a viral, organic video script based on the user's input.
      
      Intent: ${intent}
      User's Draft/Idea: "${userScript}"

      Create a video plan with a list of "blocks" (scenes).
      The video must be under 20 seconds total.
      
      Block Types:
      - NARRATOR: The user talking to the camera (Talking Head).
      - SHOWCASE: B-roll of the product or subject with voiceover.

      Structure:
      1. Hook (Narrator) - Grab attention immediately.
      2. Body (Showcase/Evidence) - Demonstrate value or tell the story.
      3. Call to Action (Narrator) - Tell them what to do.

      IMPORTANT: Return a JSON object with a single key "blocks" containing the array of objects.
      Do NOT return the blocks as stringified JSON strings. Return them as actual JSON objects.
      
      Example Output:
      {
        "blocks": [
          {
            "type": "NARRATOR",
            "durationTarget": 5,
            "script": "Hey, check this out!",
            "userInstructions": "Smile at the camera."
          },
          {
            "type": "SHOWCASE",
            "durationTarget": 3,
            "script": "(Voiceover) It is amazing.",
            "userInstructions": "Show the product spinning."
          }
        ]
      }
    `;

    try {
      const response = await this.client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              blocks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    type: { type: "STRING", enum: ["NARRATOR", "SHOWCASE"], description: "The type of the block." },
                    durationTarget: { type: "NUMBER", description: "Target duration in seconds." },
                    script: { type: "STRING", description: "The exact script/words to be spoken or shown." },
                    userInstructions: { type: "STRING", description: "Direct instructions for the user on what to film or upload." },
                  },
                  required: ["type", "durationTarget", "script", "userInstructions"],
                },
              },
            },
            required: ["blocks"],
          },
        },
      });

      const responseText = response.text;

      if (!responseText) {
        throw new Error("Empty response from Google Gen AI");
      }

      const result = JSON.parse(responseText);
      
      // Validate result against schema (runtime check)
      const parsed = responseSchema.parse(result);

      // Cast to Block[] since Zod enum matches our type
      return { blocks: parsed.blocks };

    } catch (e) {
      console.error('Failed to generate script with Google Gen AI:', e);
      throw new Error('Failed to generate script');
    }
  }
}
