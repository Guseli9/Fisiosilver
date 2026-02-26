
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
            const val = formData[k as keyof HealthData];
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
        <div className="p-6 max-w-3xl mx-auto animate-fade-in pb-32">
            <header className="mb-12 pt-8 text-center sm:text-left">
                <h1 className="text-5xl font-black text-brand-gray-900 tracking-tighter uppercase mb-2 leading-none">Mi Diario<br/><span className="text-brand-blue">DE SALUD</span></h1>
                <p className="text-brand-gray-500 font-black text-[12px] uppercase tracking-[0.3em] mt-6">Anota tus mediciones hoy con tranquilidad</p>
            </header>

            <div className="bg-white p-8 sm:p-12 rounded-[3rem] shadow-soft border border-brand-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-12">
                    {visibleFields.map(f => (
                        <div key={f.id} className="relative animate-slide-up flex flex-col items-center sm:items-start">
                            <label className="block text-[11px] font-black text-brand-gray-400 uppercase tracking-widest mb-4 ml-1">{f.label}</label>
                            <div className="flex items-center gap-4 w-full max-w-[280px]">
                                <input 
                                    type="number" 
                                    value={formData[f.id]} 
                                    onChange={e => setFormData({...formData, [f.id]: e.target.value})} 
                                    className="w-full p-6 bg-white border-2 border-brand-gray-100 rounded-[1.5rem] text-4xl font-black text-brand-gray-900 outline-none focus:border-brand-blue focus:ring-8 focus:ring-brand-blue/5 transition-all shadow-sm text-center tracking-tighter" 
                                    placeholder={healthData[f.id]?.toString() || '0'}
                                />
                                <div className="flex flex-col shrink-0">
                                    <span className="text-[11px] font-black text-brand-blue uppercase tracking-tighter w-10 text-left leading-none">{f.unit}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {visibleFields.length === 0 && (
                    <div className="text-center py-20">
                        <p className="text-brand-gray-400 font-black uppercase tracking-widest text-sm mb-4">No has activado métricas en tu diario.</p>
                        <p className="text-xs text-brand-gray-400 font-bold uppercase tracking-[0.2em]">Pulsa en tu foto de perfil para configurarlas.</p>
                    </div>
                )}

                <button 
                    onClick={handleSave} 
                    disabled={isSaving || visibleFields.length === 0} 
                    className="w-full mt-16 bg-brand-blue text-white py-8 rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-soft hover:shadow-soft-lg active:scale-[0.98] transition-all disabled:bg-brand-gray-100 disabled:text-brand-gray-400"
                >
                    {isSaving ? 'Guardando Registro...' : 'Confirmar Datos Médicos'}
                </button>

                {success && (
                    <div className="mt-10 p-8 bg-brand-soft-green text-brand-green rounded-[2rem] flex items-center justify-center gap-5 animate-fade-in shadow-sm border border-brand-green/10">
                        <CheckCircleIcon className="w-8 h-8" />
                        <span className="font-black text-sm uppercase tracking-widest tracking-[0.2em]">Datos guardados con éxito</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiaryScreen;
