
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { UserProfile, HealthData, ClinicalAnalysis, NutritionalAnalysis, VigsCategory, SmokingStatus, VigsScore, NutriScore, NutritionScores } from '../types';

const isDemo = !isSupabaseConfigured;

const getErrorMessage = (error: any): string => {
    if (!error) return "Error desconocido";
    if (typeof error === 'string') return error;
    if (error.message) {
        if (error.message.includes('row-level security') || error.code === '42501') {
            return "Error de permisos (RLS): No tienes permiso para realizar esta operación.";
        }
        return error.message;
    }
    return JSON.stringify(error);
};

const getCategoryFromIndex = (index: number): VigsCategory => {
    if (index < 0.20) return 'No frágil';
    if (index <= 0.37) return 'Fragilidad leve';
    if (index <= 0.54) return 'Fragilidad moderada';
    return 'Fragilidad severa';
};

const mapProfileToDb = (profile: Partial<UserProfile>) => {
    const dbData: any = {};
    if (profile.email !== undefined) dbData.email = profile.email;
    if (profile.displayName !== undefined) dbData.nombre_usuario = profile.displayName;
    if (profile.age !== undefined) dbData.edad = profile.age;
    if (profile.gender !== undefined) dbData.sexo = profile.gender;
    if (profile.nationality !== undefined) dbData.nacionalidad = profile.nationality;
    if (profile.language !== undefined) dbData.idioma = profile.language;
    if (profile.emergencyContactName !== undefined) dbData.contacto_emergencia_nombre = profile.emergencyContactName;
    if (profile.emergencyContactPhone !== undefined) dbData.contacto_emergencia_telefono = profile.emergencyContactPhone;
    if (profile.avatarId !== undefined) dbData.avatar_id = profile.avatarId;
    if (profile.diaryPreferences !== undefined) dbData.diary_preferences = profile.diaryPreferences;
    if (profile.alerts !== undefined) dbData.alerts_json = profile.alerts;
    if (profile.smokingStatus !== undefined) dbData.smoking_status = profile.smokingStatus;
    if (profile.nutritionalScore !== undefined) dbData.nutritional_score = profile.nutritionalScore;

    return dbData;
};

const mapDbToProfile = (data: any, latestLog?: any, latestVigs?: any): UserProfile => {
    const index = latestVigs?.indice_vig_resultado ?? 0;
    return {
        email: data.email || '',
        displayName: data.nombre_usuario || 'Usuario',
        age: data.edad || 75,
        gender: data.sexo || 'male', 
        nationality: data.nacionalidad || 'Española',
        language: data.idioma || 'Español',
        emergencyContactName: data.contacto_emergencia_nombre || '', 
        emergencyContactPhone: data.contacto_emergencia_telefono || '', 
        diaryPreferences: data.diary_preferences || ['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose'],
        hasLegalConsent: true,
        dataProcessingConsent: true,
        avatarId: data.avatar_id || 0,
        smokingStatus: (data.smoking_status as SmokingStatus) || 'Nunca',
        nutritionalScore: data.nutritional_score || 0,
        healthData: { 
            weight: latestLog?.peso_kg ?? null,
            systolicBP: latestLog?.tas_mmhg ?? null,
            diastolicBP: latestLog?.tad_mmhg ?? null,
            pulse: latestLog?.frec_cardiaca_lpm ?? null,
            oxygenSaturation: latestLog?.sat_o2_pct ?? null,
            glucose: latestLog?.glucosa_mgdl ?? null,
            falls: latestLog?.caidas_detectadas ?? null,
            calfCircumference: latestLog?.pantorrilla_cm ?? null,
            abdominalCircumference: latestLog?.abdomen_cm ?? null,
            height: data.talla_cm || 170
        },
        vigsScore: { 
            score: latestVigs?.puntos_totales ?? 0, 
            category: getCategoryFromIndex(index), 
            index: index
        },
        alerts: data.alerts_json || [],
    };
};

