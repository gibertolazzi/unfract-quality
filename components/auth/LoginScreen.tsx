import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Mail, Lock, User, ArrowLeft } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'reset';

export function LoginScreen() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLocalLoading(true);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        if (!name.trim()) throw new Error("Inserisci il tuo nome");
        await registerWithEmail(email, password, name);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setMessage("Ti abbiamo inviato un'email per reimpostare la password.");
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || "Si è verificato un errore");
    } finally {
      setLocalLoading(false);
    }
  };

  const isLoading = authLoading || localLoading;

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex items-center justify-center overflow-hidden z-[100]">
      {/* Motion gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute bottom-[-45%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#006AFF] opacity-[0.35] blur-[140px] rounded-full animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10 bg-[#0B0B0B]/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 sm:p-12 w-full max-w-[420px] flex flex-col shadow-2xl mx-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Loader2 size={32} className="text-[#006AFF] animate-spin mb-4" />
            <p className="text-white/60 font-medium">Caricamento...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <svg width="112" height="24" viewBox="0 0 112 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-6">
                <path d="M91.6328 5.97168C93.2024 5.97168 94.5622 6.26727 95.7119 6.85742C96.8622 7.43688 97.7598 8.22568 98.4043 9.22363C99.06 10.2216 99.4206 11.3431 99.4854 12.5879V12.7002H95.1162L95.084 12.5557C94.944 11.7294 94.5888 11.0424 94.0195 10.4951C93.4497 9.93727 92.6759 9.65829 91.6982 9.6582C90.935 9.6582 90.2684 9.87275 89.6992 10.3018C89.1399 10.7203 88.7043 11.327 88.3926 12.1211C88.0914 12.9045 87.9414 13.8439 87.9414 14.9385V14.9541C87.9414 16.0808 88.0914 17.0418 88.3926 17.8359C88.7043 18.6192 89.1399 19.2202 89.6992 19.6387C90.2684 20.0463 90.9407 20.25 91.7139 20.25C92.66 20.25 93.4175 19.9876 93.9873 19.4619C94.5678 18.9253 94.9385 18.2217 95.0996 17.3525L95.1162 17.208H99.501V17.3047C99.4263 18.5601 99.06 19.6866 98.4043 20.6846C97.7485 21.6825 96.846 22.4771 95.6963 23.0674C94.5565 23.6468 93.2183 23.9365 91.6816 23.9365C89.9299 23.9365 88.4147 23.5713 87.1357 22.8418C85.8566 22.1121 84.8727 21.0767 84.1846 19.7354C83.4965 18.3833 83.1534 16.7842 83.1533 14.9385V14.9219C83.1533 13.0762 83.4965 11.4879 84.1846 10.1572C84.8832 8.81582 85.8672 7.78541 87.1357 7.06641C88.4147 6.33687 89.9135 5.97172 91.6328 5.97168ZM107.756 6.32617H110.916V9.86719H107.756V18.2383C107.756 19.043 107.933 19.6068 108.288 19.9287C108.653 20.2397 109.191 20.3955 109.9 20.3955C110.115 20.3955 110.304 20.3897 110.465 20.3789C110.626 20.3575 110.776 20.3359 110.916 20.3145V23.7598C110.658 23.8027 110.335 23.8398 109.948 23.8721C109.572 23.915 109.137 23.9365 108.643 23.9365C106.73 23.9365 105.311 23.5341 104.387 22.7295C103.462 21.9246 102.999 20.5988 102.999 18.7529V9.86719H100.598V6.32617H102.999V2.1084H107.756V6.32617ZM73.3828 5.97168C74.8764 5.97168 76.1714 6.2135 77.2676 6.69629C78.3645 7.16851 79.2132 7.83971 79.8154 8.70898C80.4282 9.57822 80.7344 10.5921 80.7344 11.751V23.582H76.0273V21.0068H75.9297C75.6075 21.5969 75.1885 22.1069 74.6729 22.5361C74.1677 22.9546 73.5923 23.2815 72.9473 23.5176C72.3027 23.7429 71.5984 23.8564 70.835 23.8564C69.6853 23.8564 68.6747 23.6362 67.8037 23.1963C66.9334 22.7456 66.2516 22.1281 65.7568 21.3447C65.2732 20.5506 65.0313 19.6493 65.0312 18.6406V18.6084C65.0312 17.5567 65.2946 16.6604 65.8213 15.9199C66.3479 15.1688 67.1113 14.5786 68.1104 14.1494C69.1102 13.7201 70.3252 13.4569 71.7549 13.3604L76.0273 13.0947V12.041C76.0273 11.2791 75.7851 10.6773 75.3018 10.2373C74.8184 9.78665 74.1133 9.56153 73.1895 9.56152C72.3079 9.56152 71.6095 9.74453 71.0938 10.1094C70.578 10.4742 70.2598 10.9352 70.1416 11.4932L70.1104 11.6387H65.8047L65.8213 11.4453C65.9073 10.383 66.257 9.43863 66.8691 8.6123C67.4925 7.78602 68.3523 7.14214 69.4492 6.68066C70.556 6.20852 71.8673 5.97169 73.3828 5.97168ZM19.0186 23.582H4.75488V18.835H14.2637V0.175781H19.0186V23.582ZM33.334 5.97168C35.2365 5.97168 36.7045 6.54609 37.7363 7.69434C38.7788 8.83188 39.2998 10.4152 39.2998 12.4434V23.582H34.5918V13.4092C34.5918 12.2824 34.3235 11.4125 33.7861 10.8008C33.2595 10.1784 32.4692 9.86722 31.416 9.86719C30.7173 9.86719 30.1096 10.0287 29.5938 10.3506C29.0779 10.6618 28.675 11.1022 28.3848 11.6709C28.1055 12.2395 27.9659 12.9044 27.9658 13.666V23.582H23.2578V6.32617H27.9658V9.15918H28.0625C28.5139 8.17196 29.1802 7.39391 30.0615 6.8252C30.9428 6.25646 32.0336 5.97174 33.334 5.97168ZM49.2314 0C49.6613 8.72436e-06 50.0965 0.0215361 50.5371 0.0644531C50.9778 0.096647 51.3329 0.139704 51.6016 0.193359V3.2998C51.4403 3.26762 51.252 3.24608 51.0371 3.23535C50.8221 3.22462 50.6066 3.21973 50.3916 3.21973C49.6179 3.21978 49.048 3.38026 48.6826 3.70215C48.3172 4.0241 48.1348 4.49678 48.1348 5.11914V6.32617H51.5693V9.86719H48.248V23.582H43.54V9.86719H41.1865V6.32617H43.54V4.94141C43.5401 3.81482 43.7284 2.88687 44.1045 2.15723C44.4914 1.42756 45.0983 0.885388 45.9258 0.53125C46.7641 0.177112 47.8664 0 49.2314 0ZM62.79 5.97168C63.048 5.97168 63.2957 5.98831 63.5322 6.02051C63.7685 6.0527 63.9727 6.09579 64.1445 6.14941V10.2861C63.9511 10.2111 63.704 10.1523 63.4033 10.1094C63.1023 10.0558 62.7795 10.0283 62.4355 10.0283C61.6617 10.0283 61.0003 10.179 60.4521 10.4795C59.9043 10.7799 59.4854 11.2197 59.1953 11.7988C58.9051 12.3783 58.7598 13.0868 58.7598 13.9238V23.582H54.0518V6.32617H58.7598V9.33594H58.8564C59.1144 8.27375 59.5818 7.44757 60.2588 6.85742C60.9359 6.26721 61.7798 5.97171 62.79 5.97168ZM72.4639 16.2578C71.5612 16.3115 70.8732 16.5268 70.4004 16.9023C69.9276 17.2672 69.6904 17.7555 69.6904 18.3672V18.3994C69.6905 19.0324 69.9327 19.5317 70.416 19.8965C70.9 20.2505 71.5505 20.4277 72.3672 20.4277C73.0659 20.4277 73.6892 20.2927 74.2373 20.0244C74.7958 19.7454 75.2313 19.3705 75.543 18.8984C75.8652 18.4156 76.0273 17.8733 76.0273 17.2725V16.0293L72.4639 16.2578ZM4.75488 18.835H0V0.175781H4.75488V18.835Z" fill="white"/>
              </svg>
              <h2 className="text-[20px] font-medium text-white/90">
                {mode === 'login' && 'Accedi al tuo account'}
                {mode === 'register' && 'Crea un account'}
                {mode === 'reset' && 'Recupera password'}
              </h2>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}
            
            {message && (
              <div className="mb-6 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm text-center">
                {message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
              {mode === 'register' && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User size={18} className="text-[#858585]" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-[#858585] outline-none focus:border-[#006AFF]/50 focus:bg-white/10 transition-all text-sm"
                  />
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={18} className="text-[#858585]" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Indirizzo email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-[#858585] outline-none focus:border-[#006AFF]/50 focus:bg-white/10 transition-all text-sm"
                />
              </div>

              {mode !== 'reset' && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={18} className="text-[#858585]" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-[#858585] outline-none focus:border-[#006AFF]/50 focus:bg-white/10 transition-all text-sm"
                  />
                </div>
              )}

              {mode === 'login' && (
                <div className="flex justify-end mt-[-8px]">
                  <button type="button" onClick={() => setMode('reset')} className="text-xs text-[#006AFF] hover:text-white transition-colors">
                    Password dimenticata?
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#006AFF] hover:bg-[#0052CC] text-white font-medium py-3 rounded-xl transition-colors mt-2 text-sm shadow-[0_0_20px_rgba(0,106,255,0.3)]"
              >
                {mode === 'login' && 'Accedi'}
                {mode === 'register' && 'Registrati'}
                {mode === 'reset' && 'Invia email'}
              </button>
            </form>

            <div className="relative flex items-center w-full my-8">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/40 text-xs">OPPURE</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button 
              type="button"
              onClick={loginWithGoogle} 
              className="flex items-center justify-center gap-2 px-4 py-3 border border-white/10 rounded-xl bg-gradient-to-b from-white/5 to-transparent hover:border-white/20 hover:bg-white/5 transition-all w-full"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              <span className="text-[14px] font-medium text-white/90">Continua con Google</span>
            </button>

            <div className="mt-8 text-center">
              {mode === 'login' ? (
                <p className="text-sm text-[#858585]">
                  Non hai un account?{' '}
                  <button onClick={() => setMode('register')} className="text-white hover:text-[#006AFF] transition-colors font-medium">
                    Registrati
                  </button>
                </p>
              ) : (
                <button onClick={() => setMode('login')} className="text-sm text-[#858585] flex items-center justify-center gap-1 mx-auto hover:text-white transition-colors">
                  <ArrowLeft size={14} /> Torna al login
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
