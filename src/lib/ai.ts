import { GoogleGenAI } from '@google/genai';
import { env } from '../env';

import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY });

interface BusinessDetails {
  name: string;
  business_type: string;
  main_product: string;
  content_objective: string;
  target_audience: string;
}

export async function generateBusinessBrief(
  details: BusinessDetails
): Promise<string> {
  const prompt = `
    Generate a concise and professional business brief for the following organization:
    
    Name: ${details.name}
    Business Type: ${details.business_type}
    Main Product: ${details.main_product}
    Content Objective: ${details.content_objective}
    Target Audience: ${details.target_audience}
    
    The brief should summarize the business's core value proposition and its strategic goals based on the provided information. Keep it under 200 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || 'No brief generated.';
  } catch (error) {
    console.error('Error generating business brief:', error);
    return 'Failed to generate business brief.';
  }
}

const contentIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().describe('A catchy title for the video.'),
      script: z
        .string()
        .describe('A short video script (approx. 10-20 seconds).'),
    })
  ),
});

export async function generateContentIdeas(
  details: BusinessDetails & { business_brief: string; },
  count: number = 5
): Promise<Array<{ title: string; script: string }>> {
  const prompt = `
    Generate ${count} short video content ideas for the following business:
    
    Name: ${details.name}
    Business Type: ${details.business_type}
    Main Product: ${details.main_product}
    Content Objective: ${details.content_objective}
    Target Audience: ${details.target_audience}
    Business Brief: ${details.business_brief}
    
    The content ideas should be concise and engaging, focusing on the business's value proposition and target audience. Each idea should be under 20 seconds.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: contentIdeasSchema,
      },
    });

    const text = response.text;
    if (!text) return [];

    const parsed = contentIdeasSchema.parse(JSON.parse(text));
    return parsed.ideas;
  } catch (error) {
    console.error('Error generating content ideas:', error);
    return [];
  }
}
