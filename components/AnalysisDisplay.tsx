
import React from 'react';
import type { ClinicalAnalysisResult, NutritionalAnalysisResult } from '../types';
import { InfoCircleIcon, SparklesIcon, LightBulbIcon } from './Icons';

interface AnalysisDisplayProps {
    analysis: ClinicalAnalysisResult | NutritionalAnalysisResult;
    type: 'clinical' | 'nutrition';
}

const SectionCard: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="mb-10 last:mb-0">
        <div className="flex items-center gap-4 mb-6">
            <div className="bg-brand-gray-50 p-3 rounded-2xl text-brand-blue shadow-sm">{icon}</div>
            <h4 className="text-xl font-black text-brand-gray-800 uppercase tracking-tighter">{title}</h4>
        </div>
        <div className="pl-2">
            {children}
        </div>
    </div>
);

const BiomarkerItem: React.FC<{ label: string, value?: string }> = ({ label, value }) => {
    const isMissing = !value || value.toLowerCase().includes('no encontrado') || value.trim() === '';
    return (
        <div className={`flex justify-between items-center p-4 rounded-2xl border transition-all ${isMissing ? 'bg-brand-gray-50 border-brand-gray-100 opacity-60' : 'bg-white border-brand-gray-50 shadow-sm hover:shadow-md'}`}>
            <span className="text-sm font-bold text-brand-gray-600 uppercase tracking-tight">{label}</span>
            <span className={`text-base font-black ${isMissing ? 'text-brand-gray-400 italic' : 'text-brand-blue'}`}>
                {isMissing ? 'Pendiente' : value}
            </span>
        </div>
    );
};

const ClinicalDisplay: React.FC<{ analysis: ClinicalAnalysisResult }> = ({ analysis }) => {
    if (!analysis || !analysis.biomarkers) return <div className="p-10 text-center font-bold text-brand-gray-400">Datos no disponibles</div>;

    return (
        <div className="space-y-4">
            <SectionCard title="Resumen Médico" icon={<InfoCircleIcon />}>
                <p className="text-lg text-brand-gray-700 leading-relaxed font-medium bg-brand-gray-50/50 p-6 rounded-[1.5rem] border border-brand-gray-50">
                    {analysis.summary}
                </p>
            </SectionCard>
            
            <SectionCard title="Biomarcadores Extraídos" icon={<SparklesIcon />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BiomarkerItem label="Hemoglobina" value={analysis.biomarkers.hemoglobin} />
                    <BiomarkerItem label="Albúmina" value={analysis.biomarkers.albumin} />
                    <BiomarkerItem label="Vitamina D" value={analysis.biomarkers.vitaminD} />
                    <BiomarkerItem label="Glucosa (Ayunas)" value={analysis.biomarkers.glucoseFasting} />
                    <BiomarkerItem label="Sodio (Na+)" value={analysis.biomarkers.sodium} />
                    <BiomarkerItem label="PCR (Prot. C Reactiva)" value={analysis.biomarkers.crp} />
                    <BiomarkerItem label="Vitamina B12" value={analysis.biomarkers.vitaminB12} />
                    <BiomarkerItem label="TSH (Tiroides)" value={analysis.biomarkers.tsh} />
                    <BiomarkerItem label="Creatinina" value={analysis.biomarkers.creatinine} />
                    <BiomarkerItem label="eGFR (Filtrado)" value={analysis.biomarkers.egfr} />
                </div>
            </SectionCard>
            
            <SectionCard title="Sugerencias Preventivas" icon={<LightBulbIcon />}>
                <div className="space-y-3">
                    {analysis.recommendations?.map((rec, index) => (
                        <div key={index} className="flex gap-4 items-start bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                            <div className="mt-1 text-brand-blue">•</div>
                            <p className="text-brand-gray-700 font-bold text-sm leading-tight">{rec}</p>
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
};

const MacroBar: React.FC<{ label: string, value?: string, color: string }> = ({ label, value, color }) => {
    const numValue = parseInt(value || "0") || 0;
    const percentage = Math.min(100, (numValue / 100) * 100);
    return (
        <div className="mb-4">
            <div className="flex justify-between mb-2">
                <span className="text-xs font-black text-brand-gray-500 uppercase tracking-widest">{label}</span>
                <span className="text-xs font-black text-brand-gray-800">{value || '0'}</span>
            </div>
            <div className="w-full bg-brand-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                <div className={`${color} h-2.5 rounded-full transition-all duration-1000`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

const NutritionDisplay: React.FC<{ analysis: NutritionalAnalysisResult }> = ({ analysis }) => {
    if (!analysis) return null;
    return (
        <div className="space-y-8">
            <div className="bg-brand-blue text-white p-8 rounded-[2rem] text-center shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 opacity-80">Calorías Estimadas</p>
                <p className="text-5xl font-black">{analysis.calories || '0'}<span className="text-lg ml-1 opacity-60">kcal</span></p>
            </div>

            <SectionCard title="Macronutrientes" icon={<SparklesIcon />}>
                <div className="bg-white p-6 rounded-3xl border border-brand-gray-50 shadow-sm">
                    <MacroBar label="Proteínas" value={analysis.macros.protein} color="bg-sky-500" />
                    <MacroBar label="Carbohidratos" value={analysis.macros.carbs} color="bg-amber-500" />
                    <MacroBar label="Grasas" value={analysis.macros.fatsTotal} color="bg-emerald-500" />
                    <MacroBar label="Fibra" value={analysis.macros.fiber} color="bg-purple-500" />
                </div>
            </SectionCard>

            <SectionCard title="Análisis de Porciones" icon={<InfoCircleIcon />}>
                <p className="text-brand-gray-700 font-medium leading-relaxed italic border-l-4 border-brand-blue pl-6 py-2">
                    {analysis.portions}
                </p>
            </SectionCard>

            <SectionCard title="Sugerencias" icon={<LightBulbIcon />}>
                <div className="grid grid-cols-1 gap-3">
                    {analysis.suggestions?.map((sug, index) => (
                        <div key={index} className="bg-brand-gray-50 p-5 rounded-2xl border border-brand-gray-100 text-sm font-bold text-brand-gray-700 leading-tight">
                            {sug}
                        </div>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
};

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ analysis, type }) => {
    if (type === 'clinical') return <ClinicalDisplay analysis={analysis as ClinicalAnalysisResult} />;
    if (type === 'nutrition') return <NutritionDisplay analysis={analysis as NutritionalAnalysisResult} />;
    return null;
};

export default AnalysisDisplay;
