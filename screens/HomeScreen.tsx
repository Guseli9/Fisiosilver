
import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getDailyHistory, updateUserProfile, getUserProfile, getVigsHistory, getNutritionLogs } from '../services/firestore';
import { predictMortality, predictHospitalization, predictCVRisk } from '../services/mlService';
import type { VigsCategory, HealthData, UserProfile, SmokingStatus, NutriScore } from '../types';
import { XMarkIcon, avatars, PencilSquareIcon, CheckCircleIcon } from '../components/Icons';

const diaryOptions = [
    { id: 'weight', label: 'Peso Corporal (kg)' },
    { id: 'systolicBP', label: 'Tensión Sistólica (mmHg)' },
    { id: 'diastolicBP', label: 'Tensión Diastólica (mmHg)' },
    { id: 'pulse', label: 'Pulso (LPM)' },
    { id: 'oxygenSaturation', label: 'Saturación Oxígeno (%)' },
    { id: 'glucose', label: 'Azúcar en Sangre (mg/dl)' },
    { id: 'falls', label: 'Control de Caídas (nº)' },
    { id: 'calfCircumference', label: 'Pantorrilla (cm)' },
    { id: 'abdominalCircumference', label: 'Abdomen (cm)' },
];

const smokingOptions: { id: SmokingStatus; label: string }[] = [
    { id: 'Nunca', label: 'Nunca' },
    { id: 'Ex-fumador', label: 'Ex-fumador' },
    { id: 'Activo', label: 'Fumador' },
];

const getVigsColorClass = (category: VigsCategory): string => {
  switch (category) {
    case 'No frágil': return 'text-brand-green bg-brand-soft-green';
    case 'Fragilidad leve': return 'text-emerald-600 bg-emerald-50';
    case 'Fragilidad moderada': return 'text-brand-yellow bg-brand-soft-yellow';
    case 'Fragilidad severa': return 'text-brand-red bg-brand-soft-red';
    default: return 'text-brand-gray-500 bg-brand-gray-100';
  }
};

const getNutriScoreColor = (score?: NutriScore): string => {
    switch (score) {
        case 'A': return 'bg-brand-green';
        case 'B': return 'bg-emerald-500';
        case 'C': return 'bg-brand-yellow';
        case 'D': return 'bg-orange-500';
        case 'E': return 'bg-brand-red';
        default: return 'bg-brand-gray-200';
    }
};

interface ChartDataPoint { date: Date; value: number; }

const HistoryChart: React.FC<{ 
    data: ChartDataPoint[]; 
    color: string; 
    unit: string;
    range?: { min: number; max: number };
}> = ({ data, color, unit, range }) => {
    if (data.length === 0) return <div className="h-40 flex items-center justify-center bg-brand-gray-50 rounded-2xl"><p className="text-brand-gray-400 text-[10px] font-black uppercase tracking-widest">Sin historial</p></div>;
    const width = 400; const height = 180; const px = 40; const py = 30;
    const values = data.map(d => d.value);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);
    if (range) { minV = Math.min(minV, range.min); maxV = Math.max(maxV, range.max); }
    const buf = (maxV - minV) * 0.2 || 5;
    minV = Math.max(0, minV - buf); maxV = maxV + buf;
    const r = maxV - minV || 1;
    const getX = (i: number) => px + (i / Math.max(1, data.length - 1)) * (width - 2 * px);
    const getY = (v: number) => height - py - ((v - minV) / r) * (height - 2 * py);
    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ');
    
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            {range && (
                <>
                    <rect x={px} y={getY(range.max)} width={width - 2 * px} height={Math.max(2, Math.abs(getY(range.min) - getY(range.max)))} fill="rgba(46,125,50,0.08)" rx="4" />
                    <text x={px-5} y={getY(range.max)} textAnchor="end" className="text-[6px] fill-brand-green font-black">Máx</text>
                    <text x={px-5} y={getY(range.min)} textAnchor="end" className="text-[6px] fill-brand-green font-black">Mín</text>
                </>
            )}
            <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((d, i) => (
                <circle key={i} cx={getX(i)} cy={getY(d.value)} r="4" fill="white" stroke={color} strokeWidth="3" />
            ))}
            <text x={px} y={height - 5} className="text-[8px] font-black fill-brand-gray-400">{data[0].date.toLocaleDateString()}</text>
            <text x={width - px} y={height - 5} textAnchor="end" className="text-[8px] font-black fill-brand-gray-400">{data[data.length-1].date.toLocaleDateString()}</text>
        </svg>
    );
};

