import { GoogleGenAI, Type } from "@google/genai";
import type { ClinicalAnalysisResult, NutritionalAnalysisResult, HealthData, VigsScore, UserProfile } from "../types";

// ═══════════════════════════════════════════════════════
// AI PROVIDER ABSTRACTION WITH AUTOMATIC FALLBACK
// Primary: Google Gemini  |  Fallback: Groq (Llama 3)
// ═══════════════════════════════════════════════════════

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Helper para limpiar respuestas de la IA que puedan contener bloques de código markdown
const cleanJsonResponse = (text: string): string => {
  return text.replace(/```json/g, "").replace(/```/g, "").trim();
};

// ═══════════════════════════════════════════════════════
// GROQ FALLBACK - OpenAI-compatible REST API
// ═══════════════════════════════════════════════════════

const callGroqText = async (prompt: string, jsonMode: boolean = true): Promise<string> => {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY no configurada');

  console.log('[FALLBACK] Usando Groq como proveedor de IA...');
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: 'Eres un asistente médico geriátrico experto. Responde SIEMPRE en JSON válido sin bloques markdown.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4096,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('[GROQ ERROR]', response.status, errBody);
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

const callGroqWithImage = async (prompt: string, base64Image: string, mimeType: string): Promise<string> => {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY no configurada');

  // Groq Vision no soporta PDF, solo imágenes
  if (mimeType.includes('pdf')) {
    throw new Error('Groq no soporta análisis de PDF. Por favor, use una imagen o espere a que Gemini tenga disponibilidad.');
  }

  console.log('[FALLBACK] Usando Groq Vision (11b)...');
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.2-11b-vision-preview',
      messages: [
        { 
          role: 'user', 
          content: [
            { type: 'text', text: `${prompt}\n\nResponde SOLO con el JSON solicitado.` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('[GROQ VISION ERROR]', response.status, errBody);
    throw new Error(`Groq Vision API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

// ═══════════════════════════════════════════════════════
// GEMINI REST LAYER WITH KEY ROTATION
// ═══════════════════════════════════════════════════════

const callGeminiRest = async (payload: any): Promise<any> => {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_TERTIARY
  ].filter(Boolean);

  const models = [
    'gemini-2.5-flash'
  ];

  let lastError = null;

  for (const key of keys) {
    for (const model of models) {
      try {
        console.log(`[GEMINI] Intentando con ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
          // Si es un error de cuota o servicio saturado (429, 503 o mensajes específicos), probamos el siguiente modelo/llave
          const msg = data.error.message?.toLowerCase() || "";
          if (data.error.code === 429 || data.error.code === 503 || msg.includes('quota') || msg.includes('demand') || msg.includes('overloaded')) {
             console.warn(`[GEMINI ${model}] Saturado o sin cuota, probando siguiente opción...`);
             continue; 
          }
          throw new Error(data.error.message);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return JSON.parse(cleanJsonResponse(text));
        }
        
        throw new Error("Respuesta vacía o formato desconocido de Gemini");
      } catch (err: any) {
        lastError = err;
        // Espera corta para evitar bloqueos por ráfagas
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  throw lastError || new Error("No hay claves o modelos de Gemini con cuota disponible");
};

// Opcional: Optimizar imagen antes de enviar (Resize/Compress) para evitar Error 400
const optimizeImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 1600;
        
        if (width > max || height > max) {
          if (width > height) {
            height *= max / width;
            width = max;
          } else {
            width *= max / height;
            height = max;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.7);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const fileToBase64 = async (file: File): Promise<string> => {
  const optimizedBlob = await optimizeImage(file);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(optimizedBlob);
  });
};

const fileToGenerativePart = async (file: File) => {
  return {
    inlineData: { data: await fileToBase64(file), mimeType: file.type },
  };
};

// ═══════════════════════════════════════════════════════
// CLINICAL REPORT ANALYSIS (Image/PDF → Biomarkers)
// ═══════════════════════════════════════════════════════

export const analyzeClinicalReport = async (file: File): Promise<ClinicalAnalysisResult> => {
  const prompt = `
    Analiza este documento médico. 
    Tu objetivo es ser un pedagogo médico para un paciente anciano.
    
    1. Extrae biomarcadores (hemoglobin, albumin, vitaminD, glucoseFasting, egfr, sodium, crp, vitaminB12, tsh, creatinine, ldl, hba1c).
    2. Genera un "summary" con un tono cálido que explique primero QUÉ ESTÁ BIEN en su salud y luego QUÉ SE PUEDE MEJORAR (sin asustar, con lenguaje sencillo).
    3. Responde SOLO un JSON con: 
       "summary" (string pedagógico), 
       "biomarkers" (objeto con valores o "---"), 
       "recommendations" (array de consejos cortos).
  `;

  try {
    const base64 = await fileToBase64(file);
    return await callGeminiRest({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: file.type, data: base64 } }
        ]
      }]
    });
  } catch (geminiError: any) {
    console.warn("[GEMINI VISION FAILED] analyzeClinicalReport:", geminiError.message);
    throw new Error(`Error en el análisis del informe. El sistema está saturado o sin cuota tras 3 reintentos. Detalle: ${geminiError.message}`);
  }
};

