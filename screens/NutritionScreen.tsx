
import React, { useState, useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { analyzeFoodPhoto } from '../services/geminiService';
import { saveNutritionLog, uploadFile } from '../services/firestore';
import { UploadIcon, CheckCircleIcon } from '../components/Icons';
import AnalysisDisplay from '../components/AnalysisDisplay';
import type { NutritionalAnalysisResult } from '../types';

const LoadingSpinner = ({ message }: { message: string }) => (
    <div className="flex flex-col justify-center items-center p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-brand-blue"></div>
        <p className="mt-4 text-xl text-brand-gray-700">{message}</p>
    </div>
);

const NutritionScreen: React.FC = () => {
    const context = useContext(AppContext);
    const { user } = useAuth();
    const { nutritionalAnalyses, setNutritionalAnalyses } = context!;
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);


    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setSuccessMessage(null);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !user) {
            setError("Por favor, seleccione una foto.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        
        try {
            setLoadingMessage("IA analizando su plato...");
            const analysisResult: NutritionalAnalysisResult = await analyzeFoodPhoto(selectedFile);
            
            setLoadingMessage("Subiendo fotografía...");
            // Subimos la foto real al bucket de nutrición
            const remoteUrl = await uploadFile('nutrition-photos', selectedFile);
            
            const newAnalysis = {
                id: Date.now().toString(),
                imagePreview: remoteUrl, // Guardamos la URL de Supabase, no el local blob
                analysis: analysisResult,
                createdAt: new Date(),
            };

            // Guardar registro en BD
            await saveNutritionLog(user.uid, newAnalysis);

            setNutritionalAnalyses(prev => [newAnalysis, ...prev]);

            setSelectedFile(null);
            setImagePreview(null);
            const fileInput = document.getElementById('food-upload') as HTMLInputElement;
            if(fileInput) fileInput.value = "";
            
            setSuccessMessage('Análisis nutricional guardado.');
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err: any) {
            console.error(err);
            setError("Error al procesar la imagen. Compruebe que el Bucket 'nutrition-photos' sea público en Supabase.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="p-4 sm:p-6">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-brand-gray-800">Nutrición Inteligente</h1>
                <p className="text-xl text-brand-gray-600">Suba una foto de su comida para obtener un análisis detallado.</p>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-md mb-8">
                <h2 className="text-2xl font-semibold text-brand-gray-700 mb-4">Analizar Plato</h2>
                 <div className="flex flex-col items-center border-2 border-dashed border-brand-gray-300 p-8 rounded-xl text-center">
                    {imagePreview ? (
                        <img src={imagePreview} alt="Vista previa" className="max-h-64 rounded-lg mb-4 shadow-lg" />
                    ) : (
                        <UploadIcon />
                    )}
                    <p className="text-lg text-brand-gray-600 my-4">Suba una foto clara de su comida</p>
                    <input type="file" id="food-upload" accept="image/*" className="hidden" onChange={handleFileChange} />
                    <label htmlFor="food-upload" className="cursor-pointer bg-brand-lightblue text-brand-blue font-bold py-3 px-6 rounded-lg text-lg hover:bg-sky-200 transition-colors">
                        {selectedFile ? 'Cambiar Foto' : 'Tomar Foto del Plato'}
                    </label>
                </div>
                
                {isLoading ? <LoadingSpinner message={loadingMessage} /> : (
                    <button onClick={handleUpload} disabled={!selectedFile} className="w-full mt-6 bg-brand-blue text-white text-2xl font-bold py-5 px-6 rounded-2xl shadow-lg hover:bg-sky-700 transition-colors disabled:bg-brand-gray-400 disabled:cursor-not-allowed">
                        Analizar Comida
                    </button>
                )}
                 {error && <p className="text-center text-lg mt-4 text-brand-red p-4 bg-red-100 rounded-lg font-bold">{error}</p>}
                 {successMessage && (
                    <div className="mt-4 p-4 bg-green-100 text-green-800 rounded-xl border border-green-200 flex items-center justify-center animate-pulse">
                        <CheckCircleIcon />
                        <span className="ml-2 font-bold text-lg">{successMessage}</span>
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-brand-gray-700">Comidas Recientes</h2>
                {nutritionalAnalyses.length === 0 ? (
                    <p className="text-lg text-center text-brand-gray-600 bg-white p-8 rounded-2xl shadow-md">No hay fotos de comida registradas aún.</p>
                ) : (
                    nutritionalAnalyses.map(item => (
                        <div key={item.id} className="bg-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/3">
                               <img src={item.imagePreview} alt="Comida" className="w-full h-auto object-cover rounded-lg aspect-square shadow-sm"/>
                               <p className="text-lg text-brand-gray-500 mt-2 text-center font-medium">{item.createdAt.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                            <div className="flex-1">
                                <AnalysisDisplay analysis={item.analysis} type="nutrition" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NutritionScreen;