export const initializeUser = async (uid: string, email: string): Promise<UserProfile> => {
    if (isDemo) return mapDbToProfile({ email, nombre_usuario: 'Usuario Demo' });
    const { data: user } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (!user) {
        const defaultProfile: UserProfile = {
            email, displayName: 'Nuevo Usuario', age: 75, gender: 'male', nationality: 'Española',
            language: 'Español', emergencyContactName: '', emergencyContactPhone: '',
            hasLegalConsent: true, dataProcessingConsent: true, avatarId: 0,
            diaryPreferences: ['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose'],
            healthData: { weight: null, falls: null, systolicBP: null, diastolicBP: null, pulse: null, oxygenSaturation: null, glucose: null, calfCircumference: null, abdominalCircumference: null, height: 170 },
            vigsScore: { score: 0, category: 'No frágil', index: 0 },
            alerts: [], smokingStatus: 'Nunca', nutritionalScore: 0
        };
        await registerUserInDb(uid, defaultProfile);
        return defaultProfile;
    }
    const { data: latestLog } = await supabase.from('daily_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const { data: latestVigs } = await supabase.from('vigs_assessments').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return mapDbToProfile(user, latestLog, latestVigs);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
    return initializeUser(uid, '');
};

export const updateUserProfile = async (uid: string, profile: Partial<UserProfile>): Promise<void> => {
    if (isDemo) return;
    const dbData = mapProfileToDb(profile);
    // Usamos upsert para asegurar que la fila existe, especialmente si hubo un error en el registro inicial
    const { error } = await supabase.from('users').upsert({ id: uid, ...dbData }, { onConflict: 'id' });
    if (error) throw new Error(getErrorMessage(error));
};

export const saveVigsAssessment = async (uid: string, answers: Record<string, number>): Promise<void> => {
    if (isDemo) return;
    const totalPoints = Object.values(answers).reduce((sum, val) => sum + val, 0);
    const index = totalPoints / 25.0;
    const dbData = {
        user_id: uid, ayuda_dinero: answers.dinero > 0, ayuda_telefono: answers.telefono > 0,
        ayuda_medicacion: answers.medicacion > 0, barthel_grado: Math.min(3, Math.max(0, answers.barthel || 0)),
        perdida_peso_6m: answers.malnutricion > 0, deterioro_cognitivo_grado: Math.min(2, Math.max(0, answers.deterioro_cognitivo || 0)),
        usa_antidepresivos: answers.depresion > 0, usa_psicofarmacos: answers.ansiedad > 0,
        vulnerabilidad_social: answers.vulnerabilidad > 0, presenta_delirium: answers.confusional > 0,
        caidas_recuentes: answers.caidas > 0, presenta_ulceras: answers.ulceras > 0,
        polifarmacia: answers.polifarmacia > 0, presenta_disfagia: answers.disfagia > 0,
        dolor_control_dificil: answers.dolor > 0, disnea_basal: answers.disnea > 0,
        enf_oncologica: Math.min(2, Math.max(0, answers.cancer || 0)), enf_respiratoria: Math.min(2, Math.max(0, answers.respiratoria || 0)),
        enf_cardiaca: Math.min(2, Math.max(0, answers.cardiaca || 0)), enf_neurodegenerativa: Math.min(2, Math.max(0, answers.neurologica || 0)),
        enf_digestiva: Math.min(2, Math.max(0, answers.digestiva || 0)), enf_renal_cronica: Math.min(2, Math.max(0, answers.renal || 0)),
        puntos_totales: totalPoints, indice_vig_resultado: index
    };
    const { error } = await supabase.from('vigs_assessments').insert(dbData);
    if (error) throw new Error(getErrorMessage(error));
};

export const getVigsHistory = async (uid: string): Promise<{ index: number, createdAt: Date }[]> => {
  if (isDemo) return [];
  const { data, error } = await supabase.from('vigs_assessments').select('indice_vig_resultado, created_at').eq('user_id', uid).order('created_at', { ascending: false });
  if (error) throw new Error(getErrorMessage(error));
  return (data || []).map(d => ({ index: d.indice_vig_resultado, createdAt: new Date(d.created_at) }));
};

export const registerUserInDb = async (uid: string, profile: UserProfile): Promise<void> => {
    if (isDemo) return;
    const dbFields = mapProfileToDb(profile);
    const { error } = await supabase.from('users').upsert({ id: uid, ...dbFields }, { onConflict: 'id' });
    if (error) throw new Error(getErrorMessage(error));
};

export const saveDailyLog = async (uid: string, h: HealthData): Promise<void> => {
    if (isDemo) return;
    const { error } = await supabase.from('daily_logs').insert({
        user_id: uid, peso_kg: h.weight, tas_mmhg: h.systolicBP ? Math.round(h.systolicBP) : null, 
        tad_mmhg: h.diastolicBP ? Math.round(h.diastolicBP) : null,
        frec_cardiaca_lpm: h.pulse ? Math.round(h.pulse) : null, sat_o2_pct: h.oxygenSaturation, 
        glucosa_mgdl: h.glucose, caidas_detectadas: h.falls || 0,
        pantorrilla_cm: h.calfCircumference, abdomen_cm: h.abdominalCircumference
    });
    if (error) throw new Error(getErrorMessage(error));
};

export const getDailyHistory = async (uid: string): Promise<(HealthData & { createdAt: Date })[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));
    return (data || []).map(d => ({
        weight: d.peso_kg, systolicBP: d.tas_mmhg, diastolicBP: d.tad_mmhg, pulse: d.frec_cardiaca_lpm,
        oxygenSaturation: d.sat_o2_pct, glucose: d.glucosa_mgdl, falls: d.caidas_detectadas,
        calfCircumference: d.pantorrilla_cm, abdominalCircumference: d.abdomen_cm, createdAt: new Date(d.created_at)
    }));
};

