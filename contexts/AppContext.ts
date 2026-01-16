
import React, { createContext } from 'react';
import type { HealthData, VigsScore, Alert, ClinicalAnalysis, NutritionalAnalysis } from '../types';

interface AppContextType {
  healthData: HealthData;
  setHealthData: React.Dispatch<React.SetStateAction<HealthData>>;
  vigsScore: VigsScore;
  setVigsScore: React.Dispatch<React.SetStateAction<VigsScore>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  clinicalAnalyses: ClinicalAnalysis[];
  setClinicalAnalyses: React.Dispatch<React.SetStateAction<ClinicalAnalysis[]>>;
  nutritionalAnalyses: NutritionalAnalysis[];
  setNutritionalAnalyses: React.Dispatch<React.SetStateAction<NutritionalAnalysis[]>>;
  diaryPreferences: (keyof HealthData)[]; // NEW
  setDiaryPreferences: React.Dispatch<React.SetStateAction<(keyof HealthData)[]>>; // NEW
}

export const AppContext = createContext<AppContextType | null>(null);
