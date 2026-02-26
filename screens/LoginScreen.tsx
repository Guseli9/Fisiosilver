
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { registerUserInDb } from '../services/firestore';
import type { UserProfile, HealthData, SmokingStatus } from '../types';
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

const smokingOptions: { id: SmokingStatus; label: string }[] = [
    { id: 'Nunca', label: 'Nunca he fumado' },
    { id: 'Ex-fumador', label: 'Soy ex-fumador' },
    { id: 'Activo', label: 'Fumo actualmente' },
];

const LoginScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false); 
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [personalData, setPersonalData] = useState({ displayName: '', gender: 'male' as const, height: '' });
  const [diaryFields, setDiaryFields] = useState<(keyof HealthData)[]>(['weight', 'systolicBP', 'diastolicBP', 'pulse', 'glucose']);
  const [legalData, setLegalData] = useState({ hasLegalConsent: false, dataProcessingConsent: false });
  const [avatarId, setAvatarId] = useState(0);
  const [smokingStatus, setSmokingStatus] = useState<SmokingStatus>('Nunca');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
        await signIn(email, password); 
    } catch (err: any) {
        setError("Correo o contraseña no válidos.");
    } finally {
        setLoading(false);
    }
  };

  const inputClass = "w-full p-5 bg-white border-2 border-brand-gray-200 rounded-2xl text-lg font-black text-brand-gray-900 focus:border-brand-blue outline-none transition-all placeholder:text-brand-gray-400";

  const renderStepContent = () => {
      switch(step) {
          case 0: return (
              <div className="space-y-6 animate-fade-in">
                  <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase">Datos de acceso</h2>
                  <input type="email" placeholder="Correo electrónico" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} />
                  <input type="password" placeholder="Contraseña (mínimo 6 caracteres)" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} />
              </div>
          );
          case 1: return (
              <div className="space-y-6 animate-fade-in">
                  <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase">Su Identidad</h2>
                  <input type="text" placeholder="Su nombre de usuario" className={inputClass} value={personalData.displayName} onChange={e => setPersonalData({...personalData, displayName: e.target.value})} />
                  <input type="number" placeholder="Altura en cm (ej. 170)" className={inputClass} value={personalData.height} onChange={e => setPersonalData({...personalData, height: e.target.value})} />
              </div>
          );
          case 2: return (
            <div className="space-y-4 animate-fade-in">
                <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase">Hábito Tabáquico</h2>
                {smokingOptions.map(opt => (
                    <button key={opt.id} onClick={() => setSmokingStatus(opt.id)} className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${smokingStatus === opt.id ? 'border-brand-blue bg-blue-50' : 'border-brand-gray-100 bg-white'}`}>
                        <span className={`font-black uppercase text-sm tracking-widest ${smokingStatus === opt.id ? 'text-brand-blue' : 'text-brand-gray-900'}`}>{opt.label}</span>
                    </button>
                ))}
            </div>
          );
          case 3: return (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 animate-fade-in">
                  <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase">Su Diario</h2>
                  {diaryOptions.map(opt => (
                      <button key={opt.id} onClick={() => setDiaryFields(prev => prev.includes(opt.id as any) ? prev.filter(x => x !== opt.id) : [...prev, opt.id as any])} className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${diaryFields.includes(opt.id as any) ? 'border-brand-blue bg-blue-50' : 'border-brand-gray-100 bg-white'}`}>
                          <span className={`font-black uppercase text-xs tracking-widest ${diaryFields.includes(opt.id as any) ? 'text-brand-blue' : 'text-brand-gray-900'}`}>{opt.label}</span>
                      </button>
                  ))}
              </div>
          );
          case 4: return (
              <div className="space-y-6 animate-fade-in">
                  <h2 className="text-2xl font-black text-brand-gray-900 tracking-tighter uppercase">Consentimientos</h2>
                  <label className="flex items-start gap-4 p-5 rounded-2xl bg-brand-gray-50 border-2 border-brand-gray-100 cursor-pointer">
                      <input type="checkbox" checked={legalData.hasLegalConsent} onChange={e => setLegalData({...legalData, hasLegalConsent: e.target.checked})} className="mt-1 w-6 h-6 accent-brand-blue" />
                      <span className="text-sm font-black text-brand-gray-900 uppercase tracking-tighter">Acepto los términos y condiciones.</span>
                  </label>
                  <label className="flex items-start gap-4 p-5 rounded-2xl bg-brand-gray-50 border-2 border-brand-gray-100 cursor-pointer">
                      <input type="checkbox" checked={legalData.dataProcessingConsent} onChange={e => setLegalData({...legalData, dataProcessingConsent: e.target.checked})} className="mt-1 w-6 h-6 accent-brand-blue" />
                      <span className="text-sm font-black text-brand-gray-900 uppercase tracking-tighter">Autorizo el uso de mis datos médicos.</span>
                  </label>
              </div>
          );
          case 5: return (
              <div className="grid grid-cols-3 gap-4 animate-fade-in">
                  <h2 className="col-span-3 text-2xl font-black text-brand-gray-900 tracking-tighter uppercase">Su Avatar</h2>
                  {avatars.map((A, i) => (
                      <button key={i} onClick={() => setAvatarId(i)} className={`p-4 rounded-2xl flex justify-center border-4 transition-all ${avatarId === i ? 'border-brand-blue bg-blue-50' : 'border-transparent bg-brand-gray-50'}`}><A className="w-12 h-12" /></button>
                  ))}
              </div>
          );
          default: return null;
      }
  };

  const handleNext = () => {
      if (step === 0 && (!email || password.length < 6)) { setError("Email válido y contraseña de 6+ caracteres."); return; }
      if (step === 1 && !personalData.displayName) { setError("Introduzca su nombre de usuario."); return; }
      if (step === 4 && (!legalData.hasLegalConsent || !legalData.dataProcessingConsent)) { setError("Debe aceptar los términos."); return; }
      setError(null);
      setStep(s => s + 1);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
        const res = await signUp(email, password);
        if (!res) { setError("No se pudo crear la cuenta."); return; }
        await registerUserInDb(res.uid, {
            email, displayName: personalData.displayName, gender: 'male', nationality: 'Española', language: 'Español', emergencyContactName: '', emergencyContactPhone: '', hasLegalConsent: true, dataProcessingConsent: true, avatarId, diaryPreferences: diaryFields, healthData: { weight: null, falls: null, systolicBP: null, diastolicBP: null, pulse: null, oxygenSaturation: null, glucose: null, calfCircumference: null, abdominalCircumference: null, height: parseFloat(personalData.height) || 170 }, vigsScore: { score: 0, category: 'No frágil' }, alerts: [], smokingStatus, nutritionalScore: 0
        });
        setIsRegistering(false);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
      <div className="bg-white p-10 sm:p-12 rounded-v-xl shadow-soft-lg w-full max-w-md border border-brand-gray-100">
        <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-brand-blue tracking-tighter uppercase leading-none">Fisiosilver</h1>
            <p className="text-brand-gray-400 font-black text-[10px] uppercase tracking-[0.4em] mt-2">Salud Senior Inteligente</p>
        </div>

        {isRegistering ? (
            <div>
                <div className="flex gap-1 mb-8">
                    {[0,1,2,3,4,5].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-brand-blue' : 'bg-brand-gray-100'}`}></div>)}
                </div>
                {renderStepContent()}
                {error && <p className="mt-6 text-brand-red text-center font-black text-[10px] bg-brand-soft-red p-4 rounded-xl uppercase tracking-widest">{error}</p>}
                <div className="mt-10 flex gap-4">
                    {step > 0 && <button onClick={() => setStep(s => s - 1)} className="flex-1 py-5 bg-brand-gray-100 text-brand-gray-900 rounded-2xl font-black text-xs uppercase tracking-widest">Atrás</button>}
                    <button onClick={step === 5 ? handleRegister : handleNext} disabled={loading} className="flex-[2] py-5 bg-brand-blue text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-soft">{loading ? '...' : (step === 5 ? 'Crear Cuenta' : 'Siguiente')}</button>
                </div>
            </div>
        ) : (
            <form onSubmit={handleLogin} className="space-y-6">
                <input type="email" placeholder="Correo electrónico" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} required />
                <input type="password" placeholder="Contraseña" className={inputClass} value={password} onChange={e => setPassword(e.target.value)} required />
                {error && <p className="text-brand-red text-center font-black text-[10px] bg-brand-soft-red p-4 rounded-xl uppercase tracking-widest">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-6 bg-brand-blue text-white rounded-v-large font-black text-sm uppercase tracking-widest shadow-soft active:scale-95 transition-all">{loading ? 'Entrando...' : 'Entrar'}</button>
                <div className="pt-8 border-t border-brand-gray-50 mt-10">
                    <button type="button" onClick={() => { setIsRegistering(true); setStep(0); }} className="w-full py-5 border-2 border-brand-blue text-brand-blue rounded-v-large font-black text-[10px] uppercase tracking-[0.3em]">Registrarse como paciente</button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
