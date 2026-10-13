'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, Loader2, CheckCircle2 } from 'lucide-react';

interface ReportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentLocation?: string; // URL, ID o titolo del contenuto
}

export function ReportContentModal({ isOpen, onClose, contentLocation = '' }: ReportContentModalProps) {
  const [location, setLocation] = useState(contentLocation);
  const [category, setCategory] = useState('copyright');
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!goodFaith) {
      setError('Devi confermare la dichiarazione di buona fede per procedere.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/dsa/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentLocation: location,
          category,
          reason,
          claimantName: name,
          claimantEmail: email,
          goodFaithConfirmed: goodFaith,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore durante l’invio della segnalazione.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Errore imprevisto.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-[#060608]/90 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
      <div className="relative bg-[#111111] border border-white/10 rounded-2xl w-full max-w-lg p-6 sm:p-8 shadow-2xl text-white">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-full hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>

        {success ? (
          <div className="flex flex-col items-center text-center py-6">
            <CheckCircle2 size={48} className="text-[#00FF38] mb-4" />
            <h2 className="text-xl font-semibold mb-2">Segnalazione inviata</h2>
            <p className="text-sm text-[#858585] mb-6 leading-relaxed">
              La segnalazione è stata presa in carico dal nostro team di moderazione ai sensi dell'Art. 16 del Digital Services Act (Regolamento UE 2022/2065). Riceverai una notifica dell'esito all'indirizzo email indicato.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#006AFF] hover:bg-blue-600 rounded-xl text-sm font-medium transition-colors"
            >
              Chiudi
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Segnala contenuto illecito</h2>
                <p className="text-xs text-[#858585]">Procedura Notice-and-Action (Art. 16 Digital Services Act)</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block text-[#A3A3A3] mb-1 font-medium">Contenuto da segnalare (URL, nome o ID)</label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="es. /documentation/progetto-123 o nome file"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 focus:border-[#006AFF] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#A3A3A3] mb-1 font-medium">Motivo della segnalazione</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-white focus:border-[#006AFF] outline-none"
                >
                  <option value="copyright">Violazione di copyright / Diritto d'autore</option>
                  <option value="defamation">Diffamazione o lesione della reputazione</option>
                  <option value="privacy">Violazione della privacy o dati personali non autorizzati</option>
                  <option value="illegal_goods">Materiale illecito o non autorizzato</option>
                  <option value="other">Altro contenuto illecito</option>
                </select>
              </div>

              <div>
                <label className="block text-[#A3A3A3] mb-1 font-medium">Dettagli e spiegazione motivata (min. 10 caratteri)</label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Spiega con precisione perché ritieni che questo contenuto sia illegale o violi i tuoi diritti..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white placeholder:text-white/30 focus:border-[#006AFF] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A3A3A3] mb-1 font-medium">Il tuo nome (o ente)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome e cognome"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 focus:border-[#006AFF] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#A3A3A3] mb-1 font-medium">Email per riscontro</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@dominio.it"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 focus:border-[#006AFF] outline-none"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white/5 border border-white/5 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  required
                  checked={goodFaith}
                  onChange={(e) => setGoodFaith(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded bg-black/40 border-white/20 text-[#006AFF] focus:ring-0 cursor-pointer shrink-0"
                />
                <span className="text-[11px] text-[#858585] leading-snug">
                  Dichiaro in buona fede, ai sensi dell'Art. 16(2)(d) del Regolamento UE 2022/2065, che le informazioni fornite sono esatte e complete.
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 bg-[#006AFF] hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Invia segnalazione DSA'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
