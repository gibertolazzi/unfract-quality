'use client';

import React from 'react';
import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0B0B0B] p-6 text-white text-center font-sans">
      <div className="relative mb-6">
        <span className="text-8xl md:text-9xl font-bold font-halfre tracking-wider text-white/10 select-none">
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl md:text-3xl font-bold font-halfre text-[#006AFF]">
            Non trovata
          </span>
        </div>
      </div>

      <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 font-halfre">
        Pagina non trovata
      </h1>
      <p className="text-sm md:text-base text-[#858585] max-w-md mb-8 leading-relaxed">
        L’indirizzo specificato non esiste, oppure l’elemento a cui stai tentando di accedere è stato eliminato o spostato.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl bg-[#006AFF] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0056d6]"
        >
          <Home size={16} />
          Torna alla Dashboard
        </Link>
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          <ArrowLeft size={16} />
          Pagina precedente
        </button>
      </div>
    </div>
  );
}
