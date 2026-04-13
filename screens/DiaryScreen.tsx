
import React, { useState, useContext, useCallback } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { saveDailyLog, updateUserProfile } from '../services/firestore';
import { CheckCircleIcon } from '../components/Icons';
import type { HealthData, Alert } from '../types';

type DailyDataForm = { [K in keyof HealthData]: string };

const initialFormData: DailyDataForm = {
    weight: '',
    falls: '',
    systolicBP: '',
    diastolicBP: '',
    pulse: '',
    oxygenSaturation: '',
    glucose: '',
    calfCircumference: '',
    abdominalCircumference: '',
    height: '',
};

const formFields: { label: string; id: keyof HealthData; unit: string; }[] = [
    { label: "Peso Corporal", id: "weight", unit: "kg" },
    { label: "Tensión Sistólica", id: "systolicBP", unit: "mmHg" },
    { label: "Tensión Diastólica", id: "diastolicBP", unit: "mmHg" },
    { label: "Pulso Cardiaco", id: "pulse", unit: "lpm" },
    { label: "Oxígeno", id: "oxygenSaturation", unit: "%" },
    { label: "Azúcar", id: "glucose", unit: "mg/dl" },
    { label: "Pantorrilla", id: "calfCircumference", unit: "cm" },
    { label: "Abdomen", id: "abdominalCircumference", unit: "cm" },
    { label: "Caídas", id: "falls", unit: "nº" },
];

const DiaryScreen: React.FC = () => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { healthData, setHealthData, setAlerts, diaryPreferences } = context!;
    
    const [formData, setFormData] = useState<DailyDataForm>(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const visibleFields = formFields.filter(f => (diaryPreferences || []).includes(f.id));

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        const updated: Partial<HealthData> = {};
        Object.keys(formData).forEach(k => {
            const val = formData[k as keyof HealthData].replace(',', '.');
            if (val.trim()) updated[k as keyof HealthData] = parseFloat(val);
        });

        if (Object.keys(updated).length === 0) { setIsSaving(false); return; }

        try {
            const currentHealthData = { ...healthData, ...updated };
            await saveDailyLog(user.uid, currentHealthData);
            setHealthData(currentHealthData);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            setFormData(initialFormData);
        } catch (e) { alert("Error al guardar."); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto animate-fade-in pb-32">
            <header className="mb-16 pt-10 text-center sm:text-left overflow-visible">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                    <div className="w-8 h-1 rounded-full bg-brand-blue shrink-0" />
                    <p className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-[0.25em]">Registro Diario</p>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2 leading-tight break-words pr-4">
                    Mi Diario<br/>
                    <span className="bg-brand-gradient bg-clip-text text-transparent italic px-1 -mx-1">DE SALUD</span>
                </h1>
            </header>

            <div className="bg-white p-1 rounded-[2.5rem] shadow-premium-lg border border-brand-gray-100 relative overflow-hidden animate-slide-up group">
                <div className="p-8 sm:p-12">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-16">
                        {visibleFields.map((f, i) => (
                            <div 
                                key={f.id} 
                                className="relative animate-slide-up flex flex-col items-center sm:items-start group/field"
                                style={{ animationDelay: `${i * 0.05}s` }}
                            >
                                <label className="block text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.2em] mb-4 ml-1 group-focus-within/field:text-brand-blue transition-colors">{f.label}</label>
                                <div className="flex items-center gap-5 w-full max-w-[320px] relative">
                                    <div className="absolute inset-0 bg-brand-blue/5 rounded-[2rem] scale-95 opacity-0 group-focus-within/field:scale-110 group-focus-within/field:opacity-100 transition-all duration-500" />
                                    <input 
                                        type="number" 
                                        value={formData[f.id]} 
                                        onChange={e => setFormData({...formData, [f.id]: e.target.value})} 
                                        className="relative z-10 w-full p-8 bg-white border-2 border-brand-gray-100 rounded-[2rem] text-4xl sm:text-5xl font-black text-brand-gray-900 outline-none focus:border-brand-blue focus:shadow-premium transition-all text-center tracking-tight placeholder:text-brand-gray-100" 
                                        placeholder={healthData[f.id]?.toString() || '0'}
                                    />
                                    <div className="flex flex-col shrink-0 relative z-10 w-12">
                                        <span className="text-xs font-black text-brand-blue uppercase tracking-tighter leading-none">{f.unit}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {visibleFields.length === 0 && (
                        <div className="text-center py-24 bg-brand-gray-50/50 rounded-[2rem] border border-dashed border-brand-gray-200">
                            <div className="w-20 h-20 bg-brand-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircleIcon className="w-10 h-10 text-brand-gray-300" />
                            </div>
                            <p className="text-brand-gray-500 font-black uppercase tracking-widest text-sm mb-3">No hay métricas activas</p>
                            <p className="text-[10px] text-brand-gray-400 font-bold uppercase tracking-[0.2em]">Configúralas en tu perfil para empezar el seguimiento</p>
                        </div>
                    )}

                    <button 
                        onClick={handleSave} 
                        disabled={isSaving || visibleFields.length === 0} 
                        className="w-full mt-24 bg-brand-gradient text-white py-8 rounded-[2rem] font-black text-xl uppercase tracking-[0.3em] shadow-premium hover:shadow-premium-lg hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 relative overflow-hidden group/btn"
                    >
                        <span className="relative z-10">{isSaving ? 'Guardando...' : 'Confirmar Registro'}</span>
                        <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
                    </button>

                    {success && (
                        <div className="mt-12 p-8 bg-brand-soft-green text-brand-green rounded-[2rem] flex items-center justify-center gap-6 animate-fade-in shadow-soft border border-brand-green/10">
                            <div className="w-10 h-10 bg-brand-green text-white rounded-full flex items-center justify-center">
                                <CheckCircleIcon className="w-6 h-6" />
                            </div>
                            <span className="font-black text-xs uppercase tracking-[0.3em]">Registro guardado con éxito</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-16 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <p className="text-xs font-bold text-brand-gray-400 uppercase tracking-widest">Sus datos alimentan nuestros modelos de predicción de riesgo</p>
            </div>
        </div>
    );
};

export default DiaryScreen;