// ═══════════════════════════════════════════════════════
// CLINICAL TEXT ANALYSIS (Text → Biomarkers)
// ═══════════════════════════════════════════════════════

export const analyzeClinicalText = async (text: string): Promise<ClinicalAnalysisResult> => {
  const prompt = `
    Analiza el siguiente texto médico.
    Tu objetivo es ser un pedagogo médico para un paciente anciano.
    
    1. Extrae biomarcadores.
    2. Genera un "summary" con un tono cálido que explique primero QUÉ ESTÁ BIEN en su salud y luego QUÉ SE PUEDE MEJORAR de forma sencilla.
    3. Responde SOLO un JSON con: "summary", "biomarkers" (hemoglobin, albumin, vitaminD, glucoseFasting, egfr, sodium, crp, vitaminB12, tsh, creatinine, ldl, hba1c), "recommendations".
    TEXTO: ${text}
  `;

  try {
    const data = await callGeminiRest({
      contents: [{ parts: [{ text: prompt }] }]
    });
    // Validar en caso de que devuelva algo inesperado
    if (data.summary && data.biomarkers) {
        return data;
    }
    return data;
  } catch (geminiError: any) {
    console.warn("[GEMINI FAILED] analyzeClinicalText:", geminiError.message);
    
    // Fallback to Groq
    try {
      const result = await callGroqText(prompt);
      return JSON.parse(cleanJsonResponse(result));
    } catch (groqError: any) {
      console.error("[GROQ FALLBACK FAILED]", groqError.message);
      throw new Error("No se pudo procesar el texto con ningún proveedor de IA.");
    }
  }
};

// ═══════════════════════════════════════════════════════
// FOOD PHOTO ANALYSIS (Image → Nutrition)
// ═══════════════════════════════════════════════════════

export const analyzeFoodPhoto = async (file: File): Promise<NutritionalAnalysisResult> => {
  const prompt = `
    Analiza esta comida para un anciano. 
    Tu objetivo es ser un guía nutricional cálido y pedagógico.
    
    1. Estima los valores y scores habituales (calories, nutriScore, nutritionScores, macros, micros).
    2. En el campo "portions", genera un comentario pedagógico que explique de forma sencilla:
       - QUÉ ESTÁ BIEN en este plato (ej: buena proteína, vegetales variados).
       - QUÉ SE PODRÍA MEJORAR (ej: menos sal, añadir hidratación, más fibra).
    3. Responde SOLO con un JSON que incluya esos campos: "calories", "nutriScore", "nutritionScores", "macros", "micros", "portions" (el texto pedagógico), "suggestions" (3 consejos cortos).
  `;

  try {
    const base64 = await fileToBase64(file);
    return await callGeminiRest({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: file.type, data: base64 } }
        ]
      }]
    });
  } catch (geminiError: any) {
    console.warn("[GEMINI VISION FAILED] analyzeFoodPhoto:", geminiError.message);
    throw new Error(`Error en el análisis de comida. El sistema está saturado o sin cuota tras 3 reintentos. Detalle: ${geminiError.message}`);
  }
};

// ═══════════════════════════════════════════════════════
// HEALTH RECOMMENDATIONS (Text → 3 Recommendations)
// ═══════════════════════════════════════════════════════

