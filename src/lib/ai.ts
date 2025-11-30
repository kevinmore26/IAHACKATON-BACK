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
    Genera un resumen de negocio conciso y profesional para la siguiente organización:
    
    Nombre: ${details.name}
    Tipo de Negocio: ${details.business_type}
    Producto Principal: ${details.main_product}
    Objetivo de Contenido: ${details.content_objective}
    Público Objetivo: ${details.target_audience}
    
    El resumen debe sintetizar la propuesta de valor central del negocio y sus objetivos estratégicos basándose en la información proporcionada. Mantenlo por debajo de las 200 palabras y escribe en ESPAÑOL.
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
    Genera ${count} ideas de contenido de video corto para el siguiente negocio:
    
    Nombre: ${details.name}
    Tipo de Negocio: ${details.business_type}
    Producto Principal: ${details.main_product}
    Objetivo de Contenido: ${details.content_objective}
    Público Objetivo: ${details.target_audience}
    Resumen del Negocio: ${details.business_brief}
    
    Las ideas de contenido deben ser concisas y atractivas, enfocándose en la propuesta de valor del negocio y el público objetivo. Cada idea debe ser de menos de 20 segundos.
    El título y el guion deben estar en ESPAÑOL.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            ideas: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING', description: 'A catchy title for the video.' },
                  script: { type: 'STRING', description: 'A short video script (approx. 10-20 seconds).' },
                },
                required: ['title', 'script'],
              },
            },
          },
          required: ['ideas'],
        },
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
