
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getDailyHistory, updateUserProfile, getUserProfile } from '../services/firestore';
import type { VigsCategory, HealthData, UserProfile } from '../types';
import { XMarkIcon, avatars, PencilSquareIcon, CheckCircleIcon } from '../components/Icons';

const diaryOptions = [
    { id: 'weight', label: 'Peso Corporal' },
    { id: 'systolicBP', label: 'Tensión Sistólica' },
    { id: 'diastolicBP', label: 'Tensión Diastólica' },
    { id: 'pulse', label: 'Pulso (LPM)' },
    { id: 'oxygenSaturation', label: 'Saturación Oxígeno' },
    { id: 'glucose', label: 'Azúcar en Sangre' },
    { id: 'falls', label: 'Control de Caídas' },
    { id: 'calfCircumference', label: 'Pantorrilla' },
    { id: 'abdominalCircumference', label: 'Abdomen' },
];

const RECOMMENDED_RANGES: Record<string, { min: number; max: number }> = {
    systolicBP: { min: 110, max: 140 },
    diastolicBP: { min: 60, max: 90 },
    pulse: { min: 60, max: 100 },
    oxygenSaturation: { min: 95, max: 100 },
    glucose: { min: 70, max: 110 },
    calfCircumference: { min: 31, max: 45 },
    abdominalCircumference: { min: 70, max: 102 },
};

const getVigsColor = (category: VigsCategory): string => {
  switch (category) {
    case 'No frágil': return 'bg-brand-green';
    case 'Fragilidad leve': return 'bg-emerald-500';
    case 'Fragilidad moderada': return 'bg-brand-yellow';
    case 'Fragilidad severa': return 'bg-brand-red';
    default: return 'bg-brand-gray-400';
  }
};

// --- Chart Component ---
interface ChartDataPoint { date: Date; value: number; }
interface HistoryChartProps { 
    data: ChartDataPoint[]; 
    unit: string; 
    color: string;
    referenceRange?: { min: number; max: number; label?: string };
}

