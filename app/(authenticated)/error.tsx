'use client';

import React, { useEffect } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled authenticated app error:', error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 mb-4 border border-red-500/20">
        <AlertTriangle size={32} />
      </div>
      <h2 className="text-xl font-bold text-white mb-2 font-halfre">Si è verificato un errore imprevisto</h2>
      <p className="text-sm text-[#858585] max-w-md mb-6 leading-relaxed">
        {error?.message || 'Si è verificato un problema durante il rendering della pagina.'}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 rounded-xl bg-[#006AFF] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0056d6]"
        >
          <RotateCcw size={16} />
          Riprova
        </button>
        <button
          onClick={() => { window.location.href = '/'; }}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Ricarica applicazione
        </button>
      </div>
    </div>
  );
}
