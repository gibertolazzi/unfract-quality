'use client';

import React, { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('unfract_cookie_consent');
      if (!stored) {
        // Nessuna scelta ancora effettuata: mostra il banner
        setVisible(true);
      } else if (stored === 'granted') {
        // Consenso già prestato in precedenza
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('consent', 'update', {
            analytics_storage: 'granted',
          });
        }
      }
    } catch {
      // localStorage non disponibile o disabilitato
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('unfract_cookie_consent', 'granted');
    } catch {}

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
      });
    }
    setVisible(false);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem('unfract_cookie_consent', 'denied');
    } catch {}

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied',
      });
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-[420px] z-[99999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#121214]/95 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl text-white">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-[#006AFF]/15 text-[#006AFF] rounded-xl shrink-0 mt-0.5">
            <Cookie size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/95">Preferenze Cookie & Privacy</h3>
            <p className="text-xs text-[#858585] mt-1 leading-relaxed">
              Utilizziamo cookie tecnici per l'autenticazione e, previo tuo consenso, statistiche anonime di Google Analytics per comprendere e migliorare l'uso della piattaforma.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={handleDecline}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-white/80 transition-colors"
          >
            Solo necessari
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="px-4 py-2 bg-[#006AFF] hover:bg-[#0052CC] rounded-xl text-xs font-medium text-white shadow-sm transition-colors"
          >
            Accetta analitici
          </button>
        </div>
      </div>
    </div>
  );
}
