import type { ClinicalAnalysisResult, NutritionalAnalysisResult, HealthData, VigsScore, UserProfile } from "../types";

// ═══════════════════════════════════════════════════════
// CONFIGURACIÓN DE MODELOS Y LLAVES
// ═══════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

const GROQ_MODEL_TEXT = 'llama-3.1-8b-instant'; // Modelo de bajo consumo y alta velocidad
const GROQ_MODEL_VISION = 'llama-3.2-11b-vision-preview';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Devuelve las claves de Gemini configuradas */
const getGeminiKeys = (): string[] =>
  [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_TERTIARY,
    process.env.GEMINI_API_KEY_QUATERNARY,
  ].filter(Boolean) as string[];

/** Devuelve las claves de Groq configuradas */
const getGroqKeys = (): string[] =>
  [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_SECONDARY,
  ].filter(Boolean) as string[];

/** Elimina bloques de código markdown de la respuesta de la IA */
const cleanJsonResponse = (text: string): string =>
  text.replace(/```json/g, '').replace(/```/g, '').trim();

// ═══════════════════════════════════════════════════════
// NÚCLEO GROQ: Llamadas REST con rotación de claves
// ═══════════════════════════════════════════════════════

const callGroqText = async (prompt: string): Promise<string> => {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error("No hay claves de Groq configuradas");

  let lastError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const label = `Groq Clave ${i+1}/${keys.length}`;
    try {
      const response = await fetch(GROQ_BASE_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL_TEXT,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      if (data.error) {
        console.warn(`[IA] ${label} → Error: ${data.error.message}`);
        lastError = data.error;
        if (data.error.code === 'rate_limit_exceeded') continue;
        throw new Error(data.error.message);
      }
      return data.choices?.[0]?.message?.content || "";
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  throw lastError || new Error("Fallo en todas las claves de Groq");
};

const callGroqWithImage = async (prompt: string, base64: string, mimeType: string): Promise<string> => {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error("No hay claves de Groq configuradas");

  for (let key of keys) {
    try {
      const response = await fetch(GROQ_BASE_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GROQ_MODEL_VISION,
          messages: [{
            role: 'user',
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
            ]
          }],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      const data = await response.json();
      if (!data.error) return data.choices?.[0]?.message?.content || "";
    } catch (err) { continue; }
  }
  throw new Error("Fallo en Groq Vision");
};

// ═══════════════════════════════════════════════════════
// NÚCLEO GEMINI: Llamada con rotación de claves
// ═══════════════════════════════════════════════════════

const callGemini = async (payload: object): Promise<any> => {
  const keys = getGeminiKeys();
  if (keys.length === 0) throw new Error('No hay claves de Gemini configuradas');

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.error) {
        if (data.error.code === 503 || data.error.message.includes('demand')) {
          await new Promise(r => setTimeout(r, 1500)); continue;
        }
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return JSON.parse(cleanJsonResponse(text));
    } catch (err) { continue; }
  }
  throw new Error("Fallo en todas las claves de Gemini");
};

// ═══════════════════════════════════════════════════════
// UTILIDADES DE IMAGEN
// ═══════════════════════════════════════════════════════

const optimizeImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const max = 1600;
        if (width > max || height > max) {
          if (width > height) { height *= max / width; width = max; }
          else { width *= max / height; height = max; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.7);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const fileToBase64 = async (file: File): Promise<string> => {
  const blob = await optimizeImage(file);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

const getEffectiveMimeType = (file: File): string => {
  if (file.type === 'application/pdf') return 'application/pdf';
  return file.type.startsWith('image/') ? 'image/jpeg' : file.type;
};

// ═══════════════════════════════════════════════════════
// IMPLEMENTACIÓN DE FUNCIONES DE ANÁLISIS
// ═══════════════════════════════════════════════════════

export const analyzeClinicalReport = async (file: File): Promise<ClinicalAnalysisResult> => {
  const prompt = `Analiza este informe médico para un anciano de forma pedagógica. Responde SOLO JSON: { "summary": "...", "biomarkers": { "hemoglobin": "...", ... }, "recommendations": ["..."] }`;
  const mimeType = getEffectiveMimeType(file);
  const base64 = await fileToBase64(file);
  try { return await callGemini({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }] }); }
  catch { const res = await callGroqWithImage(prompt, base64, mimeType); return JSON.parse(cleanJsonResponse(res)); }
};

export const analyzeClinicalText = async (text: string): Promise<ClinicalAnalysisResult> => {
  const prompt = `Analiza este texto médico para un anciano. Responde SOLO JSON con summary, biomarkers y recommendations. TEXTO: ${text}`;
  try { return await callGemini({ contents: [{ parts: [{ text: prompt }] }] }); }
  catch { const res = await callGroqText(prompt); return JSON.parse(cleanJsonResponse(res)); }
};

