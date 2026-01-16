
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { registerUserInDb } from '../services/firestore';
import type { UserProfile, HealthData } from '../types';
import { avatars } from '../components/Icons';

const diaryOptions = [
    { id: 'weight', label: 'Peso Corporal' },
    { id: 'systolicBP', label: 'Tensión Sistólica' },
    { id: 'diastolicBP', label: 'Tensión Diastólica' },
    { id: 'pulse', label: 'Pulso (LPM)' },
    { id: 'oxygenSaturation', label: 'Saturación Oxígeno' },
    { id: 'glucose', label: 'Azúcar en Sangre' },
    { id: 'falls', label: 'Control de Caídas' },
    { id: 'calfCircumference', label: 'Pantorrilla' },
    { id: 'abdominalCircumference', label: 'Abdomen' },
];

const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false); 
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalData, setPersonalData] = useState({ displayName: '', birthDate: '', gender: 'male', height: '' });
  const [contactData, setContactData] = useState({ nationality: 'Española', language: 'Español', emergencyName: '', emergencyPhone: '' });
  const [diaryFields, setDiaryFields] = useState<(keyof HealthData)[]>(['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose', 'falls']);
  const [legalData, setLegalData] = useState({ hasLegalConsent: false, dataProcessingConsent: false });
  const [avatarId, setAvatarId] = useState(0);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
        await signIn(email, password); 
    } catch (err: any) {
        setError(err.message || "Credenciales incorrectas o error de conexión.");
    } finally {
        setLoading(false);
    }
  };

  const handleNextStep = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      setError(null);
      if (step === 0) {
          if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
          if (!email.includes('@')) { setError("Email inválido."); return; }
      }
      if (step === 1 && (!personalData.displayName || !personalData.birthDate || !personalData.height)) {
          setError("Complete los campos obligatorios."); return;
      }
      if (step === 4 && (!legalData.hasLegalConsent || !legalData.dataProcessingConsent)) {
          setError("Acepte los términos legales."); return;
      }
      setStep(prev => prev + 1);
  };

  const handleFinalRegister = async () => {
      setLoading(true);
      setError(null);
      setInfoMessage(null);
      try {
          const authRes = await signUp(email, password);
          if (!authRes) {
              setInfoMessage("Por favor, revisa tu correo electrónico para confirmar tu cuenta antes de continuar.");
              return;
          }

          const newProfile: UserProfile = {
              email: email,
              displayName: personalData.displayName,
              birthDate: personalData.birthDate,
              gender: personalData.gender as 'male' | 'female' | 'other',
              nationality: contactData.nationality,
              language: contactData.language,
              emergencyContactName: contactData.emergencyName,
              emergencyContactPhone: contactData.emergencyPhone,
              diaryPreferences: diaryFields, 
              hasLegalConsent: legalData.hasLegalConsent,
              dataProcessingConsent: legalData.dataProcessingConsent,
              avatarId: avatarId,
              healthData: {
                  weight: null, falls: null, systolicBP: null, diastolicBP: null, pulse: null,
                  oxygenSaturation: null, glucose: null, calfCircumference: null, abdominalCircumference: null,
                  height: parseFloat(personalData.height) || null
              },
              // FIXED: Corrected category value to 'No frágil' to align with VigsCategory type
              vigsScore: { score: 0, category: 'No frágil' },
              alerts: [{ id: Date.now(), type: 'success', title: 'Bienvenido', message: 'Su perfil ha sido creado correctamente.' }]
          };

          try {
              // We try to register in DB. If confirmation is required, this might fail with RLS.
              await registerUserInDb(authRes.uid, newProfile);
              setInfoMessage("¡Registro completado! Ya puedes iniciar sesión.");
              setIsRegistering(false);
          } catch (rlsError: any) {
              console.warn("RLS restriction during signup (common if email confirmation is required):", rlsError);
              setInfoMessage("Cuenta creada. Por favor, confirma tu correo electrónico antes de entrar.");
          }
      } catch (err: any) {
          setError(err.message || "Error inesperado en el registro.");
      } finally {
          setLoading(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        if (step === 5) {
            handleFinalRegister();
        } else {
            handleNextStep();
        }
    }
  };

  const renderStepContent = () => {
      switch(step) {
          case 0: return (
              <div className="space-y-4" onKeyDown={handleKeyDown}>
                  <h2 className="text-2xl font-bold text-brand-blue mb-4">Paso 1: Su Cuenta</h2>
                  <input type="email" placeholder="Email" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={email} onChange={e => setEmail(e.target.value)} required />
                  <input type="password" placeholder="Contraseña (6+ caracteres)" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
          );
          case 1: return (
              <div className="space-y-4" onKeyDown={handleKeyDown}>
                  <h2 className="text-2xl font-bold text-brand-blue mb-4">Paso 2: Datos Personales</h2>
                  <input type="text" placeholder="Nombre completo" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={personalData.displayName} onChange={e => setPersonalData({...personalData, displayName: e.target.value})} />
                  <div className="space-y-1">
                      <label className="text-sm font-bold text-gray-500 ml-1">Fecha de Nacimiento</label>
                      <input type="date" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={personalData.birthDate} onChange={e => setPersonalData({...personalData, birthDate: e.target.value})} />
                  </div>
                  <input type="number" placeholder="Altura (cm)" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={personalData.height} onChange={e => setPersonalData({...personalData, height: e.target.value})} />
              </div>
          );
          case 2: return (
            <div className="space-y-4" onKeyDown={handleKeyDown}>
                <h2 className="text-2xl font-bold text-brand-blue mb-4">Paso 3: Contacto</h2>
                <input type="text" placeholder="Nacionalidad" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={contactData.nationality} onChange={e => setContactData({...contactData, nationality: e.target.value})} />
                <input type="text" placeholder="Nombre contacto emergencia" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={contactData.emergencyName} onChange={e => setContactData({...contactData, emergencyName: e.target.value})} />
                <input type="tel" placeholder="Teléfono emergencia" className="w-full p-4 border-2 rounded-xl text-lg outline-none focus:border-brand-blue" value={contactData.emergencyPhone} onChange={e => setContactData({...contactData, emergencyPhone: e.target.value})} />
            </div>
          );
          case 3: return (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2" onKeyDown={handleKeyDown}>
                  <h2 className="text-2xl font-bold text-brand-blue mb-2">Paso 4: Su Diario</h2>
                  <p className="text-gray-600 mb-4">Marque lo que desea registrar cada día:</p>
                  {diaryOptions.map((opt) => (
                      <label key={opt.id} className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all ${diaryFields.includes(opt.id as any) ? 'bg-blue-50 border-brand-blue' : 'bg-white border-gray-200'}`}>
                          <input type="checkbox" checked={diaryFields.includes(opt.id as any)} onChange={() => setDiaryFields(prev => prev.includes(opt.id as any) ? prev.filter(x => x !== opt.id) : [...prev, opt.id as any])} className="w-6 h-6 mr-4 text-brand-blue rounded border-gray-300" />
                          <span className="text-lg font-bold text-gray-700">{opt.label}</span>
                      </label>
                  ))}
              </div>
          );
          case 4: return (
              <div className="space-y-4" onKeyDown={handleKeyDown}>
                  <h2 className="text-2xl font-bold text-brand-blue mb-4">Paso 5: Legal y Privacidad</h2>
                  <div className="p-4 bg-gray-50 rounded-2xl text-sm text-gray-600 border border-gray-200 mb-4 max-h-48 overflow-y-auto">
                      <p className="font-bold mb-2">Resumen de Privacidad:</p>
                      <p>Fisiosilver protege sus datos de salud con encriptación avanzada. Solo se utilizarán para realizar análisis de fragilidad y recomendaciones personalizadas por el asistente. Sus datos nunca se venderán a terceros.</p>
                  </div>
                  <label className="flex items-start gap-4 p-4 border-2 rounded-2xl bg-white cursor-pointer active:bg-gray-50">
                      <input type="checkbox" checked={legalData.hasLegalConsent} onChange={e => setLegalData({...legalData, hasLegalConsent: e.target.checked})} className="mt-1 w-6 h-6 text-brand-blue" />
                      <span className="text-gray-700 font-medium">Acepto el consentimiento informado para el uso de la aplicación.</span>
                  </label>
                  <label className="flex items-start gap-4 p-4 border-2 rounded-2xl bg-white cursor-pointer active:bg-gray-50">
                      <input type="checkbox" checked={legalData.dataProcessingConsent} onChange={e => setLegalData({...legalData, dataProcessingConsent: e.target.checked})} className="mt-1 w-6 h-6 text-brand-blue" />
                      <span className="text-gray-700 font-medium">Autorizo el tratamiento de mis datos de salud con fines de seguimiento médico.</span>
                  </label>
              </div>
          );
          case 5: return (
              <div className="grid grid-cols-3 gap-4" onKeyDown={handleKeyDown}>
                  <h2 className="col-span-3 text-2xl font-bold text-brand-blue mb-4 text-center">Paso 6: Elija su Avatar</h2>
                  {avatars.map((A, i) => (
                      <button key={i} onClick={() => setAvatarId(i)} className={`p-4 rounded-3xl flex justify-center transition-all ${avatarId === i ? 'ring-4 ring-brand-blue bg-blue-50 border-brand-blue' : 'bg-gray-50 border-transparent'} border-2`}><A className="w-16 h-16" /></button>
                  ))}
              </div>
          );
          default: return null;
      }
  };

  if (isRegistering) {
      return (
        <div className="min-h-screen bg-brand-gray-100 flex flex-col justify-center items-center p-4">
            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-2xl w-full max-w-xl">
                <div className="mb-8 flex gap-2">
                    {[0,1,2,3,4,5].map(i => <div key={i} className={`h-2.5 flex-1 rounded-full ${i <= step ? 'bg-brand-blue' : 'bg-gray-200'}`}></div>)}
                </div>
                <div className="min-h-[300px]">
                    {renderStepContent()}
                </div>
                {error && <p className="mt-6 text-brand-red font-bold text-center p-4 bg-red-50 rounded-2xl text-sm border border-red-100">{error}</p>}
                {infoMessage && <p className="mt-6 text-brand-blue font-bold text-center p-4 bg-blue-50 rounded-2xl text-sm border border-blue-100">{infoMessage}</p>}
                <div className="mt-10 flex gap-4">
                    {step > 0 && <button onClick={() => setStep(s => s - 1)} className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold text-lg active:scale-95 transition-all">Atrás</button>}
                    <button onClick={step === 5 ? handleFinalRegister : () => handleNextStep()} disabled={loading} className="flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all">
                        {loading ? 'Procesando...' : (step === 5 ? 'Finalizar Registro' : 'Siguiente')}
                    </button>
                </div>
                <button onClick={() => { setIsRegistering(false); setError(null); setInfoMessage(null); }} className="w-full mt-6 text-brand-gray-500 font-bold hover:text-brand-blue transition-colors">¿Ya tiene cuenta? Iniciar Sesión</button>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-brand-gray-100 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center">
        <h1 className="text-4xl font-black text-brand-blue mb-2">Fisiosilver</h1>
        <p className="text-brand-gray-600 mb-10 text-lg">Asistente de Salud Senior</p>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="email" placeholder="Correo electrónico" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 border-2 rounded-2xl text-lg focus:border-brand-blue outline-none font-bold" />
          <input type="password" placeholder="Contraseña" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 border-2 rounded-2xl text-lg focus:border-brand-blue outline-none font-bold" />
          {error && <p className="text-brand-red font-bold bg-red-50 p-3 rounded-lg text-sm">{error}</p>}
          {infoMessage && <p className="text-brand-blue font-bold bg-blue-50 p-3 rounded-lg text-sm">{infoMessage}</p>}
          <button type="submit" disabled={loading} className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl text-xl shadow-lg hover:bg-sky-700 transition-all active:scale-95">
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>
        <div className="mt-10 pt-8 border-t">
            <button onClick={() => { setIsRegistering(true); setError(null); setInfoMessage(null); setStep(0); }} className="w-full py-4 border-2 border-brand-blue text-brand-blue font-bold rounded-2xl text-lg active:scale-95 transition-all hover:bg-blue-50">Crear Cuenta Nueva</button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
