
import React, { useState, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { analyzeClinicalReport, analyzeClinicalText } from '../services/geminiService';
import { saveClinicalReport, uploadFile } from '../services/firestore';
import { UploadIcon, CheckCircleIcon, LightBulbIcon, PencilSquareIcon, DocumentTextIcon } from '../components/Icons';
import AnalysisDisplay from '../components/AnalysisDisplay';
import type { ClinicalAnalysisResult } from '../types';

const ClinicalScreen: React.FC = () => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { clinicalAnalyses, setClinicalAnalyses } = context!;
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [manualText, setManualText] = useState("");
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
            setLoadingMessage("IA Analizando Analítica...");
            const analysisResult = await analyzeClinicalReport(selectedFile);
            
            setLoadingMessage("Guardando en el Historial...");
            // uploadFile ya sanitiza el nombre internamente
            await uploadFile('clinical-reports', selectedFile);
            
            const newAnalysis = {
                id: Date.now().toString(),
                fileName: selectedFile.name,
                analysis: analysisResult,
                createdAt: new Date(),
            };

            await saveClinicalReport(user.uid, newAnalysis);
            setClinicalAnalyses(prev => [newAnalysis, ...prev]);
            
            setSelectedFile(null);
            setSuccessMessage('Informe clínico procesado correctamente.');
            setTimeout(() => setSuccessMessage(null), 4000);

        } catch (err: any) {
            console.error(err);
            if (err.message === "API_KEY_RESET") {
                setError("La clave de API ha expirado o es inválida. Por favor, reinicie la aplicación o vuelva a configurar la clave.");
                if (window.aistudio) window.aistudio.openSelectKey();
            } else {
                setError(err.message || "Error al procesar el archivo.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualAnalysis = async () => {
        if (!manualText.trim() || !user) return;
        setIsLoading(true);
        setError(null);
        
        try {
            setLoadingMessage("IA Analizando Texto...");
            const analysisResult = await analyzeClinicalText(manualText);
            
            const newAnalysis = {
                id: Date.now().toString(),
                fileName: "Entrada Manual / Texto",
                analysis: analysisResult,
                createdAt: new Date(),
            };

            await saveClinicalReport(user.uid, newAnalysis);
            setClinicalAnalyses(prev => [newAnalysis, ...prev]);
            
            setManualText("");
            setIsManualEntry(false);
            setSuccessMessage('Análisis de texto completado correctamente.');
            setTimeout(() => setSuccessMessage(null), 4000);

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Error al procesar el texto.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto pb-32">
            <header className="mb-12 pt-6 text-center sm:text-left">
                <h1 className="text-5xl font-black text-brand-gray-900 tracking-tighter uppercase leading-none">Informes<br/><span className="text-brand-blue">CLÍNICOS</span></h1>
                <p className="text-[10px] font-black text-brand-gray-400 uppercase tracking-[0.4em] mt-4">Interpretación Senior por IA</p>
            </header>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-brand-gray-50 relative overflow-hidden animate-fade-in group hover:shadow-soft-lg transition-all duration-500">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><UploadIcon /></div>
                
                <div className="flex gap-4 mb-8">
                    <button 
                        onClick={() => setIsManualEntry(false)}
                        className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${!isManualEntry ? 'bg-brand-blue text-white shadow-soft' : 'bg-brand-gray-50 text-brand-gray-400 hover:bg-brand-gray-100'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <UploadIcon className="w-4 h-4" />
                            Subir Archivo
                        </div>
                    </button>
                    <button 
                        onClick={() => setIsManualEntry(true)}
                        className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all ${isManualEntry ? 'bg-brand-blue text-white shadow-soft' : 'bg-brand-gray-50 text-brand-gray-400 hover:bg-brand-gray-100'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <PencilSquareIcon className="w-4 h-4" />
                            Pegar Texto
                        </div>
                    </button>
                </div>

                {!isManualEntry ? (
                    <>
                        <h2 className="text-2xl font-black text-brand-gray-900 mb-6 uppercase tracking-tighter">Subir Analítica</h2>
                        <p className="text-brand-gray-600 mb-10 font-bold text-sm leading-relaxed max-w-md">Nuestra IA extraerá automáticamente niveles de salud clave de su documento (Foto o PDF).</p>
                        
                        <div className={`flex flex-col items-center border-4 border-dashed rounded-[2.5rem] p-12 text-center transition-all duration-500 cursor-pointer ${selectedFile ? 'border-brand-blue bg-blue-50/50 shadow-inner scale-[0.98]' : 'border-brand-gray-100 bg-brand-gray-50/20 hover:bg-white hover:border-brand-blue/40 hover:scale-[1.01] hover:shadow-xl hover:shadow-brand-blue/5'}`}>
                            <input type="file" id="file-upload" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                            {!selectedFile ? (
                                <label htmlFor="file-upload" className="cursor-pointer group/label w-full block">
                                    <div className="bg-brand-blue/10 text-brand-blue w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm group-hover/label:bg-brand-blue group-hover/label:text-white group-hover/label:scale-110 transition-all duration-500">
                                        <UploadIcon />
                                    </div>
                                    <span className="text-xl font-black text-brand-blue uppercase tracking-widest">Añadir Documento</span>
                                    <p className="text-[10px] font-black text-brand-gray-400 mt-2 uppercase tracking-widest opacity-60">Foto o PDF (Analíticas)</p>
                                </label>
                            ) : (
                                <div className="w-full">
                                    <div className="bg-brand-green/20 text-brand-green w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                                        <CheckCircleIcon />
                                    </div>
                                    <p className="text-xl font-black text-brand-gray-900 truncate px-4">{selectedFile.name}</p>
                                    <button onClick={() => setSelectedFile(null)} className="mt-4 text-[10px] font-black text-brand-red uppercase tracking-widest hover:underline decoration-2 underline-offset-4">Eliminar selección</button>
                                </div>
                            )}
                        </div>

                        {isLoading ? (
                            <div className="mt-10 p-10 bg-brand-gray-50 rounded-3xl text-center shadow-inner">
                                <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-brand-blue mx-auto mb-6"></div>
                                <p className="text-lg font-black text-brand-gray-900 uppercase tracking-tighter">{loadingMessage}</p>
                                <p className="text-[10px] font-bold text-brand-gray-400 mt-2 uppercase tracking-widest animate-pulse">Analizando cada parámetro médico...</p>
                            </div>
                        ) : (
                            <button 
                                onClick={handleUpload} 
                                disabled={!selectedFile} 
                                className="w-full mt-10 bg-brand-blue text-white text-xl font-black py-6 rounded-3xl shadow-soft hover:shadow-soft-lg hover:bg-brand-blue/90 transition-all active:scale-[0.98] disabled:bg-brand-gray-100 disabled:text-brand-gray-400 uppercase tracking-widest"
                            >
                                Iniciar Análisis Inteligente
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <h2 className="text-2xl font-black text-brand-gray-900 mb-6 uppercase tracking-tighter">Analizar Texto</h2>
                        <p className="text-brand-gray-600 mb-10 font-bold text-sm leading-relaxed max-w-md">Pegue aquí el texto de su informe médico o los valores que desee analizar.</p>
                        
                        <textarea 
                            value={manualText}
                            onChange={(e) => setManualText(e.target.value)}
                            placeholder="Ejemplo: Hemoglobina 14.5, Glucosa 95, Colesterol LDL 110..."
                            className="w-full h-64 p-8 bg-brand-gray-50 border-2 border-brand-gray-100 rounded-[2.5rem] text-brand-gray-900 font-bold focus:border-brand-blue focus:bg-white outline-none transition-all resize-none shadow-inner"
                        />

                        {isLoading ? (
                            <div className="mt-10 p-10 bg-brand-gray-50 rounded-3xl text-center shadow-inner">
                                <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-brand-blue mx-auto mb-6"></div>
                                <p className="text-lg font-black text-brand-gray-900 uppercase tracking-tighter">{loadingMessage}</p>
                            </div>
                        ) : (
                            <button 
                                onClick={handleManualAnalysis} 
                                disabled={!manualText.trim()} 
                                className="w-full mt-10 bg-brand-blue text-white text-xl font-black py-6 rounded-3xl shadow-soft hover:shadow-soft-lg hover:bg-brand-blue/90 transition-all active:scale-[0.98] disabled:bg-brand-gray-100 disabled:text-brand-gray-400 uppercase tracking-widest"
                            >
                                Analizar Texto Médico
                            </button>
                        )}
                    </>
                )}

                {error && <div className="mt-6 p-6 bg-brand-soft-red text-brand-red rounded-3xl border border-brand-red/10 font-black text-center uppercase text-[10px] tracking-widest shadow-sm">{error}</div>}
                {successMessage && <div className="mt-6 p-6 bg-brand-soft-green text-brand-green rounded-2xl border border-brand-green/10 font-black text-center uppercase text-[10px] tracking-widest flex items-center justify-center gap-3"><CheckCircleIcon className="w-5 h-5" /> {successMessage}</div>}
            </div>

            <div className="mt-16 space-y-10">
                <h2 className="text-[11px] font-black text-brand-gray-400 uppercase tracking-[0.4em] ml-2">Historial de Documentos</h2>
                {clinicalAnalyses.length === 0 ? (
                    <div className="bg-white p-24 rounded-[2.5rem] text-center shadow-soft border border-brand-gray-50">
                        <p className="text-brand-gray-400 font-black uppercase tracking-widest text-[11px]">No hay informes registrados</p>
                    </div>
                ) : (
                    clinicalAnalyses.map(item => (
                        <div key={item.id} className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-brand-gray-50 animate-fade-in hover:shadow-soft-lg transition-shadow">
                            <div className="flex justify-between items-start mb-8 border-b border-brand-gray-50 pb-6">
                                <div>
                                    <h3 className="text-2xl font-black text-brand-gray-900 uppercase tracking-tighter">{item.fileName}</h3>
                                    <p className="text-[10px] font-black text-brand-gray-400 uppercase mt-2 tracking-widest">{item.createdAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                </div>
                                <div className="bg-brand-soft-green text-brand-green px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter shadow-sm">Interpretado</div>
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
