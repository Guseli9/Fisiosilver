
import { GoogleGenAI, Type } from "@google/genai";
import type { ClinicalAnalysisResult, NutritionalAnalysisResult, HealthData, VigsScore } from "../types";

// Inicialización del cliente de IA con la clave de entorno
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

/**
 * Analiza un informe clínico (imagen o PDF) para extraer biomarcadores específicos.
 * Maneja valores ausentes devolviendo "No encontrado".
 */
export const analyzeClinicalReport = async (file: File): Promise<ClinicalAnalysisResult> => {
  try {
    const filePart = await fileToGenerativePart(file);
    const prompt = `
      Eres un asistente médico experto en análisis de laboratorio clínico y geriatría. 
      Tu misión es extraer con precisión quirúrgica los siguientes biomarcadores de este informe para rellenar una base de datos médica.

      LISTA DE VALORES A EXTRAER:
      1. Hemoglobina (Hb)
      2. Albúmina (Alb)
      3. Vitamina D (25-OH-D o 25-hidroxivitamina D)
      4. Glucosa en Ayunas (Glicemia)
      5. eGFR (Filtrado Glomerular)
      6. Sodio (Na+)
      7. Proteína C Reactiva (PCR o CRP)
      8. Vitamina B12 (Cobalamina)
      9. TSH (Hormona Tiroestimulante)
      10. Creatinina sérica

      REGLAS CRÍTICAS:
      - Si el valor NO aparece en el documento o no es legible, escribe exactamente "No encontrado".
      - Si el valor SÍ aparece, extrae el número y la unidad (ej: "14.5 g/dL").
      - Proporciona un resumen clínico breve (max 80 palabras) enfocado en la salud del adulto mayor.
      - Ofrece 2-3 recomendaciones preventivas basadas en los resultados.

      IMPORTANTE: Devuelve un objeto JSON puro siguiendo el esquema definido.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: [filePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            biomarkers: {
              type: Type.OBJECT,
              properties: {
                hemoglobin: { type: Type.STRING },
                albumin: { type: Type.STRING },
                vitaminD: { type: Type.STRING },
                glucoseFasting: { type: Type.STRING },
                egfr: { type: Type.STRING },
                sodium: { type: Type.STRING },
                crp: { type: Type.STRING },
                vitaminB12: { type: Type.STRING },
                tsh: { type: Type.STRING },
                creatinine: { type: Type.STRING }
              },
              required: ["hemoglobin", "albumin", "vitaminD", "glucoseFasting", "egfr", "sodium", "crp", "vitaminB12", "tsh", "creatinine"]
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "biomarkers", "recommendations"]
        }
      }
    });
    
    return JSON.parse(response.text || '{}');

  } catch (error) {
    console.error("Error analizando informe clínico:", error);
    throw new Error("No se pudo procesar el informe. Asegúrese de que el archivo sea una imagen o PDF legible.");
  }
};

/**
 * Analiza una foto de comida para estimar valores nutricionales.
 */
export const analyzeFoodPhoto = async (file: File): Promise<NutritionalAnalysisResult> => {
    try {
        const imagePart = await fileToGenerativePart(file);
        const prompt = `
          Como nutricionista geriátrico, analiza esta comida.
          Estima calorías, macronutrientes y micronutrientes clave (Calcio, Vit. D, B12, Hierro, Sodio, Potasio).
          Proporciona sugerencias de mejora para la salud ósea y muscular del senior.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.STRING },
                  macros: {
                    type: Type.OBJECT,
                    properties: {
                      protein: { type: Type.STRING },
                      carbs: { type: Type.STRING },
                      fatsTotal: { type: Type.STRING },
                      fatsSaturated: { type: Type.STRING },
                      fatsUnsaturated: { type: Type.STRING },
                      fatsTrans: { type: Type.STRING },
                      fiber: { type: Type.STRING }
                    },
                    required: ["protein", "carbs", "fatsTotal", "fatsSaturated", "fatsUnsaturated", "fatsTrans", "fiber"]
                  },
                  micros: {
                      type: Type.OBJECT,
                      properties: {
                          calcium: { type: Type.STRING },
                          vitaminD: { type: Type.STRING },
                          vitaminB12: { type: Type.STRING },
                          iron: { type: Type.STRING },
                          sodium: { type: Type.STRING },
                          potassium: { type: Type.STRING }
                      },
                      required: ["calcium", "vitaminD", "vitaminB12", "iron", "sodium", "potassium"]
                  },
                  portions: { type: Type.STRING },
                  suggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["calories", "macros", "micros", "portions", "suggestions"]
              }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Error analizando foto de comida:", error);
        throw new Error("Error al analizar la fotografía nutricional.");
    }
};

/**
 * Genera recomendaciones de salud proactivas basadas en datos actuales.
 */
export const generateHealthRecommendations = async (healthData: HealthData, vigsScore: VigsScore): Promise<{ title: string; justification: string; }[]> => {
  try {
    const prompt = `
      Genera 2 recomendaciones de salud para un paciente senior con:
      - Categoría de Fragilidad: ${vigsScore.category} (Índice: ${vigsScore.index?.toFixed(2) || 'N/A'})
      - Peso: ${healthData.weight || 'N/A'} kg
      - Tensión: ${healthData.systolicBP || 'N/A'}/${healthData.diastolicBP || 'N/A'} mmHg

      Devuelve un JSON con la clave "recommendations".
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  justification: { type: Type.STRING }
                },
                required: ["title", "justification"]
              }
            }
          },
          required: ["recommendations"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"recommendations": []}');
    return result.recommendations;

  } catch (error) {
    console.error("Error generando recomendaciones:", error);
    return [];
  }
};
