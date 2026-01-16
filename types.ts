
export interface HealthData {
  weight: number | null;
  falls: number | null;
  systolicBP: number | null; // Tensión Alta
  diastolicBP: number | null; // Tensión Baja
  pulse: number | null;
  oxygenSaturation: number | null;
  glucose: number | null;
  calfCircumference: number | null;
  abdominalCircumference: number | null;
  height?: number | null; 
}

export type VigsCategory = 'No frágil' | 'Fragilidad leve' | 'Fragilidad moderada' | 'Fragilidad severa';

export interface VigsScore {
  score: number;
  category: VigsCategory;
  index?: number; // El valor decimal (0.00 - 1.00)
}

// Nueva interfaz para el test VIG completo
export interface VigsAssessment {
  ayuda_dinero: boolean;
  ayuda_telefono: boolean;
  ayuda_medicacion: boolean;
  barthel_grado: number;
  perdida_peso_6m: boolean;
  deterioro_cognitivo_grado: number;
  usa_antidepresivos: boolean;
  usa_psicofarmacos: boolean;
  vulnerabilidad_social: boolean;
  presenta_delirium: boolean;
  caidas_recuentes: boolean;
  presenta_ulceras: boolean;
  polifarmacia: boolean;
  presenta_disfagia: boolean;
  dolor_control_dificil: boolean;
  disnea_basal: boolean;
  enf_oncologica: number;
  enf_respiratoria: number;
  enf_cardiaca: number;
  enf_neurodegenerativa: number;
  enf_digestiva: number;
  enf_renal_cronica: number;
  puntos_totales: number;
  indice_vig_resultado: number;
}

export interface Alert {
  id: number;
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
  isRecommendation?: boolean;
}

export interface Appointment {
  id?: string;
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface Biomarkers {
    hemoglobin: string;
    albumin: string;
    vitaminD: string;
    glucoseFasting: string;
    egfr: string;
    sodium: string;
    crp: string;
    vitaminB12: string;
    tsh: string;
    creatinine: string;
}

export interface ClinicalAnalysisResult {
  summary: string;
  biomarkers: Biomarkers;
  recommendations: string[];
}

export interface NutritionalAnalysisResult {
    calories: string;
    macros: {
        protein: string;
        carbs: string;
        fatsTotal: string;
        fatsSaturated: string;
        fatsUnsaturated: string;
        fatsTrans: string;
        fiber: string;
    };
    micros: {
        calcium: string;
        vitaminD: string;
        vitaminB12: string;
        iron: string;
        sodium: string;
        potassium: string;
    };
    portions: string;
    suggestions: string[];
}

export interface ClinicalAnalysis {
  id: string;
  fileName: string;
  analysis: ClinicalAnalysisResult;
  createdAt: Date;
}

export interface NutritionalAnalysis {
  id: string;
  imagePreview: string;
  analysis: NutritionalAnalysisResult;
  createdAt: Date;
}

export interface UserProfile {
    email: string;
    displayName: string;
    birthDate: string;
    gender: 'male' | 'female' | 'other';
    nationality: string;
    language: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    hasLegalConsent: boolean;
    dataProcessingConsent: boolean;
    avatarId: number;
    diaryPreferences: (keyof HealthData)[];
    healthData: HealthData;
    vigsScore: VigsScore;
    alerts: Alert[];
}
