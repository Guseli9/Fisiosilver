
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { UserProfile, HealthData, ClinicalAnalysis, NutritionalAnalysis, Appointment, VigsAssessment, VigsCategory } from '../types';

const isDemo = !isSupabaseConfigured;

/**
 * Gets a user-friendly error message from Supabase errors.
 */
const getErrorMessage = (error: any): string => {
    if (!error) return "Error desconocido";
    if (typeof error === 'string') return error;
    if (error.message) {
        if (error.message.includes('row-level security') || error.code === '42501') {
            return "Error de seguridad (RLS): No tienes permiso para esta operación. Revisa tu sesión o confirma tu correo.";
        }
        return error.message;
    }
    return JSON.stringify(error);
};

const getCurrentUserId = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
};

// Helper para calcular categoría consistentemente basándose en el IF-VIG decimal
const getCategoryFromIndex = (index: number): VigsCategory => {
    if (index < 0.20) return 'No frágil';
    if (index <= 0.37) return 'Fragilidad leve';
    if (index <= 0.54) return 'Fragilidad moderada';
    return 'Fragilidad severa';
};

// --- Mapping App -> DB ---
const mapProfileToDb = (profile: Partial<UserProfile>) => {
    const dbData: any = {};
    if (profile.email !== undefined) dbData.email = profile.email;
    if (profile.displayName !== undefined) dbData.nombre_completo = profile.displayName;
    if (profile.birthDate !== undefined) dbData.fecha_nacimiento = profile.birthDate || null;
    if (profile.gender !== undefined) dbData.sexo = profile.gender;
    if (profile.nationality !== undefined) dbData.nacionalidad = profile.nationality;
    if (profile.emergencyContactName !== undefined) dbData.contacto_emergencia = profile.emergencyContactName;
    if (profile.avatarId !== undefined) dbData.avatar_id = profile.avatarId;
    if (profile.diaryPreferences !== undefined) dbData.diary_preferences = profile.diaryPreferences;
    if (profile.alerts !== undefined) dbData.alerts_json = profile.alerts;
    
    if (profile.healthData?.height !== undefined) {
        dbData.talla_cm = profile.healthData.height || 170;
    }
    
    return dbData;
};

// --- Mapping DB -> App ---
const mapDbToProfile = (data: any, latestLog?: any, latestVigs?: any): UserProfile => {
    const index = latestVigs?.indice_vig_resultado ?? 0;
    return {
        email: data.email || '',
        displayName: data.nombre_completo || 'Usuario',
        birthDate: data.fecha_nacimiento || '',
        gender: (data.sexo as any) || 'male',
        nationality: data.nacionalidad || '',
        language: 'Español',
        emergencyContactName: data.contacto_emergencia || '',
        emergencyContactPhone: '', 
        diaryPreferences: data.diary_preferences || ['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose'],
        hasLegalConsent: true,
        dataProcessingConsent: true,
        avatarId: data.avatar_id || 0,
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
        alerts: data.alerts_json || []
    };
};

