
import React, { useState, useMemo, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppContext } from './contexts/AppContext';
import type { HealthData, VigsScore, Alert, ClinicalAnalysis, NutritionalAnalysis } from './types';
import HomeScreen from './screens/HomeScreen';
import DiaryScreen from './screens/DiaryScreen';
import FrailtyScreen from './screens/FrailtyScreen';
import ClinicalScreen from './screens/ClinicalScreen';
import NutritionScreen from './screens/NutritionScreen';
import VoiceAssistantScreen from './screens/VoiceAssistantScreen';
import LoginScreen from './screens/LoginScreen';
import { HomeIcon, BookOpenIcon, ClipboardListIcon, DocumentTextIcon, AppleIcon, MicrophoneIcon } from './components/Icons';
import { initializeUser, getClinicalReports, getNutritionLogs } from './services/firestore';
import { Analytics } from '@vercel/analytics/react';

type Tab = 'home' | 'diary' | 'frailty' | 'clinical' | 'nutrition';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);

  // --- API Key Check ---
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Fallback for local dev if window.aistudio is not present
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // --- State Initialization ---
  const [healthData, setHealthData] = useState<HealthData>({
    weight: null, falls: null, systolicBP: null, diastolicBP: null, pulse: null, 
    oxygenSaturation: null, glucose: null, calfCircumference: null, abdominalCircumference: null
  });
  
  const [vigsScore, setVigsScore] = useState<VigsScore>({ score: 0, category: 'No frágil' });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [clinicalAnalyses, setClinicalAnalyses] = useState<ClinicalAnalysis[]>([]);
  const [nutritionalAnalyses, setNutritionalAnalyses] = useState<NutritionalAnalysis[]>([]);
  const [diaryPreferences, setDiaryPreferences] = useState<(keyof HealthData)[]>([
    'weight', 'systolicBP', 'diastolicBP', 'pulse', 'oxygenSaturation', 'glucose', 'falls', 'calfCircumference', 'abdominalCircumference'
  ]);
  const [predictions, setPredictions] = useState<{ mortality: number; hospitalization: number; cvRisk: number; fallsRisk: number; lastUpdated?: string }>({ mortality: 0, hospitalization: 0, cvRisk: 0, fallsRisk: 0, lastUpdated: undefined });

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;
        
        try {
            setIsLoadingData(true);
            const profile = await initializeUser(user.uid, user.email || '');
            setHealthData(profile.healthData);
            setVigsScore(profile.vigsScore);
            setAlerts(profile.alerts || []);
            if (profile.diaryPreferences && profile.diaryPreferences.length > 0) {
                setDiaryPreferences(profile.diaryPreferences);
            }

            const [clinicalDocs, nutritionDocs] = await Promise.all([
                getClinicalReports(user.uid),
                getNutritionLogs(user.uid)
            ]);
            
            setClinicalAnalyses(clinicalDocs);
            setNutritionalAnalyses(nutritionDocs);

        } catch (error: any) {
            console.error("Error fetching data:", error);
            setAlerts([{ id: 999, type: 'danger', title: 'Error de Conexión', message: 'No se pudieron cargar sus datos más recientes.' }]);
        } finally {
            setIsLoadingData(false);
        }
    };

    fetchData();
  }, [user]);

  const appContextValue = useMemo(() => ({
    healthData, setHealthData,
    vigsScore, setVigsScore,
    alerts, setAlerts,
    clinicalAnalyses, setClinicalAnalyses,
    nutritionalAnalyses, setNutritionalAnalyses,
    diaryPreferences, setDiaryPreferences,
    predictions, setPredictions,
  }), [healthData, vigsScore, alerts, clinicalAnalyses, nutritionalAnalyses, diaryPreferences, predictions]);

  const renderContent = () => {
    if (!hasApiKey) {
        return (
            <div className="flex h-full items-center justify-center bg-brand-bg p-8">
                <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-soft text-center border border-brand-gray-100">
                    <div className="w-20 h-20 bg-brand-blue/10 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-8">
                        <ClipboardListIcon className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-brand-gray-900 tracking-tighter uppercase mb-4">Configuración Requerida</h2>
                    <p className="text-brand-gray-600 font-bold text-sm mb-10 leading-relaxed">Para utilizar las funciones de Inteligencia Artificial (Análisis de analíticas y nutrición), es necesario configurar una clave de API de Google Cloud.</p>
                    <button 
                        onClick={handleOpenKeySelector}
                        className="w-full bg-brand-blue text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-soft hover:scale-[1.02] transition-all"
                    >
                        Configurar Clave de IA
                    </button>
                    <p className="mt-6 text-[10px] font-bold text-brand-gray-400 uppercase tracking-widest">
                        Consulte la <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-brand-blue underline">documentación de facturación</a>.
                    </p>
                </div>
            </div>
        );
    }

    if (isLoadingData) {
        return (
            <div className="flex h-full items-center justify-center bg-brand-bg">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-blue mb-4"></div>
                    <p className="text-brand-gray-600 font-medium">Conectando con su historial...</p>
                </div>
            </div>
        );
    }

    switch (activeTab) {
      case 'home': return <HomeScreen />;
      case 'diary': return <DiaryScreen />;
      case 'frailty': return <FrailtyScreen />;
      case 'clinical': return <ClinicalScreen />;
      case 'nutrition': return <NutritionScreen />;
      default: return <HomeScreen />;
    }
  };

  const TabButton = ({ tabName, label, icon }: { tabName: Tab; label: string; icon: React.ReactNode }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`flex flex-col items-center justify-center w-full pt-3 pb-2 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
        activeTab === tabName ? 'text-brand-blue scale-110' : 'text-brand-gray-400 hover:text-brand-blue/70'
      }`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </button>
  );

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="flex flex-col h-screen font-sans bg-brand-bg">
        <main className="flex-1 overflow-y-auto pb-32">
          {renderContent()}
        </main>
        
        <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-brand-gray-100 shadow-[0_-4px_20px_-2px_rgba(0,0,0,0.05)] z-40 px-4 pb-safe">
            <nav className="flex justify-around max-w-lg mx-auto h-20 items-center">
                <TabButton tabName="home" label="Inicio" icon={<HomeIcon />} />
                <TabButton tabName="diary" label="Diario" icon={<BookOpenIcon />} />
                <TabButton tabName="frailty" label="VIGS" icon={<ClipboardListIcon />} />
                <TabButton tabName="clinical" label="Docs" icon={<DocumentTextIcon />} />
                <TabButton tabName="nutrition" label="Nutri" icon={<AppleIcon />} />
            </nav>
        </footer>

        <button
            onClick={() => setIsVoiceAssistantOpen(true)}
            className="fixed bottom-28 right-6 bg-brand-blue text-white p-5 rounded-full shadow-soft-lg z-30 hover:scale-110 active:scale-95 transition-all duration-300 ring-8 ring-brand-blue/10"
            aria-label="Abrir asistente de voz"
        >
            <MicrophoneIcon />
        </button>

        {isVoiceAssistantOpen && (
           <div className="fixed inset-0 z-50 bg-brand-bg h-screen animate-fade-in overflow-hidden">
              <VoiceAssistantScreen onClose={() => setIsVoiceAssistantOpen(false)} />
           </div>
        )}
      </div>
    </AppContext.Provider>
  );
};

const AuthGate: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-brand-bg flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-brand-blue"></div>
            </div>
        );
    }

    if (!user) {
        return <LoginScreen />;
    }

    return <MainApp />;
}

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AuthGate />
            <Analytics />
        </AuthProvider>
    );
};

export default App;
