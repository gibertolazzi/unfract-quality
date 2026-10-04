'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useMemo, useState } from 'react';
import { Search, Loader2, Info } from 'lucide-react';
import { recognize, describeRecognition } from '@/lib/crm/prospect/recognize';
import { SEARCH_KIND_LABELS } from "./constants";
import { Formattato } from "./TextHelpers";

/**
 * Un campo solo, e la sezione capisce da sé cosa ci hai scritto.
 *
 * Chiedere con un menù a tendina se stai scrivendo una partita IVA o un nome è
 * il modo più rapido di farlo sbagliare: chi incolla `IT 00743110157` da una
 * email non ha voglia di scegliere anche la categoria.
 *
 * Il riconoscimento si mostra **mentre si scrive**, con scritto cosa
 * succederà. Due motivi, e il secondo conta più del primo: chi ha sbagliato a
 * incollare se ne accorge prima di premere invio; e chi scrive un nome sa
 * *prima* che la ricerca sul web non c'è, invece di scoprirlo dal risultato.
 */

interface SearchBarProps {
  onSearch: (input: string) => void;
  running: boolean;
  /** Vero quando un motore di ricerca è configurato: cambia cosa si promette. */
  webSearchAvailable: boolean;
}

export function SearchBar({ onSearch, running, webSearchAvailable }: SearchBarProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const riconosciuto = useMemo(() => (value.trim() ? recognize(value) : null), [value]);

  const cosaSuccede = useMemo(() => {
    if (!riconosciuto) return '';
    if (!riconosciuto.valid && riconosciuto.kind !== 'name') return riconosciuto.message;

    switch (riconosciuto.kind) {
      case 'vat':
        return 'Si interroga VIES: ragione sociale e sede ufficiali. Gratis.';
      case 'domain':
        return 'Si legge il sito rispettandone il robots.txt, se ne prende la partita IVA e VIES conferma. Gratis.';
      case 'tax_code':
        return 'Un codice fiscale di sedici caratteri è quello di una persona: nessun registro pubblico risponde da lì.';
      case 'name':
      default:
        return webSearchAvailable
          ? 'Si cerca fra le aziende già in archivio e sul web.'
          : 'Si cerca **solo fra le aziende già in archivio**: la ricerca sul web richiede la chiave di un motore, che non è configurata.';
    }
  }, [riconosciuto, webSearchAvailable]);

  const cercabile = Boolean(
    riconosciuto && (riconosciuto.kind === 'name' || riconosciuto.valid) && riconosciuto.kind !== 'tax_code'
  );

  return (
    <div className="space-y-2">
      <form
        onSubmit={event => {
          event.preventDefault();
          if (!cercabile || running) return;
          onSearch(value.trim());
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3F3F3F]" />
          <input
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder="Partita IVA, indirizzo del sito, o nome dell’azienda"
            aria-label="Cerca un’azienda"
            className="w-full rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#3F3F3F] focus:border-[#2A2A2A] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={!cercabile || running}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {running ? 'Cerco…' : 'Cerca'}
        </button>
      </form>

      {riconosciuto && (
        <p className="flex items-start gap-1.5 text-[11px] text-[#858585]">
          <Info size={12} className="mt-0.5 shrink-0 text-[#3F3F3F]" />
          <span>
            <span className="text-[#C4C4C4]">{SEARCH_KIND_LABELS[riconosciuto.kind]}</span>
            {' — '}
            {/* Il grassetto arriva come `**…**`: si rende, non si mostra com'è scritto. */}
            <Formattato testo={cosaSuccede} />
          </span>
        </p>
      )}

      {riconosciuto && !riconosciuto.valid && riconosciuto.kind !== 'name' && (
        <p className="text-[11px] text-[#EF4444]">{describeRecognition(riconosciuto)}</p>
      )}
    </div>
  );
}
