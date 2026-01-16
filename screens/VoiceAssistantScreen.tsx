import React, { useState, useEffect, useRef, useContext } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from "@google/genai";
import { MicrophoneIcon, XMarkIcon, CheckCircleIcon } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { AppContext } from '../contexts/AppContext';
import { saveDailyLog, updateUserProfile, saveAppointment } from '../services/firestore';
import type { HealthData } from '../types';

// --- Audio Helper Functions ---

// Decodes a base64 string into a Uint8Array.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Encodes a Uint8Array into a base64 string.
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decodes raw PCM audio data into an AudioBuffer for playback.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Creates a Gemini API Blob from microphone Float32Array data.
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Tool Definitions ---

const saveHealthDataTool: FunctionDeclaration = {
  name: "saveHealthData",
  description: "Guarda datos de salud o métricas fisiológicas proporcionadas por el usuario en su diario.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      weight: { type: Type.NUMBER, description: "Peso corporal en kg." },
      systolicBP: { type: Type.NUMBER, description: "Tensión arterial sistólica (la alta)." },
      diastolicBP: { type: Type.NUMBER, description: "Tensión arterial diastólica (la baja)." },
      pulse: { type: Type.NUMBER, description: "Pulso o frecuencia cardíaca en latidos por minuto (lpm)." },
      oxygenSaturation: { type: Type.NUMBER, description: "Saturación de oxígeno en porcentaje (%)." },
      glucose: { type: Type.NUMBER, description: "Nivel de glucosa o azúcar en sangre (mg/dl)." },
      falls: { type: Type.NUMBER, description: "Número de caídas sufridas esta semana." },
      abdominalCircumference: { type: Type.NUMBER, description: "Perímetro abdominal en cm." },
      calfCircumference: { type: Type.NUMBER, description: "Perímetro de pantorrilla en cm." },
    },
  }
};

const scheduleAppointmentTool: FunctionDeclaration = {
    name: "scheduleAppointment",
    description: "Programa o guarda una cita médica, recordatorio o evento en el calendario del usuario.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Título o razón de la cita (ej. 'Cita con Cardiólogo')." },
            dateTimeDescription: { type: Type.STRING, description: "Descripción de la fecha y hora proporcionada por el usuario (ej. 'El próximo viernes a las 5 de la tarde')." }
        },
        required: ["title", "dateTimeDescription"]
    }
};

// --- Component ---

type ConversationTurn = {
    speaker: 'user' | 'model' | 'system';
    text: string;
};

interface VoiceAssistantScreenProps {
  onClose: () => void;
}