const IndexCard: React.FC<{ 
    title: string; value: string | number; percent: number; 
    description: string; inverted?: boolean; category?: string; categoryClass?: string;
    onClick?: () => void; customColor?: string;
}> = ({ title, value, percent, description, inverted = false, category, categoryClass, onClick, customColor }) => {
    const getColor = (p: number) => {
        if (customColor) return customColor;
        if (inverted) return p > 70 ? 'bg-brand-green' : p > 40 ? 'bg-brand-yellow' : 'bg-brand-red';
        return p < 30 ? 'bg-brand-green' : p < 60 ? 'bg-brand-yellow' : 'bg-brand-red';
    };
    return (
        <button onClick={onClick} className="bg-white p-6 rounded-v-large shadow-soft border border-brand-gray-100 flex flex-col justify-between min-h-[220px] transition-all hover:shadow-soft-lg group text-left w-full active:scale-[0.98]">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <h2 className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest">{title}</h2>
                    {category && <div className={`px-2 py-0.5 rounded-full font-black text-[8px] uppercase tracking-wider ${categoryClass}`}>{category}</div>}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-5xl font-black text-brand-gray-900 tracking-tighter leading-none">{value}</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="w-full h-2.5 bg-brand-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${getColor(percent)}`} style={{ width: `${Math.max(5, percent)}%` }} />
                </div>
                <p className="text-brand-gray-600 text-[10px] font-bold leading-tight">{description}</p>
            </div>
        </button>
    );
};

const HomeScreen: React.FC = () => {
    const { user, signOut } = useAuth();
    const { 
        healthData, setHealthData, 
        setDiaryPreferences, diaryPreferences, 
        setVigsScore, vigsScore,
        predictions, setPredictions,
        clinicalAnalyses
    } = useContext(AppContext)!;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [latestNutriScore, setLatestNutriScore] = useState<NutriScore | undefined>(undefined);
    
    const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [lastFeatures, setLastFeatures] = useState<number[]>([]);
    const [selectedDetail, setSelectedDetail] = useState<{ label: string, key: string, unit: string, range?: {min: number, max: number} } | null>(null);
    const [detailHistory, setDetailHistory] = useState<ChartDataPoint[]>([]);
    const isRunningPredictionsRef = React.useRef(false);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [editName, setEditName] = useState("");
    const [editAge, setEditAge] = useState("");
    const [editHeight, setEditHeight] = useState("");
    const [editGender, setEditGender] = useState<'male' | 'female' | 'other'>("male");
    const [editSmoking, setEditSmoking] = useState<SmokingStatus>("Nunca");
    const [editPrefs, setEditPrefs] = useState<(keyof HealthData)[]>([]);

    const calculatedIndices = useMemo(() => {
        const vigs = vigsScore.index || (vigsScore.score / 25);
        const sys = healthData.systolicBP || 120;
        const falls = healthData.falls || 0;
        const calf = healthData.calfCircumference || 34;
        const edad = profile?.age || 75;
        
        const smokeFactor = profile?.smokingStatus === 'Activo' ? 20 : profile?.smokingStatus === 'Ex-fumador' ? 5 : 0;
        const prot = Math.max(0, Math.min(100, (1 - vigs) * 100));
        const cvRisk = Math.min(100, ((sys - 110) / 70 * 80) + smokeFactor);
        
        // --- CÁLCULO MATEMÁTICO RIESGO DE CAÍDAS (Propuesta 1) ---
        const vigsPoints = vigs * 50;
        const historyPoints = (falls > 0) ? 20 : 0;
        const sarcopeniaPoints = (calf < 31) ? 15 : 0;
        const agePoints = Math.min(10, Math.max(0, (edad - 65) / 30 * 10));
        const fallRisk = Math.min(100, vigsPoints + historyPoints + sarcopeniaPoints + agePoints);
        
        let nutriPercent = 0;
        if (latestNutriScore === 'A') nutriPercent = 100;
        else if (latestNutriScore === 'B') nutriPercent = 80;
        else if (latestNutriScore === 'C') nutriPercent = 60;
        else if (latestNutriScore === 'D') nutriPercent = 40;
        else if (latestNutriScore === 'E') nutriPercent = 20;

        return { autonomy: vigs * 100, protection: prot, cardio: cvRisk, falls: fallRisk, nutrition: nutriPercent };
    }, [vigsScore, healthData, profile, latestNutriScore]);

    const loadProfile = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [pData, nLogs] = await Promise.all([
                getUserProfile(user.uid),
                getNutritionLogs(user.uid)
            ]);
            if (pData) {
                setProfile(pData);
                setHealthData(pData.healthData);
                setDiaryPreferences(pData.diaryPreferences);
                setVigsScore(pData.vigsScore);
                setEditName(pData.displayName);
                setEditAge(pData.age.toString());
                setEditHeight(pData.healthData.height?.toString() || "170");
                setEditGender(pData.gender);
                setEditSmoking(pData.smokingStatus);
                setEditPrefs(pData.diaryPreferences);
            }
            if (nLogs.length > 0) {
                setLatestNutriScore(nLogs[0].analysis.nutriScore);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadProfile(); }, [user]);

    useEffect(() => {
        console.log("Predictions state updated:", predictions);
    }, [predictions]);

    const runPredictions = useCallback(async () => {
        // Evitar re-entrada si ya se está ejecutando
        if (isRunningPredictionsRef.current) {
            console.log("Predictions already in progress, skipping...");
            return;
        }

        // Permitimos ejecutar si tenemos healthData y vigsScore
        if (!healthData || !vigsScore) {
            console.log("Predictions skipped: missing healthData or vigsScore");
            return;
        }
        
        isRunningPredictionsRef.current = true;
        setIsLoadingPredictions(true);
        console.log("--- INICIO PREDICCIÓN IA ---");
        
        try {
            // Verificamos si hay datos reales para predecir. 
            // Si no hay analíticas ni registros de tensión, devolvemos 0 para no confundir al usuario nuevo.
            const hasClinicalData = clinicalAnalyses.length > 0;
            const hasDailyData = healthData.systolicBP !== null || healthData.glucose !== null || healthData.calfCircumference !== null;
            
            if (!hasClinicalData && !hasDailyData) {
                console.log("No real data found, setting predictions to 0");
                setPredictions({
                    mortality: 0,
                    hospitalization: 0,
                    cvRisk: 0,
                    fallsRisk: 0,
                    lastUpdated: new Date().toLocaleTimeString()
                });
                return;
            }

            // Valores por defecto seguros si faltan datos
            const latestClinical = clinicalAnalyses.length > 0 ? clinicalAnalyses[0].analysis.biomarkers : null;
            
            const parseVal = (val: string | undefined | null) => {
                if (!val || val === '---') return null;
                const num = parseFloat(val.toString().replace(',', '.'));
                return isNaN(num) ? null : num;
            };

            const edad = profile?.age || 75;
            const vigsIndex = vigsScore.index !== undefined ? vigsScore.index : (vigsScore.score / 25) || 0;
            const albumin = parseVal(latestClinical?.albumin) || 4.0;
            const calf = healthData.calfCircumference || 34;
            const hemoglobin = parseVal(latestClinical?.hemoglobin) || 13.5;
            const pcr = parseVal(latestClinical?.crp) || 0.5;
            const vitD = parseVal(latestClinical?.vitaminD) || 30;
            const creatinine = parseVal(latestClinical?.creatinine) || 0.9;
            const tas = healthData.systolicBP || 120;
            const ldl = parseVal(latestClinical?.ldl) || 100;
            const hba1c = parseVal(latestClinical?.hba1c) || 5.7;

            const features = [
                edad, vigsIndex, albumin, calf, hemoglobin, pcr, vitD, creatinine, tas, ldl, hba1c
            ];

            console.log("Features prepared:", {
                edad, vigsIndex, albumin, calf, hemoglobin, pcr, vitD, creatinine, tas, ldl, hba1c
            });
            setLastFeatures(features);

            // Ejecutamos secuencialmente para evitar conflictos de sesión en algunos navegadores
            const m = await predictMortality(features).catch(err => { console.error("Mortality model failed:", err); return 0; });
            const h = await predictHospitalization(features).catch(err => { console.error("Hospitalization model failed:", err); return 0; });
            const cv = await predictCVRisk(features).catch(err => { console.error("CV Risk model failed:", err); return 0; });
            
            // --- CÁLCULO MATEMÁTICO RIESGO DE CAÍDAS (Propuesta 1) ---
            const vigsPoints = vigsIndex * 50;
            const historyPoints = (healthData.falls && healthData.falls > 0) ? 20 : 0;
            const sarcopeniaPoints = (healthData.calfCircumference && healthData.calfCircumference < 31) ? 15 : 0;
            const agePoints = Math.min(10, Math.max(0, (edad - 65) / 30 * 10));
            const fallsRiskCalc = Math.min(100, vigsPoints + historyPoints + sarcopeniaPoints + agePoints);

            console.log("RAW MODEL OUTPUTS:", { m, h, cv, fallsRiskCalc });

            // Aseguramos que los valores sean coherentes (0-100%)
            const clamp = (val: number) => {
                // Si el valor es muy pequeño pero no cero, aseguramos que se vea algo
                if (val > 0 && val < 0.001) return 0.1;
                if (val > 1) return Math.min(100, val);
                return Math.max(0, Math.min(100, val * 100));
            };

            const newPredictions = {
                mortality: clamp(m),
                hospitalization: clamp(h),
                cvRisk: clamp(cv),
                fallsRisk: clamp(fallsRiskCalc / 100), // clamp espera 0-1 o 0-100, fallsRiskCalc es 0-100
                lastUpdated: new Date().toLocaleTimeString()
            };

            console.log("Setting new predictions:", newPredictions);
            setPredictions(newPredictions);
        } catch (e) {
            console.error("Critical error in prediction pipeline:", e);
        } finally {
            isRunningPredictionsRef.current = false;
            setIsLoadingPredictions(false);
            console.log("--- FIN PREDICCIÓN IA ---");
        }
    }, [healthData, vigsScore, profile, clinicalAnalyses, setPredictions]);

    useEffect(() => {
        // Ejecutamos si tenemos los datos mínimos, el profile es opcional para el tabaquismo
        if (healthData && vigsScore) {
            runPredictions();
        }
    }, [runPredictions]);

    const handleSaveProfile = async () => {
        if (!user) return;
        try {
            const ageNum = parseInt(editAge);
            const heightNum = parseFloat(editHeight.replace(',', '.'));
            
            await updateUserProfile(user.uid, {
                displayName: editName,
                age: isNaN(ageNum) ? 75 : ageNum,
                gender: editGender,
                smokingStatus: editSmoking,
                diaryPreferences: editPrefs,
                healthData: { ...healthData, height: isNaN(heightNum) ? 170 : heightNum }
            });
            await loadProfile();
            setSuccessMessage("Perfil actualizado correctamente.");
            setTimeout(() => setSuccessMessage(null), 3000);
            setIsEditing(false);
            setIsProfileOpen(false);
        } catch (e: any) { 
            console.error(e);
            alert("Error al actualizar perfil: " + (e.message || "Error desconocido")); 
        }
    };

    const handleDetail = async (label: string, key: string, unit: string, range?: {min: number, max: number}) => {
        if (!user) return;
        setSelectedDetail({ label, key, unit, range });
        try {
            if (key === 'vigs') {
                const hist = await getVigsHistory(user.uid);
                setDetailHistory(hist.map(h => ({ date: h.createdAt, value: h.index })).reverse());
            } else if (key === 'systolicBP' || key === 'diastolicBP' || key === 'weight' || key === 'pulse' || key === 'glucose' || key === 'oxygenSaturation') {
                const logs = await getDailyHistory(user.uid);
                setDetailHistory(logs.map(l => ({ date: l.createdAt, value: l[key as keyof HealthData] as number })).filter(d => d.value !== null).reverse());
            } else if (key === 'cardio') {
                const logs = await getDailyHistory(user.uid);
                const sFactor = profile?.smokingStatus === 'Activo' ? 20 : profile?.smokingStatus === 'Ex-fumador' ? 5 : 0;
                setDetailHistory(logs.map(l => ({ date: l.createdAt, value: Math.min(100, (( (l.systolicBP || 120) - 110) / 70 * 80) + sFactor) })).reverse());
            } else {
                setDetailHistory([]);
            }
        } catch (e) { console.error(e); }
    };

    const AvatarComponent = profile ? avatars[profile.avatarId] || avatars[0] : avatars[0];

    if (isLoading) return <div className="flex h-screen items-center justify-center bg-brand-bg"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div></div>;

    return (
        <div className="p-6 max-w-6xl mx-auto pb-32">
            <header className="flex justify-between items-center mb-12 pt-4">
                <div>
                    <p className="text-brand-gray-500 font-black uppercase tracking-[0.4em] text-[10px] mb-2">Monitor Fisiosilver</p>
                    <h1 className="text-4xl font-black text-brand-gray-900 tracking-tighter leading-tight">Buenos días, <br/><span className="text-brand-blue">{profile?.displayName}</span></h1>
                </div>
                <button onClick={() => { setIsProfileOpen(true); setIsEditing(false); }} className="bg-white p-1 rounded-full shadow-soft border-4 border-brand-blue/5">
                    <AvatarComponent className="w-16 h-16" />
                </button>
            </header>

            {successMessage && (
                <div className="mb-8 p-4 bg-brand-soft-green text-brand-green rounded-2xl border border-brand-green/10 font-black text-center uppercase text-[10px] tracking-widest animate-fade-in">
                    {successMessage}
                </div>
            )}

            <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em] mb-6 ml-2">Índices Principales</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
                <IndexCard title="Autonomía (VIGS)" onClick={() => handleDetail("Autonomía", "vigs", "VIGS", {min: 0, max: 0.2})} value={vigsScore.index?.toFixed(2) || '0.00'} percent={calculatedIndices.autonomy} description="Independencia funcional." category={vigsScore.category} categoryClass={getVigsColorClass(vigsScore.category)} />
                <IndexCard title="Score Nutri" value={latestNutriScore || '---'} percent={calculatedIndices.nutrition} customColor={getNutriScoreColor(latestNutriScore)} description="Calidad de la última comida fotografiada." />
            </div>

            <div className="flex justify-between items-center mb-6 ml-2">
                <div className="flex flex-col">
                    <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em]">Predicciones de Riesgo (IA)</h2>
                    {predictions.lastUpdated && (
                        <span className="text-[8px] font-bold text-brand-gray-400 uppercase tracking-widest mt-1">Actualizado: {predictions.lastUpdated}</span>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button 
                        onClick={runPredictions} 
                        disabled={isLoadingPredictions}
                        className={`text-[9px] font-black uppercase tracking-widest hover:underline disabled:opacity-50 flex items-center gap-2 ${isLoadingPredictions ? 'text-brand-gray-400' : 'text-brand-blue'}`}
                    >
                        {isLoadingPredictions && <div className="w-2 h-2 rounded-full bg-brand-blue animate-ping" />}
                        {isLoadingPredictions ? 'Calculando Riesgos...' : 'Recalcular Predicciones'}
                    </button>
                    <button 
                        onClick={() => setShowDebug(!showDebug)} 
                        className="text-[9px] font-black text-brand-gray-400 uppercase tracking-widest hover:underline"
                    >
                        {showDebug ? 'Ocultar Debug' : 'Ver Inputs'}
                    </button>
                </div>
            </div>

            {showDebug && (
                <div className="mb-8 p-4 bg-brand-gray-900 text-brand-green font-mono text-[10px] rounded-xl overflow-x-auto">
                    <div className="flex justify-between items-center mb-4">
                        <p className="font-black uppercase text-white">Vectores de entrada al modelo (IA - 11 Variables):</p>
                        <button 
                            onClick={() => {
                                setPredictions({
                                    mortality: Math.random() * 20,
                                    hospitalization: Math.random() * 40,
                                    cvRisk: Math.random() * 30,
                                    fallsRisk: Math.random() * 25,
                                    lastUpdated: new Date().toLocaleTimeString() + " (Simulado)"
                                });
                            }}
                            className="bg-brand-green text-brand-gray-900 px-2 py-1 rounded font-black uppercase text-[8px]"
                        >
                            Simular Cambio UI
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-11 gap-2">
                        {['EDAD', 'VIGS', 'ALB', 'PANT', 'HEMO', 'PCR', 'VITD', 'CREA', 'TAS', 'LDL', 'HBA1C'].map((h, i) => (
                            <div key={h} className="border border-brand-green/30 p-2 rounded">
                                <p className="opacity-50">{h}</p>
                                <p className="text-sm font-black">{lastFeatures[i]?.toFixed(2) || '--'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
                <IndexCard 
                    title="Riesgo Mortalidad" 
                    value={`${predictions.mortality.toFixed(1)}%`} 
                    percent={predictions.mortality} 
                    description="Probabilidad de evento fatal a 1 año." 
                    category={predictions.mortality > 15 ? 'Alto' : predictions.mortality > 5 ? 'Moderado' : 'Bajo'}
                    categoryClass={predictions.mortality > 15 ? 'text-brand-red bg-brand-soft-red' : predictions.mortality > 5 ? 'text-brand-orange bg-brand-soft-orange' : 'text-brand-green bg-brand-soft-green'}
                />
                <IndexCard 
                    title="Riesgo Hospitalización" 
                    value={`${predictions.hospitalization.toFixed(1)}%`} 
                    percent={predictions.hospitalization} 
                    description="Probabilidad de ingreso hospitalario." 
                    category={predictions.hospitalization > 30 ? 'Alto' : predictions.hospitalization > 15 ? 'Moderado' : 'Bajo'}
                    categoryClass={predictions.hospitalization > 30 ? 'text-brand-red bg-brand-soft-red' : predictions.hospitalization > 15 ? 'text-brand-orange bg-brand-soft-orange' : 'text-brand-green bg-brand-soft-green'}
                />
                <IndexCard 
                    title="Riesgo Cardiovascular" 
                    value={`${predictions.cvRisk.toFixed(1)}%`} 
                    percent={predictions.cvRisk} 
                    description="Probabilidad de evento CV mayor." 
                    category={predictions.cvRisk > 20 ? 'Alto' : predictions.cvRisk > 10 ? 'Moderado' : 'Bajo'}
                    categoryClass={predictions.cvRisk > 20 ? 'text-brand-red bg-brand-soft-red' : predictions.cvRisk > 10 ? 'text-brand-orange bg-brand-soft-orange' : 'text-brand-green bg-brand-soft-green'}
                />
                <IndexCard 
                    title="Riesgo Caídas (IA)" 
                    value={`${predictions.fallsRisk.toFixed(1)}%`} 
                    percent={predictions.fallsRisk} 
                    description="Probabilidad matemática de caídas." 
                    category={predictions.fallsRisk > 40 ? 'Alto' : predictions.fallsRisk > 20 ? 'Moderado' : 'Bajo'}
                    categoryClass={predictions.fallsRisk > 40 ? 'text-brand-red bg-brand-soft-red' : predictions.fallsRisk > 20 ? 'text-brand-orange bg-brand-soft-orange' : 'text-brand-green bg-brand-soft-green'}
                />
            </div>

            <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em] mb-6 ml-2">Constantes del Diario</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {diaryOptions.filter(opt => diaryPreferences.includes(opt.id as any)).map((opt, i) => {
                    const value = healthData[opt.id as keyof HealthData];
                    const unit = opt.label.match(/\((.*?)\)/)?.[1] || '';
                    const label = opt.label.replace(/\(.*\)/, '').trim();
                    const ranges: Record<string, {min: number, max: number}> = {
                        systolicBP: { min: 90, max: 140 },
                        diastolicBP: { min: 60, max: 90 },
                        pulse: { min: 50, max: 100 },
                        glucose: { min: 70, max: 110 },
                        oxygenSaturation: { min: 94, max: 100 }
                    };
                    return (
                        <button key={opt.id} onClick={() => handleDetail(label, opt.id, unit, ranges[opt.id])} className="bg-white p-6 rounded-v-large shadow-soft border border-brand-gray-50 flex flex-col justify-between h-36 w-full text-left transition-all hover:bg-brand-gray-50 active:scale-95">
                            <h3 className="text-[9px] font-black text-brand-gray-400 uppercase tracking-widest leading-none">{label}</h3>
                            <div className="flex items-baseline gap-1 mt-auto">
                                <span className="text-3xl font-black text-brand-gray-900 tracking-tighter leading-none">{value ?? '--'}</span>
                                <span className="text-[10px] font-black text-brand-blue uppercase">{unit}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {selectedDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-v-xl p-8 shadow-soft-lg">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-3xl font-black uppercase tracking-tighter">{selectedDetail.label}</h3>
                            <button onClick={() => setSelectedDetail(null)} className="p-2 bg-brand-gray-100 rounded-full"><XMarkIcon /></button>
                        </div>
                        <HistoryChart data={detailHistory} color="#005A9C" unit={selectedDetail.unit} range={selectedDetail.range} />
                        <div className="mt-8 max-h-48 overflow-y-auto pr-2 space-y-2">
                            {detailHistory.slice().reverse().map((d, i) => (
                                <div key={i} className="flex justify-between p-3 bg-brand-gray-50 rounded-xl">
                                    <span className="text-xs font-bold text-brand-gray-500">{d.date.toLocaleDateString()}</span>
                                    <span className="text-sm font-black text-brand-gray-900">{d.value.toFixed(1)} <span className="text-[10px] text-brand-blue">{selectedDetail.unit}</span></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isProfileOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-gray-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-v-xl p-8 shadow-soft-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between mb-8">
                            <h3 className="text-2xl font-black uppercase tracking-tighter">{isEditing ? "Editar Perfil" : "Mi Perfil"}</h3>
                            <button onClick={() => setIsProfileOpen(false)}><XMarkIcon /></button>
                        </div>
                        
                        {!isEditing ? (
                            <div className="flex flex-col items-center">
                                <AvatarComponent className="w-24 h-24 mb-6" />
                                <p className="text-2xl font-black mb-1">{profile?.displayName}</p>
                                <p className="text-brand-gray-400 font-bold text-sm mb-8">{profile?.email}</p>
                                <div className="w-full grid grid-cols-3 gap-3 mb-8">
                                    <div className="p-4 bg-brand-gray-50 rounded-2xl">
                                        <p className="text-[8px] font-black text-brand-gray-400 uppercase tracking-widest mb-1">Edad</p>
                                        <p className="text-xs font-black text-brand-blue">{profile?.age} años</p>
                                    </div>
                                    <div className="p-4 bg-brand-gray-50 rounded-2xl">
                                        <p className="text-[8px] font-black text-brand-gray-400 uppercase tracking-widest mb-1">Tabaquismo</p>
                                        <p className="text-xs font-black text-brand-blue">{profile?.smokingStatus}</p>
                                    </div>
                                    <div className="p-4 bg-brand-gray-50 rounded-2xl">
                                        <p className="text-[8px] font-black text-brand-gray-400 uppercase tracking-widest mb-1">Altura</p>
                                        <p className="text-xs font-black text-brand-blue">{profile?.healthData.height} cm</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditing(true)} className="w-full py-4 bg-brand-lightblue text-brand-blue font-black rounded-xl mb-4 flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest"><PencilSquareIcon className="w-4 h-4"/> Editar Datos Iniciales</button>
                                <button onClick={() => signOut()} className="w-full py-4 text-brand-red font-black text-[10px] uppercase tracking-widest border border-brand-soft-red bg-brand-soft-red rounded-xl">Cerrar Sesión</button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Nombre de Usuario</label>
                                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Edad (Años)</label>
                                    <input type="number" value={editAge} onChange={e => setEditAge(e.target.value)} className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Altura (cm)</label>
                                    <input type="number" value={editHeight} onChange={e => setEditHeight(e.target.value)} className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Sexo Biológico</label>
                                    <select 
                                        value={editGender} 
                                        onChange={e => setEditGender(e.target.value as any)}
                                        className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none"
                                    >
                                        <option value="male">Hombre</option>
                                        <option value="female">Mujer</option>
                                        <option value="other">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Estado Fumador</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {smokingOptions.map(opt => (
                                            <button key={opt.id} onClick={() => setEditSmoking(opt.id)} className={`p-4 text-left text-[10px] font-black uppercase rounded-xl border-2 transition-all ${editSmoking === opt.id ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-gray-600 border-brand-gray-100'}`}>{opt.label}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Variables del Diario</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {diaryOptions.map(opt => {
                                            const isSelected = editPrefs.includes(opt.id as any);
                                            return (
                                                <button 
                                                    key={opt.id} 
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setEditPrefs(editPrefs.filter(p => p !== opt.id));
                                                        } else {
                                                            setEditPrefs([...editPrefs, opt.id as any]);
                                                        }
                                                    }} 
                                                    className={`p-4 text-left text-[10px] font-black uppercase rounded-xl border-2 transition-all flex justify-between items-center ${isSelected ? 'bg-brand-lightblue text-brand-blue border-brand-blue' : 'bg-white text-brand-gray-600 border-brand-gray-100'}`}
                                                >
                                                    {opt.label}
                                                    {isSelected && <CheckCircleIcon className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-4 bg-brand-gray-100 text-brand-gray-900 rounded-xl font-black text-xs uppercase tracking-widest">Atrás</button>
                                    <button onClick={handleSaveProfile} className="flex-1 py-4 bg-brand-blue text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-soft">Guardar Todo</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomeScreen;
