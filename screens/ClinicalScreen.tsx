
import React, { useState, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { analyzeClinicalReport } from '../services/geminiService';
import { saveClinicalReport, uploadFile } from '../services/firestore';
import { UploadIcon, CheckCircleIcon, SmallLightBulbIcon } from '../components/Icons';
import AnalysisDisplay from '../components/AnalysisDisplay';
import type { ClinicalAnalysisResult } from '../types';

const ClinicalScreen: React.FC = () => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { clinicalAnalyses, setClinicalAnalyses } = context!;
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
            setError(null);
            setSuccessMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !user) return;
        setIsLoading(true);
        setError(null);
        
        try {
            setLoadingMessage("Gemini AI está analizando su informe...");
            const analysisResult = await analyzeClinicalReport(selectedFile);
            
            setLoadingMessage("Guardando datos en su historial...");
            const fileUrl = await uploadFile('clinical-reports', selectedFile);
            
            const newAnalysis = {
                id: Date.now().toString(),
                fileName: selectedFile.name,
                analysis: analysisResult,
                createdAt: new Date(),
            };

            await saveClinicalReport(user.uid, newAnalysis);
            setClinicalAnalyses(prev => [newAnalysis, ...prev]);
            
            setSelectedFile(null);
            setSuccessMessage('Informe clínico procesado y guardado correctamente.');
            setTimeout(() => setSuccessMessage(null), 4000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al procesar el archivo.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <header className="mb-12 pt-6">
                <h1 className="text-5xl font-black text-brand-gray-800 tracking-tighter uppercase leading-none">Informes<br/><span className="text-brand-blue">CLÍNICOS</span></h1>
                <p className="text-xs font-black text-brand-gray-400 uppercase tracking-[0.4em] mt-4">IA de extracción médica</p>
            </header>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-12 border border-brand-gray-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10"><UploadIcon /></div>
                
                <h2 className="text-2xl font-black text-brand-gray-800 mb-6 uppercase tracking-tighter">Subir Analítica</h2>
                <p className="text-brand-gray-500 mb-8 font-medium">Suba una foto o PDF de su informe de laboratorio. Nuestra IA extraerá automáticamente los valores clave.</p>
                
                <div className={`flex flex-col items-center border-4 border-dashed rounded-[2rem] p-10 text-center transition-all ${selectedFile ? 'border-brand-blue bg-blue-50' : 'border-brand-gray-200 hover:border-brand-blue/30'}`}>
                    <input type="file" id="file-upload" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                    {!selectedFile ? (
                        <label htmlFor="file-upload" className="cursor-pointer group">
                            <div className="bg-brand-blue text-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 transition-all">
                                <UploadIcon />
                            </div>
                            <span className="text-xl font-black text-brand-blue uppercase tracking-widest">Seleccionar Archivo</span>
                        </label>
                    ) : (
                        <div className="w-full">
                            <div className="bg-green-100 text-brand-green w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircleIcon />
                            </div>
                            <p className="text-xl font-black text-brand-gray-800 truncate px-4">{selectedFile.name}</p>
                            <button onClick={() => setSelectedFile(null)} className="mt-4 text-xs font-black text-brand-red uppercase tracking-widest">Cambiar archivo</button>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="mt-10 p-10 bg-brand-gray-50 rounded-3xl text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto mb-6"></div>
                        <p className="text-lg font-black text-brand-gray-700 uppercase tracking-tighter">{loadingMessage}</p>
                        <p className="text-xs font-bold text-brand-gray-400 mt-2">Esto puede tardar unos segundos...</p>
                    </div>
                ) : (
                    <button 
                        onClick={handleUpload} 
                        disabled={!selectedFile} 
                        className="w-full mt-10 bg-brand-blue text-white text-xl font-black py-6 rounded-3xl shadow-2xl hover:bg-sky-700 transition-all active:scale-95 disabled:bg-brand-gray-200 uppercase tracking-widest"
                    >
                        Procesar con Inteligencia Artificial
                    </button>
                )}

                {error && <div className="mt-6 p-6 bg-red-50 text-brand-red rounded-3xl border-2 border-red-100 font-black text-center uppercase text-xs tracking-widest">{error}</div>}
                {successMessage && <div className="mt-6 p-6 bg-green-50 text-brand-green rounded-3xl border-2 border-green-100 font-black text-center uppercase text-xs tracking-widest flex items-center justify-center gap-3"><CheckCircleIcon /> {successMessage}</div>}
            </div>

            <div className="space-y-8">
                <h2 className="text-2xl font-black text-brand-gray-800 px-2 uppercase tracking-tighter">Historial de Informes</h2>
                {clinicalAnalyses.length === 0 ? (
                    <div className="bg-white p-16 rounded-[2.5rem] text-center shadow-inner border border-brand-gray-50">
                        <p className="text-brand-gray-400 font-black uppercase tracking-widest text-sm">No hay informes registrados</p>
                    </div>
                ) : (
                    clinicalAnalyses.map(item => (
                        <div key={item.id} className="bg-white p-8 rounded-[2.5rem] shadow-lg border border-brand-gray-50">
                            <div className="flex justify-between items-start mb-8 border-b border-brand-gray-50 pb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-brand-gray-800 uppercase tracking-tighter">{item.fileName}</h3>
                                    <p className="text-xs font-bold text-brand-gray-400 uppercase mt-1">{item.createdAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div className="bg-brand-blue/10 text-brand-blue px-4 py-1 rounded-full text-[10px] font-black uppercase">Analizado</div>
                            </div>
                            <AnalysisDisplay analysis={item.analysis} type="clinical" />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ClinicalScreen;