const VoiceAssistantScreen: React.FC<VoiceAssistantScreenProps> = ({ onClose }) => {
    const { user } = useAuth();
    const context = useContext(AppContext);
    // Access context setters to update UI in real-time
    const { healthData, vigsScore, setHealthData, setAlerts } = context!;

    const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [conversation, setConversation] = useState<ConversationTurn[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Removing LiveSession type as it is not exported.
    const sessionRef = useRef<any>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const nextStartTimeRef = useRef(0);
    const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const conversationEndRef = useRef<HTMLDivElement>(null);

    // Keep latest healthData in ref for merging
    const healthDataRef = useRef(healthData);
    useEffect(() => { healthDataRef.current = healthData; }, [healthData]);


    const cleanup = () => {
        console.log("Cleaning up resources...");
        sessionRef.current?.close();
        sessionRef.current = null;

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        mediaStreamSourceRef.current?.disconnect();
        mediaStreamSourceRef.current = null;

        inputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;
        outputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current = null;

        outputSourcesRef.current.forEach(source => source.stop());
        outputSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    };

    const stopConversation = () => {
        cleanup();
        setConnectionState('idle');
    };

    const startConversation = async () => {
        if (!user) return;

        setConnectionState('connecting');
        setErrorMessage('');
        setConversation([]);
        setCurrentInput('');
        setCurrentOutput('');

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Su navegador no soporta el acceso al micrófono.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            // Initializing with correct apiKey format as per guidelines.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                callbacks: {
                    onopen: () => {
                        console.log('Connection opened.');
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        mediaStreamSourceRef.current = source;
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            // Initiating sendRealtimeInput after connect resolves.
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        // Handle Tool Calls (Saving Data & Appointments)
                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                if (fc.name === 'saveHealthData') {
                                    try {
                                        // 1. Merge new data with existing
                                        const newData = fc.args as Partial<HealthData>;
                                        const mergedData = { ...healthDataRef.current, ...newData };

                                        // 2. Save to Firestore
                                        await saveDailyLog(user.uid, mergedData);
                                        const newAlerts = [
                                            { id: Date.now(), type: 'success' as const, title: 'Datos de Voz', message: 'Datos guardados por el asistente.' },
                                            ...context!.alerts.filter(a => a.type !== 'success')
                                        ];
                                        await updateUserProfile(user.uid, { alerts: newAlerts });

                                        // 3. Update Context
                                        setHealthData(mergedData);
                                        setAlerts(newAlerts);

                                        // 4. Show system message
                                        const savedText = Object.entries(newData)
                                            .map(([key, val]) => `${key}: ${val}`)
                                            .join(', ');
                                        
                                        setConversation(prev => [...prev, { 
                                            speaker: 'system', 
                                            text: `Datos guardados: ${savedText}` 
                                        }]);

                                        sessionPromise.then((session) => {
                                            session.sendToolResponse({
                                                functionResponses: {
                                                    id: fc.id,
                                                    name: fc.name,
                                                    response: { result: "Success. Data saved." }
                                                }
                                            });
                                        });

                                    } catch (err) {
                                        sessionPromise.then((session) => {
                                            session.sendToolResponse({
                                                functionResponses: {
                                                    id: fc.id,
                                                    name: fc.name,
                                                    response: { error: "Failed to save data." }
                                                }
                                            });
                                        });
                                    }
                                } else if (fc.name === 'scheduleAppointment') {
                                    try {
                                        const { title, dateTimeDescription } = fc.args as any;
                                        await saveAppointment(user.uid, title, dateTimeDescription);
                                        
                                        setConversation(prev => [...prev, { 
                                            speaker: 'system', 
                                            text: `Cita guardada: ${title} (${dateTimeDescription})` 
                                        }]);

                                        sessionPromise.then((session) => {
                                            session.sendToolResponse({
                                                functionResponses: {
                                                    id: fc.id,
                                                    name: fc.name,
                                                    response: { result: "Success. Appointment saved." }
                                                }
                                            });
                                        });
                                    } catch (err) {
                                         sessionPromise.then((session) => {
                                            session.sendToolResponse({
                                                functionResponses: {
                                                    id: fc.id,
                                                    name: fc.name,
                                                    response: { error: "Failed to save appointment." }
                                                }
                                            });
                                        });
                                    }
                                }
                            }
                        }

                        // Handle transcriptions
                        if (message.serverContent?.inputTranscription) {
                            setCurrentInput(prev => prev + message.serverContent!.inputTranscription!.text);
                        }
                        if (message.serverContent?.outputTranscription) {
                            setCurrentOutput(prev => prev + message.serverContent!.outputTranscription!.text);
                        }
                        if (message.serverContent?.turnComplete) {
                            const finalInput = currentInput + (message.serverContent.inputTranscription?.text || '');
                            const finalOutput = currentOutput + (message.serverContent.outputTranscription?.text || '');

                            if (finalInput.trim() || finalOutput.trim()) {
                                setConversation(prev => [
                                    ...prev,
                                    { speaker: 'user', text: finalInput },
                                    { speaker: 'model', text: finalOutput }
                                ]);
                            }
                            setCurrentInput('');
                            setCurrentOutput('');
                        }

                        // Handle audio output using recommended method.
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            const outputCtx = outputAudioContextRef.current!;
                            // tracking playback queue.
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            
                            source.addEventListener('ended', () => {
                                outputSourcesRef.current.delete(source);
                            });

                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            outputSourcesRef.current.add(source);
                        }

                        // Handle interruption
                         if (message.serverContent?.interrupted) {
                            for (const source of outputSourcesRef.current.values()) {
                                source.stop();
                                outputSourcesRef.current.delete(source);
                            }
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Connection error:', e);
                        setErrorMessage('Se ha producido un error de conexión. Por favor, inténtelo de nuevo.');
                        setConnectionState('error');
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Connection closed.');
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{ functionDeclarations: [saveHealthDataTool, scheduleAppointmentTool] }],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                    },
                    systemInstruction: `
                        Eres un asistente de salud geriátrica amable, empático y paciente.
                        Tienes acceso a los datos de salud actuales del paciente.
                        
                        CONTEXTO DEL PACIENTE:
                        - Peso actual: ${healthData.weight || 'Desconocido'} kg
                        - Tensión Sistólica: ${healthData.systolicBP || 'Desconocida'}
                        - Tensión Diastólica: ${healthData.diastolicBP || 'Desconocida'}
                        - Índice de Fragilidad (VIGS): ${vigsScore.score} (${vigsScore.category})
                        - Caídas recientes: ${healthData.falls || 0}
                        
                        INSTRUCCIONES:
                        1. Si el usuario pregunta por su estado (ej. "¿Cómo está mi tensión?", "¿He engordado?"), responde usando los datos del CONTEXTO DEL PACIENTE.
                        2. Si el usuario te dice un nuevo dato de salud, USA la herramienta 'saveHealthData'.
                        3. Si el usuario quiere recordar una cita o evento médico, USA la herramienta 'scheduleAppointment'.
                        4. Habla despacio, claro y con un tono cálido. Sé breve en tus respuestas.
                    `,
                },
            });

            sessionRef.current = await sessionPromise;
            setConnectionState('connected');

        } catch (error: any) {
            console.error("Failed to start conversation:", error);
            let userMessage = 'No se pudo iniciar el asistente de voz. Inténtelo de nuevo.';
            if (error.name === 'NotAllowedError' || error.message.includes('permission denied')) {
                userMessage = 'Acceso al micrófono denegado. Por favor, permita el acceso en los ajustes de su navegador.';
            }
            setErrorMessage(userMessage);
            setConnectionState('error');
            cleanup();
        }
    };

    useEffect(() => {
        startConversation();
        return () => {
            stopConversation();
        };
    }, []);

    useEffect(() => {
        conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversation, currentInput, currentOutput]);

    const getButtonState = () => {
        switch (connectionState) {
            case 'idle':
            case 'error':
                return { text: 'Cerrar', color: 'bg-brand-gray-500', pulse: false };
            case 'connecting':
                return { text: 'Conectando...', color: 'bg-brand-yellow', pulse: true };
            case 'connected':
                return { text: 'Finalizar Conversación', color: 'bg-brand-red', pulse: true };
        }
    };

    const { text: buttonText, color: buttonColor, pulse: buttonPulse } = getButtonState();

    return (
        <div className="p-4 sm:p-6 flex flex-col h-full relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-brand-gray-500 hover:text-brand-gray-900 z-10 rounded-full hover:bg-brand-gray-200 transition-colors"
              aria-label="Cerrar asistente de voz"
            >
              <XMarkIcon />
            </button>
            
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-bold text-brand-gray-800">Asistente por Voz</h1>
                <p className="text-xl text-brand-gray-600">Dígame sus datos o programe citas médicas.</p>
            </header>

            <div className="flex-grow flex flex-col items-center bg-white p-6 rounded-2xl shadow-md">
                <div className="w-full flex-grow bg-brand-gray-100 rounded-lg p-4 overflow-y-auto mb-6 h-64">
                    {conversation.length === 0 && !currentInput && !currentOutput && connectionState !== 'connecting' && (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-brand-gray-500 text-lg">La transcripción aparecerá aquí.</p>
                        </div>
                    )}
                    {conversation.map((turn, index) => {
                        if (turn.speaker === 'system') {
                             return (
                                <div key={index} className="mb-3 text-center">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-green-100 text-green-800 border border-green-200">
                                        <CheckCircleIcon /> {turn.text}
                                    </span>
                                </div>
                             );
                        }
                        return (
                            turn.text.trim() && <div key={index} className={`mb-3 ${turn.speaker === 'user' ? 'text-right' : 'text-left'}`}>
                                <span className={`inline-block p-3 rounded-xl text-lg ${turn.speaker === 'user' ? 'bg-brand-blue text-white' : 'bg-brand-gray-200 text-brand-gray-800'}`}>
                                    <strong>{turn.speaker === 'user' ? 'Usted' : 'Asistente'}:</strong> {turn.text}
                                </span>
                            </div>
                        );
                    })}
                    {currentInput && (
                         <div className="text-right mb-3">
                            <span className="inline-block p-3 rounded-xl text-lg bg-brand-blue text-white opacity-75">
                                <strong>Usted:</strong> {currentInput}
                            </span>
                        </div>
                    )}
                     {currentOutput && (
                        <div className="text-left mb-3">
                            <span className="inline-block p-3 rounded-xl text-lg bg-brand-gray-200 text-brand-gray-800 opacity-75">
                                 <strong>Asistente:</strong> {currentOutput}
                            </span>
                        </div>
                    )}
                    <div ref={conversationEndRef} />
                </div>
                
                <button
                    onClick={onClose}
                    className={`rounded-full p-8 transition-all duration-300 ease-in-out ${buttonColor} ${buttonPulse ? 'animate-pulse' : ''}`}
                    aria-label={buttonText}
                >
                    <MicrophoneIcon />
                </button>

                <p className="text-2xl text-brand-gray-700 font-semibold mt-8 text-center h-16">
                    {errorMessage ? <span className="text-brand-red">{errorMessage}</span> : buttonText}
                </p>
            </div>
        </div>
    );
};

export default VoiceAssistantScreen;