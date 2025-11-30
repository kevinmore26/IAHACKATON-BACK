import { GoogleGenAI } from '@google/genai';
import { env } from '../env';

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