const HistoryChart: React.FC<HistoryChartProps> = ({ data, unit, color, referenceRange }) => {
    if (data.length < 2) return <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"><p className="text-gray-500 text-center px-4 font-bold">Necesita al menos 2 registros para ver su evolución.</p></div>;
    
    const width = 100; const height = 50; const padding = 8;
    const values = data.map(d => d.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);
    
    if (referenceRange) {
        minVal = Math.min(minVal, referenceRange.min);
        maxVal = Math.max(maxVal, referenceRange.max);
    }
    const rangeBuffer = (maxVal - minVal) * 0.15;
    minVal = Math.floor(minVal - rangeBuffer);
    maxVal = Math.ceil(maxVal + rangeBuffer);
    const range = maxVal - minVal || 1;

    const getX = (index: number) => padding + (index / (data.length - 1)) * (width - 2 * padding);
    const getY = (val: number) => height - padding - ((val - minVal) / range) * (height - 2 * padding);
    const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`).join(' ');

    return (
        <div className="w-full">
            <div className="relative w-full aspect-[2/1] bg-white rounded-3xl border border-gray-100 p-4 shadow-inner overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    {referenceRange && (
                        <rect 
                            x={padding} 
                            y={getY(referenceRange.max)} 
                            width={width - 2 * padding} 
                            height={Math.abs(getY(referenceRange.min) - getY(referenceRange.max))} 
                            fill="rgba(46, 125, 50, 0.1)" 
                        />
                    )}
                    <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {data.map((d, i) => (
                        <circle key={i} cx={getX(i)} cy={getY(d.value)} r="1.8" fill="white" stroke={color} strokeWidth="1" />
                    ))}
                </svg>
            </div>
            <div className="flex justify-between mt-4 text-xs text-brand-gray-500 font-black px-2 uppercase tracking-widest">
                <span>Mín: {Math.min(...values)} {unit}</span>
                <span>Máx: {Math.max(...values)} {unit}</span>
            </div>
        </div>
    );
};

const VigsScoreIndicator: React.FC = () => {
    const context = useContext(AppContext);
    if (!context) return null;
    const { vigsScore } = context;
    const displayIndex = vigsScore.index !== undefined ? vigsScore.index.toFixed(2) : (vigsScore.score / 25.0).toFixed(2);
    
    return (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl text-center border border-brand-gray-100 mb-8 transform transition-all hover:scale-[1.01]">
            <h2 className="text-xl text-brand-gray-700 font-black mb-6 uppercase tracking-tighter">Índice de Fragilidad VIGS</h2>
            
            <div className="flex flex-col items-center justify-center gap-4">
                <div className={`w-36 h-36 rounded-full flex flex-col items-center justify-center text-white shadow-2xl ${getVigsColor(vigsScore.category)} ring-8 ring-white/20`}>
                    <span className="text-5xl font-black leading-none">{displayIndex}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] mt-2">IF-VIG INDEX</span>
                </div>
                
                <div className="mt-4 text-center">
                    <span className={`px-6 py-2 rounded-full text-white text-base font-black uppercase tracking-widest shadow-lg ${getVigsColor(vigsScore.category)}`}>
                        {vigsScore.category}
                    </span>
                </div>
            </div>
        </div>
    );
};

const HealthDataGrid: React.FC<{ onMetricClick: (metric: keyof HealthData, label: string, unit: string) => void }> = ({ onMetricClick }) => {
    const context = useContext(AppContext);
    if (!context) return null;
    const { healthData, diaryPreferences } = context;

    const allDataPoints: { key: keyof HealthData; label: string; value: string | number | null; unit: string }[] = [
        { key: "weight", label: "Peso", value: healthData.weight, unit: "kg" },
        { key: "systolicBP", label: "T. Sistólica", value: healthData.systolicBP, unit: "mmHg" },
        { key: "diastolicBP", label: "T. Diastólica", value: healthData.diastolicBP, unit: "mmHg" },
        { key: "pulse", label: "Pulso", value: healthData.pulse, unit: "lpm" },
        { key: "oxygenSaturation", label: "Sat. O₂", value: healthData.oxygenSaturation, unit: "%" },
        { key: "glucose", label: "Glucemia", value: healthData.glucose, unit: "mg/dl" },
        { key: "falls", label: "Caídas", value: healthData.falls, unit: "" },
        { key: "calfCircumference", label: "Pantorrilla", value: healthData.calfCircumference, unit: "cm" },
        { key: "abdominalCircumference", label: "Abdomen", value: healthData.abdominalCircumference, unit: "cm" },
    ];

    const visiblePoints = allDataPoints.filter(point => (diaryPreferences || []).includes(point.key));

    return (
        <div className="mt-8 px-2">
            <h2 className="text-xl text-brand-gray-800 font-black mb-6 px-2 uppercase tracking-tighter">Monitoreo Diario</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {visiblePoints.map(point => (
                    <button key={point.key} onClick={() => onMetricClick(point.key, point.label, point.unit)} className="bg-white p-6 rounded-3xl shadow-sm text-center hover:shadow-xl hover:scale-105 transition-all border border-gray-50 active:scale-95 group">
                        <p className="text-[10px] text-brand-blue font-black uppercase tracking-[0.2em] mb-2 group-hover:text-sky-500">{point.label}</p>
                        <p className="text-3xl font-black text-brand-gray-800 mb-1">{point.value !== null ? point.value : '-'}</p>
                        <p className="text-[10px] text-brand-gray-400 font-bold uppercase">{point.unit || 'VALOR'}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

const HomeScreen: React.FC = () => {
    const { user, signOut } = useAuth();
    const { healthData, setHealthData, setDiaryPreferences, diaryPreferences, setVigsScore } = useContext(AppContext)!;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedMetric, setSelectedMetric] = useState<{key: keyof HealthData, label: string, unit: string} | null>(null);
    const [historyData, setHistoryData] = useState<ChartDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);

    // Form states
    const [editName, setEditName] = useState("");
    const [editBirthDate, setEditBirthDate] = useState("");
    const [editHeight, setEditHeight] = useState("");
    const [editDiaryPrefs, setEditDiaryPrefs] = useState<(keyof HealthData)[]>([]);

    const loadProfile = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const data = await getUserProfile(user.uid);
            if (data) {
                setProfile(data);
                setEditName(data.displayName);
                setEditBirthDate(data.birthDate);
                setEditHeight(data.healthData.height?.toString() || "");
                setEditDiaryPrefs(data.diaryPreferences);
                
                setHealthData(data.healthData);
                setDiaryPreferences(data.diaryPreferences);
                setVigsScore(data.vigsScore);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { loadProfile(); }, [user]);

    const handleSaveProfile = async () => {
        if (!user) return;
        setSaveLoading(true);
        try {
            const updates: Partial<UserProfile> = {
                displayName: editName,
                birthDate: editBirthDate,
                diaryPreferences: editDiaryPrefs,
                healthData: {
                    ...healthData,
                    height: parseFloat(editHeight) || null
                }
            };
            await updateUserProfile(user.uid, updates);
            await loadProfile(); 
            setIsEditing(false);
        } catch (e) {
            console.error(e);
            alert("Error al actualizar perfil.");
        } finally { setSaveLoading(false); }
    };

    const handleMetricClick = async (key: keyof HealthData, label: string, unit: string) => {
        if (!user) return;
        setSelectedMetric({ key, label, unit });
        try {
            const logs = await getDailyHistory(user.uid);
            const chartData = logs
                .map(l => ({ date: l.createdAt, value: l[key] as number | null }))
                .filter(d => d.value !== null)
                .sort((a, b) => a.date.getTime() - b.date.getTime()) as ChartDataPoint[];
            setHistoryData(chartData);
        } catch (e) { console.error(e); }
    };

    const AvatarComponent = profile ? avatars[profile.avatarId] || avatars[0] : avatars[0];

    if (isLoading) return <div className="flex h-screen items-center justify-center bg-brand-gray-100"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue"></div></div>;

    return (
        <div className="p-4 sm:p-6 pb-24 max-w-3xl mx-auto">
            <header className="flex justify-between items-center mb-12 pt-6">
                <div>
                    <h1 className="text-4xl font-black text-brand-gray-800 tracking-tighter leading-tight">HOLA,<br/><span className="text-brand-blue uppercase">{profile?.displayName?.split(' ')[0] || 'USUARIO'}</span></h1>
                </div>
                <button onClick={() => setIsProfileOpen(true)} className="bg-white p-1 rounded-full shadow-2xl border-4 border-white hover:scale-110 transition-all ring-2 ring-brand-blue/10">
                    <AvatarComponent className="w-20 h-20" />
                </button>
            </header>

            <VigsScoreIndicator />
            <HealthDataGrid onMetricClick={handleMetricClick} />
            
            {/* --- MODAL DE PERFIL --- */}
            {isProfileOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-brand-gray-900/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-lg h-[85vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl">
                        <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 px-8 py-6 flex justify-between items-center border-b border-brand-gray-50">
                            <h3 className="text-2xl font-black text-brand-gray-800 tracking-tighter uppercase">Configuración</h3>
                            <button onClick={() => {setIsProfileOpen(false); setIsEditing(false);}} className="text-brand-gray-300 hover:text-brand-red bg-brand-gray-50 p-3 rounded-full transition-all"><XMarkIcon /></button>
                        </div>
                        
                        <div className="p-8 space-y-10">
                            {/* Perfil */}
                            <div className="flex flex-col items-center gap-6">
                                <div className="bg-brand-lightblue p-3 rounded-full ring-4 ring-brand-blue/5">
                                    <AvatarComponent className="w-28 h-28" />
                                </div>
                                {!isEditing ? (
                                    <div className="text-center w-full">
                                        <p className="text-3xl font-black text-brand-gray-800 tracking-tight">{profile?.displayName}</p>
                                        <p className="text-sm font-bold text-brand-gray-400 uppercase tracking-widest mt-1">{profile?.email}</p>
                                        <button 
                                            onClick={() => setIsEditing(true)}
                                            className="mt-6 flex items-center gap-2 px-8 py-3 bg-brand-gray-100 text-brand-gray-700 rounded-full text-xs font-black uppercase tracking-widest hover:bg-brand-blue hover:text-white transition-all mx-auto border-2 border-transparent hover:border-brand-blue"
                                        >
                                            <PencilSquareIcon /> Editar Perfil
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full space-y-6 bg-brand-gray-50 p-6 rounded-[2rem] border border-brand-gray-100">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-brand-blue uppercase tracking-widest ml-1">Nombre Completo</label>
                                            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-4 bg-white border-2 border-brand-gray-200 rounded-2xl focus:border-brand-blue outline-none font-bold text-lg" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-brand-blue uppercase tracking-widest ml-1">Altura (cm)</label>
                                                <input type="number" value={editHeight} onChange={e => setEditHeight(e.target.value)} className="w-full p-4 bg-white border-2 border-brand-gray-200 rounded-2xl focus:border-brand-blue outline-none font-bold text-lg" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-brand-blue uppercase tracking-widest ml-1">F. Nacimiento</label>
                                                <input type="date" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)} className="w-full p-4 bg-white border-2 border-brand-gray-200 rounded-2xl focus:border-brand-blue outline-none font-bold text-lg" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <hr className="border-brand-gray-50" />

                            {/* Preferencias */}
                            <div className="space-y-6">
                                <h4 className="text-sm font-black text-brand-gray-400 uppercase tracking-[0.2em]">Personalizar mi Diario</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    {diaryOptions.map(opt => {
                                        const isSelected = isEditing ? editDiaryPrefs.includes(opt.id as any) : diaryPreferences.includes(opt.id as any);
                                        return (
                                            <button 
                                                key={opt.id}
                                                disabled={!isEditing}
                                                onClick={() => setEditDiaryPrefs(prev => prev.includes(opt.id as any) ? prev.filter(x => x !== opt.id) : [...prev, opt.id as any])}
                                                className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all group ${isSelected ? 'border-brand-blue bg-blue-50/50' : 'border-brand-gray-50 bg-white opacity-40'}`}
                                            >
                                                <span className={`font-bold text-lg ${isSelected ? 'text-brand-blue' : 'text-brand-gray-400'}`}>{opt.label}</span>
                                                {isSelected && <CheckCircleIcon className="w-6 h-6 text-brand-blue animate-scale-in" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Acciones Finales */}
                            <div className="pt-6 space-y-4">
                                {isEditing ? (
                                    <button 
                                        onClick={handleSaveProfile}
                                        disabled={saveLoading}
                                        className="w-full bg-brand-green text-white font-black py-6 rounded-[2rem] hover:bg-green-700 transition-all uppercase tracking-widest text-sm shadow-xl flex items-center justify-center gap-3 disabled:bg-brand-gray-300"
                                    >
                                        {saveLoading ? <div className="animate-spin h-6 w-6 border-b-2 border-white rounded-full"></div> : "Guardar Ajustes"}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => signOut()}
                                        className="w-full bg-brand-red/5 text-brand-red font-black py-6 rounded-[2rem] hover:bg-brand-red hover:text-white transition-all uppercase tracking-widest text-sm border-2 border-brand-red/10 active:scale-95"
                                    >
                                        Cerrar Sesión Segura
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL DE HISTORIAL --- */}
            {selectedMetric && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-gray-900/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-lg">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h3 className="text-3xl font-black text-brand-gray-800 tracking-tighter uppercase">{selectedMetric.label}</h3>
                                <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.3em] mt-1">Análisis de los últimos 30 días</p>
                            </div>
                            <button onClick={() => setSelectedMetric(null)} className="text-brand-gray-300 hover:text-brand-red bg-brand-gray-50 p-3 rounded-full transition-all"><XMarkIcon /></button>
                        </div>
                        <HistoryChart data={historyData} unit={selectedMetric.unit} color="#005A9C" referenceRange={RECOMMENDED_RANGES[selectedMetric.key]} />
                        <button onClick={() => setSelectedMetric(null)} className="w-full mt-10 bg-brand-gray-800 text-white font-black py-6 rounded-[2rem] hover:bg-black transition-all uppercase tracking-widest text-xs shadow-lg">Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomeScreen;
