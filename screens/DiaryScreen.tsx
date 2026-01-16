
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
    { label: "Peso", id: "weight", unit: "kg" },
    { label: "Tensión Sistólica (Alta)", id: "systolicBP", unit: "mmHg" },
    { label: "Tensión Diastólica (Baja)", id: "diastolicBP", unit: "mmHg" },
    { label: "Pulso", id: "pulse", unit: "lpm" },
    { label: "Saturación de Oxígeno", id: "oxygenSaturation", unit: "%" },
    { label: "Glucemia", id: "glucose", unit: "mg/dl" },
    { label: "Perímetro Pantorrilla", id: "calfCircumference", unit: "cm" },
    { label: "Perímetro Abdominal", id: "abdominalCircumference", unit: "cm" },
    { label: "Nº de caídas esta semana", id: "falls", unit: "veces" },
];

const InputField: React.FC<{
    label: string;
    id: keyof HealthData;
    unit: string;
    value: string;
    placeholder?: string;
    onChange: (id: keyof HealthData, value: string) => void;
}> = ({ label, id, unit, value, placeholder, onChange }) => {

    const getInputMode = (): 'text' | 'decimal' | 'numeric' => {
        switch (id) {
            case 'weight':
            case 'calfCircumference':
            case 'abdominalCircumference':
                return 'decimal';
            case 'falls':
            case 'pulse':
            case 'oxygenSaturation':
            case 'glucose':
            case 'systolicBP':
            case 'diastolicBP':
                return 'numeric';
            default:
                return 'text';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        const inputMode = getInputMode();
        
        if (inputMode === 'decimal') {
            val = val.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        } else if (inputMode === 'numeric') {
            val = val.replace(/[^0-9]/g, '');
        }

        onChange(id, val);
    };

    return (
        <div className="mb-6">
            <label htmlFor={id} className="block text-xl text-brand-gray-700 font-medium mb-2">{label}</label>
            <div className="relative">
                <input
                    type="text"
                    inputMode={getInputMode()}
                    id={id}
                    name={id}
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="w-full p-4 pr-24 text-xl border-2 border-brand-gray-300 rounded-lg focus:ring-brand-blue focus:border-brand-blue transition-colors"
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-6 text-lg text-brand-gray-500 pointer-events-none">
                    {unit}
                </span>
            </div>
        </div>
    );
};


const DiaryScreen: React.FC = () => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { healthData, setHealthData, setAlerts, diaryPreferences } = context!;
    
    const [formData, setFormData] = useState<DailyDataForm>(initialFormData);
    const [isSavingData, setIsSavingData] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const visibleFields = formFields.filter(field => 
        (diaryPreferences || []).includes(field.id)
    );

    const handleFormChange = useCallback((field: keyof HealthData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSaveDailyData = async () => {
        if (!user) return;
        setIsSavingData(true);
        setSuccessMessage(null);
        
        const updatedData: Partial<HealthData> = {};
        let hasNewData = false;

        (Object.keys(formData) as Array<keyof HealthData>).forEach(key => {
            if (key === 'height') return;
            const value = formData[key];
            if (value.trim() !== '') {
                hasNewData = true;
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    updatedData[key] = numValue;
                }
            }
        });

        if (!hasNewData) {
            alert("Por favor, introduzca al menos un dato para guardar.");
            setIsSavingData(false);
            return;
        }

        const newHealthData = { ...healthData, ...updatedData };
        
        try {
            // Persistir a Supabase
            await saveDailyLog(user.uid, newHealthData);
            
            // Actualizar contexto después de éxito
            setHealthData(newHealthData);
            
            const newAlerts: Alert[] = [
                { id: Date.now(), type: 'success', title: 'Datos Guardados', message: `Sus datos se han guardado con éxito.` },
                ...context!.alerts.filter(a => a.type !== 'success' && a.type !== 'danger'),
            ];
            
            setAlerts(newAlerts);
            await updateUserProfile(user.uid, { alerts: newAlerts });
            
            setSuccessMessage('Los datos se han guardado correctamente.');
            setTimeout(() => setSuccessMessage(null), 3000);
            setFormData(initialFormData);

        } catch (error: any) {
            console.error("Failed to save data:", error);
            // Extraction du message d'erreur pour éviter "[object Object]"
            const errorMsg = error instanceof Error ? error.message : (error?.message || "Error al conectar con la base de datos.");
            
            setAlerts(prev => [
                { id: Date.now(), type: 'danger', title: 'Error de Guardado', message: errorMsg },
                ...prev
            ]);
            alert(`Hubo un error: ${errorMsg}`);
        } finally {
            setIsSavingData(false);
        }
    };
    
    return (
        <div className="p-4 sm:p-6">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-brand-gray-800">Diario de Salud</h1>
                <p className="text-xl text-brand-gray-600">Registre sus constantes vitales para un seguimiento preventivo.</p>
            </header>

            <section className="bg-white p-6 rounded-2xl shadow-md mb-8 border border-brand-gray-100">
                <h2 className="text-2xl font-semibold text-brand-gray-700 mb-6">Nueva Entrada</h2>
                
                {visibleFields.length > 0 ? (
                    visibleFields.map(field => (
                        <InputField
                            key={field.id}
                            label={field.label}
                            id={field.id}
                            unit={field.unit}
                            value={formData[field.id]}
                            onChange={handleFormChange}
                            placeholder={healthData[field.id]?.toString() || ''}
                        />
                    ))
                ) : (
                    <div className="bg-brand-gray-50 p-8 rounded-xl text-center border-2 border-dashed border-brand-gray-200">
                         <p className="text-brand-gray-500 font-medium">No hay métricas visibles. Configure su diario en su perfil.</p>
                    </div>
                )}

                <button
                    onClick={handleSaveDailyData}
                    disabled={isSavingData}
                    className="w-full mt-6 bg-brand-blue text-white text-xl font-black py-5 px-6 rounded-2xl shadow-lg hover:bg-sky-800 transition-all active:scale-[0.98] disabled:bg-brand-gray-300 disabled:cursor-not-allowed uppercase tracking-tighter"
                >
                    {isSavingData ? 'Enviando a la nube...' : 'Guardar en mi Historial'}
                </button>

                {successMessage && (
                    <div className="mt-6 p-5 bg-green-50 text-green-700 rounded-2xl border-2 border-green-200 flex items-center justify-center animate-bounce">
                        <CheckCircleIcon />
                        <span className="ml-3 font-black text-lg uppercase tracking-tight">{successMessage}</span>
                    </div>
                )}
            </section>
        </div>
    );
};

export default DiaryScreen;
