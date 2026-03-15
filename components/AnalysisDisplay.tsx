
import React from 'react';
import type { ClinicalAnalysisResult, NutritionalAnalysisResult, NutriScore } from '../types';
import { InfoCircleIcon, SparklesIcon, LightBulbIcon } from './Icons';

interface AnalysisDisplayProps {
    analysis: ClinicalAnalysisResult | NutritionalAnalysisResult;
    type: 'clinical' | 'nutrition';
}

const Card: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="mb-8 last:mb-0">
        <div className="flex items-center gap-3 mb-4">
            <div className="text-brand-blue">{icon}</div>
            <h4 className="text-sm font-black text-brand-gray-900 uppercase tracking-tighter">{title}</h4>
        </div>
        <div className="bg-brand-gray-50 p-6 rounded-v-large border border-brand-gray-100">
            {children}
        </div>
    </div>
);

const getNutriScoreStyle = (score: NutriScore) => {
    switch(score) {
        case 'A': return 'bg-brand-green text-white';
        case 'B': return 'bg-emerald-500 text-white';
        case 'C': return 'bg-brand-yellow text-brand-gray-900';
        case 'D': return 'bg-orange-500 text-white';
        case 'E': return 'bg-brand-red text-white';
        default: return 'bg-brand-gray-200 text-brand-gray-400';
    }
};

const Biomarker: React.FC<{ label: string, value?: string }> = ({ label, value }) => {
    const isMissing = !value || value.toLowerCase().includes('---');
    return (
        <div className="flex justify-between items-center py-3 border-b border-brand-gray-200 last:border-0">
            <span className="text-xs font-bold text-brand-gray-500 uppercase tracking-tight">{label}</span>
            <span className={`text-sm font-black ${isMissing ? 'text-brand-gray-300 italic' : 'text-brand-blue'}`}>
                {isMissing ? '---' : value}
            </span>
        </div>
    );
};

const ClinicalDisplay: React.FC<{ analysis: ClinicalAnalysisResult }> = ({ analysis }) => {
    return (
        <div className="space-y-6">
            <Card title="Resumen Médico" icon={<InfoCircleIcon className="w-5 h-5" />}>
                <p className="text-sm font-medium text-brand-gray-700 leading-relaxed">{analysis.summary}</p>
            </Card>
            
            <Card title="Laboratorio" icon={<SparklesIcon className="w-5 h-5" />}>
                <div className="grid grid-cols-1 gap-1">
                    <Biomarker label="Hemoglobina" value={analysis.biomarkers.hemoglobin} />
                    <Biomarker label="Albúmina" value={analysis.biomarkers.albumin} />
                    <Biomarker label="Glucosa" value={analysis.biomarkers.glucoseFasting} />
                    <Biomarker label="HbA1c" value={analysis.biomarkers.hba1c} />
                    <Biomarker label="Creatinina" value={analysis.biomarkers.creatinine} />
                    <Biomarker label="LDL" value={analysis.biomarkers.ldl} />
                    <Biomarker label="PCR" value={analysis.biomarkers.crp} />
                    <Biomarker label="Vitamina D" value={analysis.biomarkers.vitaminD} />
                </div>
            </Card>

            <Card title="Sugerencias" icon={<LightBulbIcon className="w-5 h-5" />}>
                <ul className="space-y-3">
                    {analysis.recommendations?.map((r, i) => (
                        <li key={i} className="text-xs font-bold text-brand-gray-600 flex gap-2">
                            <span className="text-brand-blue">•</span> {r}
                        </li>
                    ))}
                </ul>
            </Card>
        </div>
    );
};

const MacroBar: React.FC<{ label: string, value?: string, color: string }> = ({ label, value, color }) => {
    const num = parseInt(value || "0") || 0;
    const pct = Math.min(100, (num / 80) * 100);
    return (
        <div className="mb-4 last:mb-0">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                <span className="text-brand-gray-400">{label}</span>
                <span className="text-brand-gray-800">{value || '0g'}</span>
            </div>
            <div className="h-2 bg-brand-gray-100 rounded-full overflow-hidden">
                <div className={`${color} h-full transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
            </div>
        </div>
    );
};

const NutritionDisplay: React.FC<{ analysis: NutritionalAnalysisResult }> = ({ analysis }) => {
    return (
        <div className="space-y-6">
            <div className="flex gap-4 mb-8">
                <div className="flex-1 bg-brand-blue p-6 rounded-v-large text-center shadow-soft">
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-widest block mb-1">Calorías</span>
                    <span className="text-4xl font-black text-white tracking-tighter">{analysis.calories || '0'}</span>
                    <span className="text-xs font-bold text-white/60 ml-1">kcal</span>
                </div>
                {analysis.nutriScore && (
                    <div className={`w-24 p-6 rounded-v-large text-center shadow-soft flex flex-col items-center justify-center ${getNutriScoreStyle(analysis.nutriScore)}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-70">Score</span>
                        <span className="text-4xl font-black tracking-tighter">{analysis.nutriScore}</span>
                    </div>
                )}
            </div>

            <Card title="Distribución" icon={<SparklesIcon className="w-5 h-5" />}>
                <MacroBar label="Proteínas" value={analysis.macros.protein} color="bg-sky-500" />
                <MacroBar label="Carbohidratos" value={analysis.macros.carbs} color="bg-amber-400" />
                <MacroBar label="Grasas" value={analysis.macros.fatsTotal} color="bg-emerald-500" />
            </Card>

            <Card title="Comentario IA" icon={<InfoCircleIcon className="w-5 h-5" />}>
                <p className="text-sm font-medium text-brand-gray-700 italic border-l-2 border-brand-blue pl-4 py-1">{analysis.portions}</p>
            </Card>
        </div>
    );
};

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ analysis, type }) => {
    if (type === 'clinical') return <ClinicalDisplay analysis={analysis as ClinicalAnalysisResult} />;
    if (type === 'nutrition') return <NutritionDisplay analysis={analysis as NutritionalAnalysisResult} />;
    return null;
};

export default AnalysisDisplay;