export const initializeUser = async (uid: string, email: string): Promise<UserProfile> => {
    if (isDemo) return mapDbToProfile({ email, nombre_completo: 'Usuario Demo' });
    const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    
    if (!user) {
        const defaultProfile: UserProfile = {
            email, displayName: 'Nuevo Usuario', birthDate: '', gender: 'male', nationality: '',
            language: 'Español', emergencyContactName: '', emergencyContactPhone: '',
            hasLegalConsent: true, dataProcessingConsent: true, avatarId: 0,
            diaryPreferences: ['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose'],
            healthData: { weight: null, falls: null, systolicBP: null, diastolicBP: null, pulse: null, oxygenSaturation: null, glucose: null, calfCircumference: null, abdominalCircumference: null, height: 170 },
            vigsScore: { score: 0, category: 'No frágil', index: 0 },
            alerts: []
        };
        try { await registerUserInDb(uid, defaultProfile); } catch (e) {}
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
    const currentUid = await getCurrentUserId();
    if (!currentUid || currentUid !== uid) throw new Error("Sesión no válida.");

    const dbData = mapProfileToDb(profile);
    const { error } = await supabase.from('users').update(dbData).eq('id', uid);
    if (error) throw new Error(getErrorMessage(error));
};

export const saveVigsAssessment = async (uid: string, answers: Record<string, number>): Promise<void> => {
    if (isDemo) return;
    const currentUid = await getCurrentUserId();
    if (!currentUid || currentUid !== uid) throw new Error("Sesión no válida.");
    
    const totalPoints = Object.values(answers).reduce((sum, val) => sum + val, 0);
    const index = totalPoints / 25.0;

    const dbData = {
        user_id: uid,
        ayuda_dinero: answers.dinero > 0,
        ayuda_telefono: answers.telefono > 0,
        ayuda_medicacion: answers.medicacion > 0,
        barthel_grado: answers.barthel,
        perdida_peso_6m: answers.malnutricion > 0,
        deterioro_cognitivo_grado: answers.deterioro_cognitivo,
        usa_antidepresivos: answers.depresion > 0,
        usa_psicofarmacos: answers.ansiedad > 0,
        vulnerabilidad_social: answers.vulnerabilidad > 0,
        presenta_delirium: answers.confusional > 0,
        caidas_recuentes: answers.caidas > 0,
        presenta_ulceras: answers.ulceras > 0,
        polifarmacia: answers.polifarmacia > 0,
        presenta_disfagia: answers.disfagia > 0,
        dolor_control_dificil: answers.dolor > 0,
        disnea_basal: answers.disnea > 0,
        enf_oncologica: answers.cancer,
        enf_respiratoria: answers.respiratoria,
        enf_cardiaca: answers.cardiaca,
        enf_neurodegenerativa: answers.neurologica,
        enf_digestiva: answers.digestiva,
        enf_renal_cronica: answers.renal,
        puntos_totales: totalPoints,
        indice_vig_resultado: index
    };

    const { error } = await supabase.from('vigs_assessments').insert(dbData);
    if (error) throw new Error(getErrorMessage(error));
};

export const registerUserInDb = async (uid: string, profile: UserProfile): Promise<void> => {
    if (isDemo) return;
    const dbData = { id: uid, ...mapProfileToDb(profile) };
    const { error } = await supabase.from('users').upsert(dbData, { onConflict: 'id' });
    if (error) throw new Error(getErrorMessage(error));
};

export const saveDailyLog = async (uid: string, h: HealthData): Promise<void> => {
    if (isDemo) return;
    const currentUid = await getCurrentUserId();
    if (!currentUid || currentUid !== uid) throw new Error("Sesión no válida.");

    const { error } = await supabase.from('daily_logs').insert({
        user_id: uid, 
        peso_kg: h.weight, 
        tas_mmhg: h.systolicBP, 
        tad_mmhg: h.diastolicBP,
        frec_cardiaca_lpm: h.pulse, 
        sat_o2_pct: h.oxygenSaturation, 
        glucosa_mgdl: h.glucose,
        caidas_detectadas: h.falls,
        pantorrilla_cm: h.calfCircumference,
        abdomen_cm: h.abdominalCircumference
    });
    if (error) throw new Error(getErrorMessage(error));
};

export const getDailyHistory = async (uid: string): Promise<(HealthData & { createdAt: Date })[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));
    
    return (data || []).map(d => ({
        weight: d.peso_kg, 
        systolicBP: d.tas_mmhg, 
        diastolicBP: d.tad_mmhg, 
        pulse: d.frec_cardiaca_lpm,
        oxygenSaturation: d.sat_o2_pct, 
        glucose: d.glucosa_mgdl, 
        falls: d.caidas_detectadas,
        calfCircumference: d.pantorrilla_cm, 
        abdominalCircumference: d.abdomen_cm, 
        createdAt: new Date(d.created_at)
    }));
};

const parseAIValue = (val: string | undefined): number | null => {
    if (!val || val.toLowerCase().includes('no encontrado')) return null;
    const num = parseFloat(val.replace(/[^\d.-]/g, ''));
    return isNaN(num) ? null : num;
};

