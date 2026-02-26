
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
export type SmokingStatus = 'Nunca' | 'Ex-fumador' | 'Activo';
export type NutriScore = 'A' | 'B' | 'C' | 'D' | 'E';

export interface VigsScore {
  score: number;
  category: VigsCategory;
  index?: number; // El valor decimal (0.00 - 1.00)
}

export interface Alert {
  id: number;
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
  isRecommendation?: boolean;
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
    nutriScore?: NutriScore;
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
    smokingStatus: SmokingStatus;
    nutritionalScore: number;
}
