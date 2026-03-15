
import { GoogleGenAI, Type } from "@google/genai";
import type { ClinicalAnalysisResult, NutritionalAnalysisResult, HealthData, VigsScore } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export const analyzeClinicalReport = async (file: File): Promise<ClinicalAnalysisResult> => {
  try {
    const ai = getAI();
    const filePart = await fileToGenerativePart(file);
    const prompt = `
      Eres un asistente médico experto en análisis de laboratorio clínico y geriatría. 
      Extrae los biomarcadores con precisión del documento adjunto (imagen o PDF).
      Si el valor NO aparece, escribe "No encontrado".
      IMPORTANTE: Devuelve un objeto JSON puro siguiendo el esquema.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
                creatinine: { type: Type.STRING },
                ldl: { type: Type.STRING },
                hba1c: { type: Type.STRING }
              },
              required: ["hemoglobin", "albumin", "vitaminD", "glucoseFasting", "egfr", "sodium", "crp", "vitaminB12", "tsh", "creatinine", "ldl", "hba1c"]
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
    
    if (!response.text) throw new Error("La IA no devolvió texto.");
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Error en analyzeClinicalReport:", error);
    if (error.message?.includes("entity was not found")) {
        throw new Error("API_KEY_RESET");
    }
    throw new Error("No se pudo procesar el informe. Asegúrese de que el archivo sea legible.");
  }
};

export const analyzeClinicalText = async (text: string): Promise<ClinicalAnalysisResult> => {
  try {
    const ai = getAI();
    const prompt = `
      Eres un asistente médico experto en análisis de laboratorio clínico y geriatría. 
      Analiza el siguiente texto de una analítica y extrae los biomarcadores.
      Si el valor NO aparece, escribe "No encontrado".
      IMPORTANTE: Devuelve un objeto JSON puro siguiendo el esquema.
      
      TEXTO:
      ${text}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
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
                creatinine: { type: Type.STRING },
                ldl: { type: Type.STRING },
                hba1c: { type: Type.STRING }
              },
              required: ["hemoglobin", "albumin", "vitaminD", "glucoseFasting", "egfr", "sodium", "crp", "vitaminB12", "tsh", "creatinine", "ldl", "hba1c"]
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
    
    if (!response.text) throw new Error("La IA no devolvió texto.");
    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Error en analyzeClinicalText:", error);
    throw new Error("No se pudo procesar el texto. Asegúrese de que contenga datos médicos válidos.");
  }
};

export const analyzeFoodPhoto = async (file: File): Promise<NutritionalAnalysisResult> => {
    try {
        const ai = getAI();
        const imagePart = await fileToGenerativePart(file);
        const prompt = `
          Eres un nutricionista geriátrico experto.
          Analiza esta foto de comida.
          1. Estima calorías y macronutrientes.
          2. Calcula el Nutri-Score (A, B, C, D o E) basándote en la calidad de los ingredientes, fibra, proteínas vs azúcares y grasas saturadas.
          3. Escribe un comentario corto motivador.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.STRING },
                  nutriScore: { type: Type.STRING, enum: ["A", "B", "C", "D", "E"] },
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
                  portions: { type: Type.STRING, description: "Comentario motivador sobre el plato." },
                  suggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ["calories", "nutriScore", "macros", "micros", "portions", "suggestions"]
              }
            }
        });
        if (!response.text) throw new Error("La IA no devolvió texto.");
        return JSON.parse(response.text);
    } catch (error: any) {
        console.error("Error en analyzeFoodPhoto:", error);
        if (error.message?.includes("entity was not found")) {
            throw new Error("API_KEY_RESET");
        }
        throw new Error("Error al analizar la fotografía nutricional.");
    }
};

export const generateHealthRecommendations = async (healthData: HealthData, vigsScore: VigsScore): Promise<{ title: string; justification: string; }[]> => {
  try {
    const ai = getAI();
    const prompt = `Genera 2 recomendaciones de salud personalizadas para un paciente senior con los siguientes datos: ${JSON.stringify(healthData)}, VIGS: ${JSON.stringify(vigsScore)}. JSON con clave "recommendations".`;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    if (!response.text) return [];
    return JSON.parse(response.text).recommendations;
  } catch (error) {
    console.error("Error en generateHealthRecommendations:", error);
    return [];
  }
};