export const saveClinicalReport = async (uid: string, analysis: ClinicalAnalysis): Promise<void> => {
    if (isDemo) return;
    const bio = analysis.analysis.biomarkers;
    const { error } = await supabase.from('clinical_reports').insert({ 
        user_id: uid, file_name: analysis.fileName, resumen_ia: analysis.analysis.summary,
        hemoglobina: parseAIValue(bio.hemoglobin), albumina: parseAIValue(bio.albumin),
        vitamina_d_25_oh: parseAIValue(bio.vitaminD), glucosa: parseAIValue(bio.glucoseFasting),
        creatinina: parseAIValue(bio.creatinine), pcr: parseAIValue(bio.crp),
        sodio: parseAIValue(bio.sodium), tsh: parseAIValue(bio.tsh), vitamina_b12: parseAIValue(bio.vitaminB12)
    });
    if (error) throw new Error(getErrorMessage(error));
};

export const getClinicalReports = async (uid: string): Promise<ClinicalAnalysis[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('clinical_reports').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));
    
    return (data || []).map(d => ({
        id: d.id, fileName: d.file_name || "Informe sin nombre", createdAt: new Date(d.created_at),
        analysis: {
            summary: d.resumen_ia || "Análisis médico",
            biomarkers: {
                hemoglobin: d.hemoglobina?.toString() || 'No encontrado',
                albumin: d.albumina?.toString() || 'No encontrado',
                vitaminD: d.vitamina_d_25_oh?.toString() || 'No encontrado',
                glucoseFasting: d.glucosa?.toString() || 'No encontrado',
                egfr: 'No disponible', sodium: d.sodio?.toString() || 'No encontrado',
                crp: d.pcr?.toString() || 'No encontrado', vitaminB12: d.vitamina_b12?.toString() || 'No encontrado',
                tsh: d.tsh?.toString() || 'No encontrado', creatinine: d.creatinina?.toString() || 'No encontrado'
            },
            recommendations: []
        }
    }));
};

export const saveNutritionLog = async (uid: string, analysis: NutritionalAnalysis): Promise<void> => {
    if (isDemo) return;
    const { error } = await supabase.from('nutrition_logs').insert({ 
        user_id: uid, foto_url: analysis.imagePreview, comida_descripcion: analysis.analysis.portions,
        calorias_est: parseFloat(analysis.analysis.calories) || null,
        proteinas_g: parseFloat(analysis.analysis.macros.protein) || null,
        carbohidratos_g: parseFloat(analysis.analysis.macros.carbs) || null,
        grasas_g: parseFloat(analysis.analysis.macros.fatsTotal) || null
    });
    if (error) throw new Error(getErrorMessage(error));
};

export const getNutritionLogs = async (uid: string): Promise<NutritionalAnalysis[]> => {
    if (isDemo) return [];
    const { data, error } = await supabase.from('nutrition_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw new Error(getErrorMessage(error));

    return (data || []).map(d => ({
        id: d.id, imagePreview: d.foto_url, createdAt: new Date(d.created_at),
        analysis: {
            calories: d.calorias_est?.toString() || '0',
            macros: {
                protein: d.proteinas_g?.toString() || '0', carbs: d.carbohidratos_g?.toString() || '0',
                fatsTotal: d.grasas_g?.toString() || '0', fatsSaturated: '0', fatsUnsaturated: '0', fatsTrans: '0', fiber: '0'
            },
            micros: { calcium: '0', vitaminD: '0', vitaminB12: '0', iron: '0', sodium: '0', potassium: '0' },
            portions: d.comida_descripcion || "Plato registrado", suggestions: []
        }
    }));
};

export const uploadFile = async (bucket: string, file: File): Promise<string> => {
    const fileName = `${Math.random()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
    if (uploadError) throw new Error(getErrorMessage(uploadError));
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
};

export const saveAppointment = async (uid: string, title: string, description: string): Promise<void> => {
    const { data: userRecord, error: userFetchError } = await supabase.from('users').select('alerts_json').eq('id', uid).maybeSingle();
    if (userFetchError) throw new Error(getErrorMessage(userFetchError));
    const currentAlerts = userRecord?.alerts_json || [];
    const newAlerts = [{ id: Date.now(), type: 'info', title, message: description }, ...currentAlerts];
    const { error: updateError } = await supabase.from('users').update({ alerts_json: newAlerts }).eq('id', uid);
    if (updateError) throw new Error(getErrorMessage(updateError));
};