export const saveNutritionLog = async (uid: string, analysis: NutritionalAnalysis): Promise<void> => {
    if (isDemo) return;
    const nsPrefix = analysis.analysis.nutriScore ? `[NS:${analysis.analysis.nutriScore}] ` : "";
    
    // Serializar puntuaciones: p,f,h,m,g,s
    const sc = analysis.analysis.nutritionScores;
    const scContent = sc ? `[SC:${sc.protein},${sc.fiber},${sc.healthyFats},${sc.micronutrients},${sc.glycemicIndex},${sc.sodiumBalance}] ` : "";
    
    const { error } = await supabase.from('nutrition_logs').insert({ 
        user_id: uid, foto_url: analysis.imagePreview, 
        comida_descripcion: `${nsPrefix}${scContent}${analysis.analysis.portions}`,
        calorias_est: parseFloat(analysis.analysis.calories) || null, proteinas_g: parseFloat(analysis.analysis.macros.protein) || null,
        carbohidratos_g: parseFloat(analysis.analysis.macros.carbs) || null, grasas_g: parseFloat(analysis.analysis.macros.fatsTotal) || null
    });
    if (error) throw new Error(getErrorMessage(error));
};


export const getNutritionLogs = async (uid: string): Promise<NutritionalAnalysis[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('nutrition_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));
    return (data || []).map(d => {
        let rawDesc = d.comida_descripcion || "";
        let nutriScore: NutriScore | undefined = undefined;
        let nutritionScores: NutritionScores = { protein: 50, fiber: 50, healthyFats: 50, micronutrients: 50, glycemicIndex: 50, sodiumBalance: 50 };
        
        // Extraer NutriScore [NS:A]
        const nsMatch = rawDesc.match(/\[NS:([A-E])\]/);
        if (nsMatch) {
            nutriScore = nsMatch[1] as NutriScore;
            rawDesc = rawDesc.replace(/\[NS:[A-E]\]\s*/, "");
        }

        // Extraer Scores [SC:80,70,60,90,50,40]
        const scMatch = rawDesc.match(/\[SC:(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\]/);
        if (scMatch) {
            nutritionScores = {
                protein: parseInt(scMatch[1]), fiber: parseInt(scMatch[2]),
                healthyFats: parseInt(scMatch[3]), micronutrients: parseInt(scMatch[4]),
                glycemicIndex: parseInt(scMatch[5]), sodiumBalance: parseInt(scMatch[6])
            };
            rawDesc = rawDesc.replace(/\[SC:[^\]]+\]\s*/, "");
        }

        return {
            id: d.id, imagePreview: d.foto_url, createdAt: new Date(d.created_at),
            analysis: {
                calories: d.calorias_est?.toString() || '0',
                nutriScore,
                nutritionScores,
                macros: {
                    protein: d.proteinas_g?.toString() || '0', carbs: d.carbohidratos_g?.toString() || '0',
                    fatsTotal: d.grasas_g?.toString() || '0', fatsSaturated: '0', fatsUnsaturated: '0', fatsTrans: '0', fiber: '0'
                },
                micros: { calcium: '0', vitaminD: '0', vitaminB12: '0', iron: '0', sodium: '0', potassium: '0' },
                portions: rawDesc, suggestions: []
            }
        };
    });
};

export const uploadFile = async (bucket: string, file: File): Promise<string> => {
    if (isDemo) return URL.createObjectURL(file);
    // Sanitizar nombre de archivo: eliminar acentos y caracteres especiales
    const cleanName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.]/g, "_");
    const fileName = `${Date.now()}_${cleanName}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) throw new Error(getErrorMessage(error));
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
};

export const saveClinicalReport = async (uid: string, analysis: ClinicalAnalysis): Promise<void> => {
    if (isDemo) return;
    const { error } = await supabase.from('clinical_reports').insert({
        user_id: uid, file_name: analysis.fileName, resumen_ia: analysis.analysis.summary,
        hemoglobina: parseFloat(analysis.analysis.biomarkers.hemoglobin) || null,
        albumina: parseFloat(analysis.analysis.biomarkers.albumin) || null,
        vitamina_d_25_oh: parseFloat(analysis.analysis.biomarkers.vitaminD) || null,
        glucosa: parseFloat(analysis.analysis.biomarkers.glucoseFasting) || null,
        creatinina: parseFloat(analysis.analysis.biomarkers.creatinine) || null,
        pcr: parseFloat(analysis.analysis.biomarkers.crp) || null,
        sodio: parseFloat(analysis.analysis.biomarkers.sodium) || null,
        tsh: parseFloat(analysis.analysis.biomarkers.tsh) || null,
        vitamina_b12: parseFloat(analysis.analysis.biomarkers.vitaminB12) || null,
        created_at: analysis.createdAt
    });
    if (error) throw new Error(getErrorMessage(error));
};

export const getClinicalReports = async (uid: string): Promise<ClinicalAnalysis[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('clinical_reports').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));
    return (data || []).map(d => ({
        id: d.id, fileName: d.file_name, createdAt: new Date(d.created_at),
        analysis: {
            summary: d.resumen_ia || "", recommendations: [],
            biomarkers: {
                hemoglobin: d.hemoglobina?.toString() || '---', 
                albumin: d.albumina?.toString() || '---',
                vitaminD: d.vitamina_d_25_oh?.toString() || '---', 
                glucoseFasting: d.glucosa?.toString() || '---', 
                egfr: '---', 
                sodium: d.sodio?.toString() || '---', 
                crp: d.pcr?.toString() || '---', 
                vitaminB12: d.vitamina_b12?.toString() || '---', 
                tsh: d.tsh?.toString() || '---', 
                creatinine: d.creatinina?.toString() || '---',
                ldl: '---',
                hba1c: '---'
            }
        }
    }));
};