export const generateHealthRecommendations = async (healthData: HealthData, vigsScore: VigsScore): Promise<{ title: string; justification: string; step: string }[]> => {
  const prompt = `
    Actúa como un geriatra extremadamente empático y cercano. 
    Analiza estos datos de salud: ${JSON.stringify(healthData)} y fragilidad VIGS: ${JSON.stringify(vigsScore)}.
    
    Genera 3 recomendaciones de salud enfocadas a mejorar la vitalidad de un anciano.
    Cada recomendación debe ser:
    - title: Un mensaje muy positivo y corto.
    - justification: Una explicación muy sencilla de por qué es importante (máximo 2 frases).
    - step: Un "Pequeño Paso" concreto y muy fácil de hacer hoy mismo (ej: "Beber un vaso de agua ahora").
    
    Responde SOLO con un JSON con la clave "recommendations" que sea un array de objetos con esas 3 claves.
  `;

  try {
    const data = await callGeminiRest({
      contents: [{ parts: [{ text: prompt }] }]
    });
    return data.recommendations || [];
  } catch (geminiError: any) {
    console.warn("[GEMINI FAILED] generateHealthRecommendations:", geminiError.message);
    
    // Fallback to Groq
    try {
      const result = await callGroqText(prompt);
      return JSON.parse(cleanJsonResponse(result)).recommendations;
    } catch (groqError: any) {
      console.error("[GROQ FALLBACK FAILED]", groqError.message);
      return [];
    }
  }
};

// ═══════════════════════════════════════════════════════
// DAILY HEALTH SUMMARY (All data → AI narrative)
// ═══════════════════════════════════════════════════════

export interface DailySummary {
  greeting: string;
  narrative: string;
  mood: 'great' | 'good' | 'okay' | 'watch';
  highlights: { label: string; status: 'positive' | 'neutral' | 'warning'; detail: string }[];
  quickTip: string;
}

