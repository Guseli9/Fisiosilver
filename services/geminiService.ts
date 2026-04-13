import type { ClinicalAnalysisResult, NutritionalAnalysisResult, HealthData, VigsScore, UserProfile } from "../types";

// ═══════════════════════════════════════════════════════
// GEMINI SERVICE — Versión simplificada
// Modelo : gemini-2.5-flash
// Fallback: rotación automática de claves (Primary → Secondary → Tertiary)
// ═══════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Devuelve las claves configuradas en .env, filtrando las vacías */
const getApiKeys = (): string[] =>
  [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_SECONDARY,
    process.env.GEMINI_API_KEY_TERTIARY,
    process.env.GEMINI_API_KEY_QUATERNARY,
  ].filter(Boolean) as string[];

/** Elimina bloques de código markdown de la respuesta de la IA */
const cleanJsonResponse = (text: string): string =>
  text.replace(/```json/g, '').replace(/```/g, '').trim();

// ═══════════════════════════════════════════════════════
// NÚCLEO: Llamada a Gemini con rotación de claves
// ═══════════════════════════════════════════════════════

const callGemini = async (payload: object): Promise<any> => {
  const keys = getApiKeys();
  console.log(`[GEMINI] Sistema de rotación iniciado. Llaves detectadas: ${keys.length}`);
  
  if (keys.length === 0) {
    throw new Error('No hay claves de API de Gemini configuradas en el archivo .env');
  }

  let lastError: Error = new Error('Todas las claves de Gemini han fallado.');

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const keyLabel = `Clave ${i + 1}/${keys.length} (${key!.substring(0, 10)}...)`;
    try {
      console.log(`[GEMINI] Intentando ${keyLabel}...`);
      const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.error) {
        const code = data.error.code;
        const msg = data.error.message || '';
        console.warn(`[GEMINI] ${keyLabel} → Error ${code}: ${msg}`);
        lastError = new Error(`Error Gemini (${code}): ${msg}`);
        
        // Error 503 (Servicio no disponible/Saturado) o 429 (Cuota)
        const msgLower = msg.toLowerCase();
        if (code === 503 || msgLower.includes('demand') || msgLower.includes('overload')) {
          console.log(`[GEMINI] ${keyLabel} saturada. Esperando 1.5s antes de probar la siguiente...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }

        if (code === 429 || msgLower.includes('quota')) {
          console.log(`[GEMINI] ${keyLabel} sin cuota. Saltando a la siguiente inmediatamente...`);
          continue;
        }

        // Para cualquier otro error (400, 404, etc), también saltamos a la siguiente
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = new Error('Gemini devolvió una respuesta vacía.');
        console.warn(`[GEMINI] ${keyLabel} → Respuesta vacía.`);
        continue;
      }

      const parsed = JSON.parse(cleanJsonResponse(text));
      console.log(`[GEMINI] ✅ ${keyLabel} respondió correctamente.`);
      return parsed;

    } catch (err: any) {
      lastError = err;
      console.warn(`[GEMINI] ${keyLabel} → Excepción:`, err.message);
      continue;
    }
  }

  throw lastError;
};

// ═══════════════════════════════════════════════════════
// UTILIDADES DE IMAGEN
// ═══════════════════════════════════════════════════════

/**
 * Redimensiona y comprime imágenes a JPEG (máx. 1600px, 70% calidad).
 * Los PDFs se devuelven sin modificar.
 */
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
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.7);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/** Convierte un File a string base64 (las imágenes se optimizan a JPEG). */
const fileToBase64 = async (file: File): Promise<string> => {
  const blob = await optimizeImage(file);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

/**
 * optimizeImage() convierte todas las imágenes a JPEG.
 * Se debe reportar 'image/jpeg' sin importar el formato original.
 * Los PDFs conservan su tipo 'application/pdf'.
 */
const getEffectiveMimeType = (file: File): string => {
  if (file.type === 'application/pdf') return 'application/pdf';
  if (file.type.startsWith('image/')) return 'image/jpeg';
  return file.type;
};

// ═══════════════════════════════════════════════════════
// ANÁLISIS DE INFORME CLÍNICO (Imagen / PDF → Biomarcadores)
// ═══════════════════════════════════════════════════════

export const analyzeClinicalReport = async (file: File): Promise<ClinicalAnalysisResult> => {
  const prompt = `
    Analiza este documento médico.
    Tu objetivo es ser un pedagogo médico para un paciente anciano.

    1. Extrae biomarcadores (hemoglobin, albumin, vitaminD, glucoseFasting, egfr, sodium, crp, vitaminB12, tsh, creatinine, ldl, hba1c).
    2. Genera un "summary" con tono cálido: explica primero QUÉ ESTÁ BIEN y luego QUÉ SE PUEDE MEJORAR (sin asustar, lenguaje sencillo).
    3. Responde SOLO en JSON:
       { "summary": "...", "biomarkers": { "hemoglobin": "...", ... }, "recommendations": ["..."] }
  `;

  const mimeType = getEffectiveMimeType(file);
  const base64 = await fileToBase64(file);
  console.log(`[VISION] Informe clínico: ${file.name} | MIME enviado: ${mimeType}`);

  return callGemini({
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }]
  });
};

// ═══════════════════════════════════════════════════════
// ANÁLISIS DE TEXTO CLÍNICO (Texto → Biomarcadores)
// ═══════════════════════════════════════════════════════

export const analyzeClinicalText = async (text: string): Promise<ClinicalAnalysisResult> => {
  const prompt = `
    Analiza el siguiente texto médico.
    Tu objetivo es ser un pedagogo médico para un paciente anciano.

    1. Extrae biomarcadores.
    2. Genera un "summary" cálido: explica qué está bien y qué se puede mejorar.
    3. Responde SOLO en JSON:
       { "summary": "...", "biomarkers": { "hemoglobin": "...", "albumin": "...", "vitaminD": "...", "glucoseFasting": "...", "egfr": "...", "sodium": "...", "crp": "...", "vitaminB12": "...", "tsh": "...", "creatinine": "...", "ldl": "...", "hba1c": "..." }, "recommendations": ["..."] }
    TEXTO: ${text}
  `;

  return callGemini({ contents: [{ parts: [{ text: prompt }] }] });
};

// ═══════════════════════════════════════════════════════
// ANÁLISIS DE FOTO DE COMIDA (Imagen → Nutrición)
// ═══════════════════════════════════════════════════════

export const analyzeFoodPhoto = async (file: File): Promise<NutritionalAnalysisResult> => {
  const prompt = `
    Analiza esta comida para un anciano.
    Tu objetivo es ser un guía nutricional cálido y pedagógico.

    1. Estima: calories (número), nutriScore (letra A/B/C/D/E), nutritionScores (objeto), macros (objeto), micros (objeto).
    2. En "portions": comentario pedagógico sobre qué está bien y qué mejorar.
    3. En "suggestions": array de 3 consejos cortos y prácticos.
    
    Responde SOLO en JSON:
    { "calories": 0, "nutriScore": "A", "nutritionScores": {}, "macros": {}, "micros": {}, "portions": "...", "suggestions": ["..."] }
  `;

  const mimeType = getEffectiveMimeType(file);
  const base64 = await fileToBase64(file);
  console.log(`[VISION] Foto comida: ${file.name} | MIME enviado: ${mimeType}`);

  return callGemini({
    contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType, data: base64 } }] }]
  });
};

// ═══════════════════════════════════════════════════════
// RECOMENDACIONES DE SALUD (Datos → 3 Recomendaciones)
// ═══════════════════════════════════════════════════════

export const generateHealthRecommendations = async (
  healthData: HealthData,
  vigsScore: VigsScore
): Promise<{ title: string; justification: string; step: string }[]> => {
  const prompt = `
    Actúa como un geriatra extremadamente empático.
    Datos de salud: ${JSON.stringify(healthData)}.
    Fragilidad VIGS: ${JSON.stringify(vigsScore)}.

    Genera exactamente 3 recomendaciones de salud para mejorar la vitalidad del paciente.
    Cada recomendación:
    - title: Mensaje positivo y corto.
    - justification: Explicación sencilla (máximo 2 frases).
    - step: Un pequeño paso concreto y fácil para hacer hoy.

    Responde SOLO en JSON: { "recommendations": [{ "title": "...", "justification": "...", "step": "..." }] }
  `;

  try {
    const data = await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
    return data.recommendations || [];
  } catch (err: any) {
    console.error('[GEMINI] generateHealthRecommendations falló:', err.message);
    return [];
  }
};

// ═══════════════════════════════════════════════════════
// RESUMEN DIARIO DE SALUD (Todos los datos → Narrativa IA)
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
    Eres un médico geriatra cálido y cercano. Tu paciente es ${profile.displayName}, de ${profile.age} años.
    Explícale cómo se encuentra hoy y dale una guía de vida sencilla.

    DATOS CLÍNICOS:
    - Peso: ${healthData.weight ?? 'N/D'} kg, IMC: ${bmi ?? 'N/D'}.
    - Tensión: ${healthData.systolicBP ?? 'N/D'}/${healthData.diastolicBP ?? 'N/D'} mmHg.
    - Pulso: ${healthData.pulse ?? 'N/D'} lpm, SatO2: ${healthData.oxygenSaturation ?? 'N/D'}%, Glucosa: ${healthData.glucose ?? 'N/D'} mg/dL.
    - Fragilidad VIGS: ${vigsScore.index < 0.25 ? 'Excelente autonomía' : vigsScore.index < 0.5 ? 'Necesita algo de apoyo' : 'Estado de fragilidad'}.
    - Analíticas recientes: ${JSON.stringify(latestBiomarkers || 'Sin datos')}.
    - Comidas recientes: ${recentMeals.join(', ') || 'Sin registros'}.

    Genera EXACTAMENTE 5 tarjetas en "highlights" con estas etiquetas fijas:
    Hidratación, Actividad Física, Descanso, Nutrición/Salud, Alimentación Equilibrada.

    Responde SOLO en este JSON:
    {
      "greeting": "Saludo afectuoso personalizado",
      "narrative": "Análisis general (4-5 frases cálidas, sin repetir cifras técnicas)",
      "mood": "great|good|okay|watch",
      "highlights": [
        { "label": "Hidratación", "status": "positive|neutral|warning", "detail": "Qué mejorar y cómo hacerlo" },
        { "label": "Actividad Física", "status": "positive|neutral|warning", "detail": "Qué mejorar y cómo hacerlo" },
        { "label": "Descanso", "status": "positive|neutral|warning", "detail": "Qué mejorar y cómo hacerlo" },
        { "label": "Nutrición/Salud", "status": "positive|neutral|warning", "detail": "Qué mejorar y cómo hacerlo" },
        { "label": "Alimentación Equilibrada", "status": "positive|neutral|warning", "detail": "Qué mejorar y cómo hacerlo" }
      ],
      "quickTip": "Un consejo práctico para hoy"
    }
  `;

  try {
    const summary = await callGemini({ contents: [{ parts: [{ text: prompt }] }] });
    if (summary?.greeting) return summary;
    throw new Error('Respuesta incompleta');
  } catch (err: any) {
    console.error('[GEMINI] generateDailySummary falló con todas las claves:', err.message);
    // Fallback estático cuando todas las claves están agotadas
    return {
      greeting: `Hola, ${profile.displayName}`,
      narrative: 'Los servicios de IA están temporalmente sin disponibilidad. Tus datos están guardados y seguros. Pulsa "Actualizar Informe" para volver a intentarlo cuando tengas conexión.',
      mood: 'okay',
      highlights: [
        { label: 'Hidratación', status: 'neutral', detail: 'Recuerda beber al menos 8 vasos de agua hoy para mantener tu cuerpo en equilibrio.' },
        { label: 'Actividad Física', status: 'neutral', detail: 'Un paseo corto de 10 minutos activa la circulación y mejora el ánimo.' },
        { label: 'Descanso', status: 'positive', detail: 'Un buen descanso nocturno es la base de tu energía y bienestar.' },
        { label: 'Nutrición/Salud', status: 'neutral', detail: 'Mantén una dieta variada con frutas, verduras y proteínas.' },
        { label: 'Alimentación Equilibrada', status: 'neutral', detail: 'Toma tus comidas a horas regulares para mantener tu energía estable.' },
      ],
      quickTip: 'Pulsa "Actualizar Informe" para obtener tu análisis personalizado.',
    };
  }
};
