'use client';

import React, { useEffect } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled global application error:', error);
  }, [error]);

  return (
    <html lang="it">
      <body className="bg-[#0B0B0B] text-white font-sans antialiased">
        <div className="flex min-h-screen w-full flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mb-4 border border-red-500/20">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 font-halfre">
            Si è verificato un errore
          </h1>
          <p className="text-sm text-[#858585] max-w-md mb-6 leading-relaxed">
            {error?.message || "L'applicazione ha riscontrato un problema imprevisto durante il rendering."}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => reset()}
              className="flex items-center gap-2 rounded-xl bg-[#006AFF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0056d6]"
            >
              <RotateCcw size={16} />
              Riprova
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
            >
              Ricarica applicazione
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