export const analyzeFoodPhoto = async (file: File): Promise<NutritionalAnalysisResult> => {
  const prompt = `Analiza esta comida para un anciano de forma pedagógica. Responde SOLO JSON con calories, nutriScore, nutritionScores, macros, micros, portions (comentario pedagógico), suggestions (3 consejos).`;
  const mimeType = getEffectiveMimeType(file);
  const base64 = await fileToBase64(file);
  try { return await callGemini({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }] }); }
  catch { const res = await callGroqWithImage(prompt, base64, mimeType); return JSON.parse(cleanJsonResponse(res)); }
};

export const generateHealthRecommendations = async (healthData: HealthData, vigsScore: VigsScore) => {
  const prompt = `Genera 3 recomendaciones de salud empáticas para un anciano basándote en estos datos: ${JSON.stringify(healthData)} y fragilidad VIGS: ${JSON.stringify(vigsScore)}. Responde SOLO JSON: { "recommendations": [{ "title": "...", "justification": "...", "step": "..." }] }`;
  try { return await callGemini({ contents: [{ parts: [{ text: prompt }] }] }); }
  catch { const res = await callGroqText(prompt); const parsed = JSON.parse(cleanJsonResponse(res)); return parsed.recommendations || []; }
};

// ═══════════════════════════════════════════════════════
// RESUMEN DIARIO DE SALUD (GROQ PRIORITARIO)
// ═══════════════════════════════════════════════════════

export interface DailySummary {
  greeting: string;
  narrative: string;
  mood: 'great' | 'good' | 'okay' | 'watch';
  highlights: { label: string; status: 'positive' | 'neutral' | 'warning'; detail: string }[];
  quickTip: string;
}

export const generateDailySummary = async (
  profile: UserProfile, healthData: HealthData, vigsScore: VigsScore, recentMeals: string[], latestBiomarkers: Record<string, string> | null
): Promise<DailySummary | null> => {
  const heightM = (profile.healthData?.height || 170) / 100;
  const bmi = healthData.weight ? (healthData.weight / (heightM * heightM)).toFixed(1) : 'N/D';

  const prompt = `
    Eres un médico geriatra cálido y empático. Tu paciente es ${profile.displayName}, de ${profile.age} años.
    DATOS: Peso ${healthData.weight ?? 'N/D'}kg (IMC: ${bmi}), Tensión ${healthData.systolicBP ?? 'N/D'}/${healthData.diastolicBP ?? 'N/D'} mmHg, Pulso ${healthData.pulse ?? 'N/D'} lpm, Azúcar ${healthData.glucose ?? 'N/D'} mg/dL, Fragilidad (VIGS) ${vigsScore.index}, Analíticas ${JSON.stringify(latestBiomarkers || 'Sin datos')}, Comidas ${recentMeals.join(', ')}.

    INSTRUCCIONES:
    1. Greeting: Saludo cariñoso.
    2. Narrative: Resumen de 3-4 frases.
    3. Mood: "great", "good", "okay", o "watch".
    4. Highlights: EXACTAMENTE 5 objetos con label ("Hidratación", "Actividad Física", "Descanso", "Nutrición/Salud", "Alimentación Equilibrada"), status ("positive", "neutral", "warning") y detail.
    5. QuickTip: Consejo final.

    RESPONDE SOLO EN JSON:
    { "greeting": "...", "narrative": "...", "mood": "...", "highlights": [{ "label": "...", "status": "...", "detail": "..." }], "quickTip": "..." }
  `;

  // 1. PRIORIDAD: GROQ (CON ROTACIÓN)
  try {
    console.log("[IA] Solicitando resumen a Groq (Prioridad 1 con rotación)...");
    const result = await callGroqText(prompt);
    console.log("[IA] Respuesta RAW de Groq:", result);
    const parsed = JSON.parse(cleanJsonResponse(result));
    if (parsed?.highlights) return parsed;
  } catch (err: any) { console.warn("[IA] Groq falló en resumen:", err.message); }

  // 2. FALLBACK: GEMINI (ROTACIÓN 4 CLAVES)
  try {
    console.log("[IA] Solicitando resumen a Gemini (Prioridad 2 con 4 claves)...");
    return await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
  } catch (err: any) { console.error('[IA] Falló la generación del resumen:', err.message); }

  // 3. FALLBACK ESTÁTICO
  return {
    greeting: `Hola, ${profile.displayName}`,
    narrative: 'Los servicios de IA están temporalmente saturados. Tus datos están a salvo.',
    mood: 'okay',
    highlights: [
      { label: 'Hidratación', status: 'neutral', detail: 'Recuerda beber agua con frecuencia.' },
      { label: 'Actividad Física', status: 'neutral', detail: 'Un paseo corto ayuda a tu salud.' },
      { label: 'Descanso', status: 'positive', detail: 'Dormir bien es fundamental.' },
      { label: 'Nutrición/Salud', status: 'neutral', detail: 'Sigue tu dieta recomendada.' },
      { label: 'Alimentación Equilibrada', status: 'neutral', detail: 'Mantén horarios regulares para comer.' },
    ],
    quickTip: 'Pulsa "Actualizar Informe" para intentarlo de nuevo.',
  };
};
