
import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getDailyHistory, updateUserProfile, getUserProfile, getVigsHistory, getNutritionLogs } from '../services/firestore';
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
    const { healthData, setHealthData, setDiaryPreferences, diaryPreferences, setVigsScore, vigsScore } = useContext(AppContext)!;
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [latestNutriScore, setLatestNutriScore] = useState<NutriScore | undefined>(undefined);
    
    const [selectedDetail, setSelectedDetail] = useState<{ label: string, key: string, unit: string, range?: {min: number, max: number} } | null>(null);
    const [detailHistory, setDetailHistory] = useState<ChartDataPoint[]>([]);

    const [editName, setEditName] = useState("");
    const [editHeight, setEditHeight] = useState("");
    const [editSmoking, setEditSmoking] = useState<SmokingStatus>("Nunca");
    const [editPrefs, setEditPrefs] = useState<(keyof HealthData)[]>([]);

    const calculatedIndices = useMemo(() => {
        const vigs = vigsScore.index || (vigsScore.score / 25);
        const sys = healthData.systolicBP || 120;
        const falls = healthData.falls || 0;
        const smokeFactor = profile?.smokingStatus === 'Activo' ? 20 : profile?.smokingStatus === 'Ex-fumador' ? 5 : 0;
        const prot = Math.max(0, Math.min(100, (1 - vigs) * 100));
        const cvRisk = Math.min(100, ((sys - 110) / 70 * 80) + smokeFactor);
        const fallRisk = Math.min(100, falls * 33);
        
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
                setEditHeight(pData.healthData.height?.toString() || "170");
                setEditSmoking(pData.smokingStatus);
                setEditPrefs(pData.diaryPreferences);
            }
            if (nLogs.length > 0) {
                setLatestNutriScore(nLogs[0].analysis.nutriScore);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadProfile(); }, [user]);

    const handleSaveProfile = async () => {
        if (!user) return;
        try {
            await updateUserProfile(user.uid, {
                displayName: editName,
                smokingStatus: editSmoking,
                diaryPreferences: editPrefs,
                healthData: { ...healthData, height: parseFloat(editHeight) || 170 }
            });
            await loadProfile();
            setIsEditing(false);
        } catch (e) { alert("Error al actualizar perfil."); }
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

            <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em] mb-6 ml-2">Índices Principales</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-16">
                <IndexCard title="Autonomía (VIGS)" onClick={() => handleDetail("Autonomía", "vigs", "VIGS", {min: 0, max: 0.2})} value={vigsScore.index?.toFixed(2) || '0.00'} percent={calculatedIndices.autonomy} description="Independencia funcional." category={vigsScore.category} categoryClass={getVigsColorClass(vigsScore.category)} />
                <IndexCard title="Protección" onClick={() => handleDetail("Protección", "protection", "%", {min: 75, max: 100})} value={`${calculatedIndices.protection.toFixed(0)}%`} percent={calculatedIndices.protection} inverted description="Resiliencia ante fragilidad." />
                <IndexCard title="Salud Cardio" onClick={() => handleDetail("Salud Cardio", "cardio", "Pts", {min: 0, max: 25})} value={calculatedIndices.cardio < 30 ? "Óptima" : calculatedIndices.cardio.toFixed(0)} percent={calculatedIndices.cardio} description="Riesgo cardiovascular." />
                <IndexCard title="Riesgo Caídas" value={calculatedIndices.falls > 10 ? "Atención" : "Bajo"} percent={calculatedIndices.falls} description="Historial de caídas." />
                <IndexCard title="Score Nutri" value={latestNutriScore || '---'} percent={calculatedIndices.nutrition} customColor={getNutriScoreColor(latestNutriScore)} description="Calidad de la última comida fotografiada." />
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
                                <div className="w-full grid grid-cols-2 gap-3 mb-8">
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
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Altura (cm)</label>
                                    <input type="number" value={editHeight} onChange={e => setEditHeight(e.target.value)} className="w-full p-4 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-xl font-black focus:border-brand-blue outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-brand-gray-400 uppercase tracking-widest mb-2 block ml-2">Estado Fumador</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {smokingOptions.map(opt => (
                                            <button key={opt.id} onClick={() => setEditSmoking(opt.id)} className={`p-4 text-left text-[10px] font-black uppercase rounded-xl border-2 transition-all ${editSmoking === opt.id ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-brand-gray-600 border-brand-gray-100'}`}>{opt.label}</button>
                                        ))}
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
