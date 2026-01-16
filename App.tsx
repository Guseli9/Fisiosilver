
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
import { HomeIcon, BookOpenIcon, ShieldCheckIcon, DocumentTextIcon, BeakerIcon, MicrophoneIcon } from './components/Icons';
import { initializeUser, getClinicalReports, getNutritionLogs } from './services/firestore';

type Tab = 'home' | 'diary' | 'frailty' | 'clinical' | 'nutrition';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

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

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;
        
        try {
            setIsLoadingData(true);
            
            // 1. Get Main Profile
            const profile = await initializeUser(user.uid, user.email || '');
            setHealthData(profile.healthData);
            setVigsScore(profile.vigsScore);
            setAlerts(profile.alerts || []);
            if (profile.diaryPreferences && profile.diaryPreferences.length > 0) {
                setDiaryPreferences(profile.diaryPreferences);
            }

            // 2. Get Subcollections
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
            // FIXED: Corrected the variable name from setLoadingData to setIsLoadingData
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
  }), [healthData, vigsScore, alerts, clinicalAnalyses, nutritionalAnalyses, diaryPreferences]);

  const renderContent = () => {
    if (isLoadingData) {
        return (
            <div className="flex h-full items-center justify-center bg-brand-gray-100">
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
      className={`flex flex-col items-center justify-center w-full pt-2 pb-1 text-sm transition-colors duration-200 ${
        activeTab === tabName ? 'text-brand-blue' : 'text-brand-gray-500 hover:text-brand-blue'
      }`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </button>
  );

  return (
    <AppContext.Provider value={appContextValue}>
      <div className="flex flex-col h-screen font-sans">
        <main className="flex-1 overflow-y-auto pb-24 bg-brand-gray-100">
          {renderContent()}
        </main>
        
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-gray-300 shadow-lg z-10">
            <nav className="flex justify-around max-w-lg mx-auto">
            <TabButton tabName="home" label="Inicio" icon={<HomeIcon />} />
            <TabButton tabName="diary" label="Diario" icon={<BookOpenIcon />} />
            <TabButton tabName="frailty" label="Fragilidad" icon={<ShieldCheckIcon />} />
            <TabButton tabName="clinical" label="Clínico" icon={<DocumentTextIcon />} />
            <TabButton tabName="nutrition" label="Nutrición" icon={<BeakerIcon />} />
            </nav>
        </footer>

        <button
            onClick={() => setIsVoiceAssistantOpen(true)}
            className="fixed bottom-24 right-6 bg-brand-blue text-white p-4 rounded-full shadow-lg z-20 hover:bg-sky-700 transition-transform duration-200 active:scale-95"
            aria-label="Abrir asistente de voz"
        >
            <MicrophoneIcon />
        </button>

        {isVoiceAssistantOpen && (
           <div className="fixed inset-0 z-50 bg-brand-gray-100 h-screen animate-fade-in">
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
            <div className="min-h-screen bg-brand-gray-100 flex items-center justify-center">
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
        </AuthProvider>
    );
};

export default App;
