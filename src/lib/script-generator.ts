import { withGoogleAIRetry } from "./google-client";
import { z } from "zod";

export interface Block {
  type: "NARRATOR" | "SHOWCASE";
  durationTarget: number;
  script: string;
  visualPrompt: string;
  userInstructions: string;
}

export interface IScriptGenerator {
  generateScript(intent: string, userScript: string): Promise<{ blocks: Block[] }>;
}

// Define the schema for the output
const blockSchema = z.object({
  type: z.enum(["NARRATOR", "SHOWCASE"]).describe("The type of the block."),
  durationTarget: z.coerce.number().describe("Target duration in seconds."),
  script: z.string().describe("The exact script/words to be spoken or shown."),
  visualPrompt: z.string().describe("A detailed visual prompt for video generation using the formula: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. Must describe a realistic video filmed from a cellphone."),
  userInstructions: z.string().describe("Direct instructions for the user on what to film or upload."),
});

const responseSchema = z.object({
  blocks: z.array(blockSchema).describe("List of video blocks/scenes."),
});

export class GoogleScriptGenerator implements IScriptGenerator {
  
  constructor() {}

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
      
      PARA "visualPrompt":
      Usa SIEMPRE esta fórmula: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]
      Estilo OBLIGATORIO: "Realistic video filmed from a cellphone, vertical 9:16 aspect ratio, amateur lighting, slightly shaky handheld camera movement."
      IMPORTANTE: El visualPrompt debe ser DETALLADO y DESCRIPTIVO (2-3 oraciones). Describe la iluminación, texturas, colores y movimiento de cámara con precisión cinematográfica.
      
      Reglas por Tipo de Bloque:
      - NARRATOR:
        * Cinematography: "Selfie shot, POV from a cellphone, close-up."
        * Focus: El usuario/narrador hablando a la cámara.
        * Ejemplo: "Selfie shot from a cellphone, a young man talking directly to the camera, holding the phone with one hand, in a home office, realistic lighting."
      
      - SHOWCASE:
        * Cinematography: "Handheld close-up shot from a cellphone."
        * Focus: El objeto, producto o entorno descrito.
        * Ejemplo: "Handheld close-up shot from a cellphone, panning over a laptop keyboard, realistic texture, natural lighting coming from a window."
      
      Ejemplo de Salida:
      {
        "blocks": [
          {
            "type": "NARRATOR",
            "durationTarget": "6",
            "script": "¡Hola, mira esto!",
            "visualPrompt": "Selfie shot from a cellphone, close-up of a young hispanic man smiling and talking to the camera, wearing a casual t-shirt, in a bright modern kitchen, realistic lighting, handheld camera style.",
            "userInstructions": "Sonríe a la cámara con energía."
          },
          {
            "type": "SHOWCASE",
            "durationTarget": "4",
            "script": "(Voz en off) Es increíble.",
            "visualPrompt": "Handheld close-up shot from a cellphone, hands unboxing a sleek gadget on a wooden table, natural sunlight coming from a window, realistic texture, handheld camera movement.",
            "userInstructions": "Muestra el producto girando."
          }
        ]
      }
    `;

    return withGoogleAIRetry(async (client) => {
      try {
        const response = await client.models.generateContent({
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
                      durationTarget: { type: "STRING", enum: ["4", "6", "8"], description: "Target duration in seconds (must be 4, 6, or 8)." },
                      script: { type: "STRING", description: "The exact script/words to be spoken or shown." },
                      visualPrompt: { type: "STRING", description: "A detailed visual prompt for video generation using the formula: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]. Must describe a realistic video filmed from a cellphone." },
                      userInstructions: { type: "STRING", description: "Direct instructions for the user on what to film or upload." },
                    },
                    required: ["type", "durationTarget", "script", "visualPrompt", "userInstructions"],
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
        throw e;
      }
    });
  }
}
