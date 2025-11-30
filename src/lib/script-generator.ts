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
      Eres un experto director de videos de TikTok. Tu objetivo es crear un guion de video viral y orgánico basado en la entrada del usuario.
      
      Intención: ${intent}
      Borrador/Idea del Usuario: "${userScript}"

      Crea un plan de video con una lista de "bloques" (escenas).
      El video debe durar menos de 20 segundos en total.
      
      Tipos de Bloque:
      - NARRATOR: El usuario hablando a la cámara (Talking Head).
      - SHOWCASE: B-roll del producto o sujeto con voz en off.

      Restricciones:
      - Cada bloque DEBE tener una duración de exactamente 4, 6 u 8 segundos.
      - La duración total de todos los bloques no debe exceder los 20 segundos.
      - El guion y las instrucciones deben estar en ESPAÑOL.

      Estructura:
      1. Gancho (Narrator) - Captar la atención inmediatamente.
      2. Cuerpo (Showcase/Evidence) - Demostrar valor o contar la historia.
      3. Llamada a la Acción (Narrator) - Decirles qué hacer.

      IMPORTANTE: Devuelve un objeto JSON con una única clave "blocks" que contenga el array de objetos.
      NO devuelvas los bloques como cadenas JSON stringified. Devuélvelos como objetos JSON reales.
      
      Ejemplo de Salida:
      {
        "blocks": [
          {
            "type": "NARRATOR",
            "durationTarget": 6,
            "script": "¡Hola, mira esto!",
            "userInstructions": "Sonríe a la cámara con energía."
          },
          {
            "type": "SHOWCASE",
            "durationTarget": 4,
            "script": "(Voz en off) Es increíble.",
            "userInstructions": "Muestra el producto girando."
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
                    durationTarget: { type: "NUMBER", enum: [4, 6, 8], description: "Target duration in seconds (must be 4, 6, or 8)." },
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
