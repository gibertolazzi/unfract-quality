import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export function LoginScreen() {
  const { loginWithGoogle, loading } = useAuth();

  return (
    <div className="fixed inset-0 bg-[#0B0B0B] flex items-center justify-center overflow-hidden z-[100]">
      {/* Background SVGs with animations */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center opacity-70">
        <div className="relative w-full max-w-[1512px] h-[800px] flex items-center justify-center animate-pulse-slow">
          {/* Blue SVG */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float-slow">
            <svg width="1512" height="647" viewBox="0 0 1512 647" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g filter="url(#filter0_f_311_286)">
                <path d="M-410 868H1642.5L1606.5 200L1106.34 542.113C1106.34 542.113 992.005 357.633 880.913 324.377C714.608 274.593 483.432 542.113 483.432 542.113C483.432 542.113 315.391 346.905 178.507 342.084C13.3548 336.269 -178.091 605.073 -178.091 605.073L-381.491 245L-410 868Z" fill="#006AFF" fillOpacity="0.31"/>
              </g>
              <defs>
                <filter id="filter0_f_311_286" x="-610" y="0" width="2452.5" height="1068" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="100" result="effect1_foregroundBlur_311_286"/>
                </filter>
              </defs>
            </svg>
          </div>
          {/* White/Light SVG */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-float-delayed">
            <svg width="1512" height="364" viewBox="0 0 1512 364" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g filter="url(#filter0_f_311_287)">
                <path d="M-410 868H1642.5L1606.5 200L1106.34 542.113C1106.34 542.113 992.005 357.633 880.913 324.377C714.608 274.593 483.432 542.113 483.432 542.113C483.432 542.113 315.391 346.905 178.507 342.084C13.3548 336.269 -178.091 605.073 -178.091 605.073L-381.491 245L-410 868Z" fill="white" fillOpacity="0.31"/>
              </g>
              <defs>
                <filter id="filter0_f_311_287" x="-610" y="0" width="2452.5" height="1068" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                  <feGaussianBlur stdDeviation="100" result="effect1_foregroundBlur_311_287"/>
                </filter>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Login Modal */}
      <div className="relative z-10 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[32px] p-12 w-full max-w-[400px] flex flex-col items-center justify-center shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <Loader2 size={32} className="text-[#006AFF] animate-spin mb-4" />
            <p className="text-white/60 font-medium">Caricamento...</p>
          </div>
        ) : (
          <>
            <h1 className="text-[28px] font-semibold text-white tracking-tight text-center leading-tight mb-10 flex flex-col items-center">
              <span>Access to</span>
              <span className="flex items-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-white"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Unfract
              </span>
            </h1>

            <button 
              onClick={loginWithGoogle} 
              className="flex items-center justify-center gap-3 px-6 py-3.5 bg-black/50 border border-white/10 text-white rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all w-full max-w-[280px]"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              <span className="text-[15px] font-semibold">Accedi con Google</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