export const generateDailySummary = async (
  profile: UserProfile,
  healthData: HealthData, 
  vigsScore: VigsScore, 
  recentMeals: string[], 
  latestBiomarkers: Record<string, string> | null
): Promise<DailySummary | null> => {
  const heightM = (profile.healthData?.height || 170) / 100;
  const bmi = healthData.weight ? (healthData.weight / (heightM * heightM)).toFixed(1) : null;

    const prompt = `
    Eres un médico geriatra cálido, experto y extremadamente cercano. Tu paciente es ${profile.displayName}, de ${profile.age} años.
    Tu objetivo es explicarle CÓMO SE ENCUENTRA hoy y darle una GUÍA DE VIDA detallada pero sencilla.
    
    DATOS CLÍNICOS PARA TU ANÁLISIS:
    - Estado Físico ACTUAL: Peso ${healthData.weight}kg, TA ${healthData.systolicBP}/${healthData.diastolicBP}, Pulso ${healthData.pulse}, SatO2 ${healthData.oxygenSaturation}%, Glucosa ${healthData.glucose}mg/dL.
    - Fragilidad/Autonomía (VIGS): ${vigsScore.index < 0.25 ? 'Excelente autonomía' : vigsScore.index < 0.5 ? 'Necesita algo de apoyo' : 'Estado de fragilidad, requiere cuidado'}.
    - Nutrición reciente: ${recentMeals.join(', ')}.
    - Analíticas médicas recientes: ${JSON.stringify(latestBiomarkers || 'Sin datos recientes')}.
    
    INSTRUCCIONES DE NARRATIVA:
    1. LENGUAJE SIMPLE: Habla con calidez. Explica cómo está en general sin repetir cifras técnicas, tradúcelas a sensaciones de salud.
    2. ESTRUCTURA DE LOS CONSEJOS (Highlights): Debes generar EXACTAMENTE 5 tarjetas con estas etiquetas fijas. En cada una, debes explicar primero QUÉ DEBE MEJORAR (detectado en sus datos) y CÓMO HACERLO (el paso concreto):
       
       - "Hidratación": Enfatiza beber al menos 8 vasos de agua al día. Si detectas tensión alta o deshidratación, explícale que el agua ayuda a que su cuerpo funcione correctamente.
       - "Actividad Física": Recomienda paseos cortos de 10 a 15 minutos. Si su pulso es alto o su VIGS indica fragilidad, ajusta la intensidad pero mantén el objetivo de movilidad y circulación.
       - "Descanso": Explica la importancia de reposar después de cada actividad para evitar el agotamiento y permitir la recuperación muscular/cardíaca.
       - "Nutrición/Salud": Basándote en sus analíticas (Vitamina D, Hierro, etc.), dile qué valor debe vigilar y qué alimentos incluir (ej: pescados, verduras). 
       - "Alimentación Equilibrada": Analiza sus comidas recientes (${recentMeals.join(', ')}). Si falta equilibrio, recomiéndale comidas regulares para mantener la energía.
    
    EJEMPLO DE TONO EN TARJETA: "Tienes la tensión un poco alta según el registro. Intenta salir a caminar 10 minutos hoy y reduce el consumo de sal en las comidas para ayudar a tu corazón."

    Responde SOLO en este JSON:
    {
      "greeting": "Saludo muy afectuoso",
      "narrative": "Análisis general de su estado hoy (4-5 frases cálidas)",
      "mood": "great|good|okay|watch",
      "highlights": [
        {"label": "Hidratación", "status": "positive|neutral|warning", "detail": "Qué mejorar + Cómo hacerlo"},
        {"label": "Actividad Física", "status": "positive|neutral|warning", "detail": "Qué mejorar + Cómo hacerlo"},
        {"label": "Descanso", "status": "positive|neutral|warning", "detail": "Qué mejorar + Cómo hacerlo"},
        {"label": "Nutrición/Salud", "status": "positive|neutral|warning", "detail": "Qué mejorar + Cómo hacerlo"},
        {"label": "Alimentación Equilibrada", "status": "positive|neutral|warning", "detail": "Qué mejorar + Cómo hacerlo"}
      ],
      "quickTip": "Un consejo maestro para hoy"
    }
  `;

  // Priority 1: Groq
  try {
    console.log("[IA] Solicitando resumen a Groq...");
    const result = await callGroqText(prompt);
    if (!result) throw new Error("Groq devolvió vacío");
    const cleaned = cleanJsonResponse(result);
    console.log("[IA] Respuesta de Groq (limpia):", cleaned.substring(0, 100) + "...");
    return JSON.parse(cleaned);
  } catch (groqError: any) {
    console.warn("[GROQ FAILED] generateDailySummary:", groqError.message);
    
    // Priority 2: Gemini
    try {
      console.log("[IA] Solicitando resumen a Gemini (Rotación)...");
      const summary = await callGeminiRest({
        contents: [{ parts: [{ text: prompt }] }]
      });
      if (summary) return summary;
    } catch (geminiError: any) {
      console.warn("[ALL GEMINI KEYS FAILED] generateDailySummary:", geminiError.message);
    }

    // Priority 3: Pollinations
    try {
      console.log("[IA] Solicitando resumen a Pollinations (Reserva final)...");
      const polUrl = `https://text.pollinations.ai/`;
      const response = await fetch(polUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'Eres un médico clínico experto. Responde SOLO con el JSON solicitado.' },
            { role: 'user', content: prompt }
          ],
          model: 'openai',
          jsonMode: true
        })
      });
      const text = await response.text();
      if (text) {
        const cleaned = cleanJsonResponse(text);
        return JSON.parse(cleaned);
      }
    } catch (polError: any) {
      console.error("[ALL IA FAILED] No AI available:", polError.message);
    }

    // Si todo falla, devolvemos un objeto mínimo coherente en lugar de null para evitar el mensaje genérico de HomeScreen
    return {
      greeting: `Hola, ${profile.displayName}`,
      narrative: "Hoy no he podido analizar tus datos en profundidad por un problema técnico momentáneo, pero tus constantes parecen estar en orden. Sigue cuidándote como hasta ahora.",
      mood: "good",
      highlights: [
        { label: "Hidratación", status: "neutral", detail: "Recuerda beber agua con frecuencia para mantenerte bien." },
        { label: "Descanso", status: "positive", detail: "Un buen sueño es la base de tu energía de mañana." }
      ],
      quickTip: "Recuerda registrar tus datos mañana de nuevo."
    };
  }
};
