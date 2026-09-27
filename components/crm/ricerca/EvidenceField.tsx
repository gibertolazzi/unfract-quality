'use client';

import { ShieldCheck, Globe, Sparkles, MinusCircle } from 'lucide-react';
import {
  EvidenceLevel, EVIDENCE_LABELS, EVIDENCE_HINTS, EVIDENCE_COLORS,
  ConfidenceLevel, CONFIDENCE_LABELS,
} from './constants';
import { Evidenced, Estimated } from './types';

/**
 * Come si mostra un dato con la sua provenienza attaccata.
 *
 * È il pezzo centrale di tutta la sezione, e il motivo è quello scritto nel
 * piano al §1: un competitor stimato mostrato con la stessa faccia della
 * ragione sociale ufficiale fa perdere fiducia allo strumento, perché chi
 * legge non sa più cosa può ripetere al telefono senza fare figuracce.
 *
 * Quindi i tre livelli **si vedono senza doverli cercare**: colore, icona e
 * parola, sulla riga stessa del dato. Niente da aprire, niente su cui passare
 * il mouse — un tooltip lo legge chi ha già il dubbio, e il problema è
 * esattamente chi il dubbio non ce l'ha.
 *
 * E un dato che manca **non è una riga vuota**: è la sua spiegazione. «Non
 * dichiarato dall'azienda» e «il sito ha rifiutato la connessione» portano a
 * due decisioni diverse, e uno spazio bianco le confonde in una sola.
 */

const ICONE: Record<EvidenceLevel, any> = {
  certain: ShieldCheck,
  declared: Globe,
  estimated: Sparkles,
};

export function EvidenceBadge({ level, compact }: { level: EvidenceLevel; compact?: boolean }) {
  const Icon = ICONE[level];
  const colore = EVIDENCE_COLORS[level];

  return (
    <span
      title={EVIDENCE_HINTS[level]}
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ color: colore, backgroundColor: `${colore}1A` }}
    >
      <Icon size={11} />
      {!compact && EVIDENCE_LABELS[level]}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const toni: Record<ConfidenceLevel, string> = {
    high: 'text-[#C4C4C4]',
    medium: 'text-[#858585]',
    low: 'text-[#3F3F3F]',
  };
  return <span className={`text-[10px] ${toni[level]}`}>{CONFIDENCE_LABELS[level]}</span>;
}

function haValore(campo: Evidenced<any>): boolean {
  if (!campo || campo.value === null || campo.value === undefined) return false;
  if (typeof campo.value === 'string') return campo.value.trim() !== '';
  if (Array.isArray(campo.value)) return campo.value.length > 0;
  return true;
}

/** Il valore in una riga: le liste diventano un elenco, i booleani una parola. */
function Valore({ campo }: { campo: Evidenced<any> }) {
  const v = campo.value;

  if (typeof v === 'boolean') {
    return (
      <span className={v ? 'text-[#10B981]' : 'text-[#EF4444]'}>
        {v ? 'Confermata' : 'Non risulta'}
      </span>
    );
  }

  if (Array.isArray(v)) {
    return (
      <span className="flex flex-wrap gap-1">
        {v.map((voce, i) => (
          <span key={i} className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-[#C4C4C4]">
            {typeof voce === 'string' ? voce : voce?.name || voce?.value || voce?.network || '—'}
          </span>
        ))}
      </span>
    );
  }

  // Il cliente-tipo è un oggetto, non una stringa. Senza questo ramo la
  // scheda mostrava «[object Object]» al posto della stima: il genere di cosa
  // che si vede solo guardando la pagina, non leggendo il codice.
  if (v && typeof v === 'object') {
    const settori: string[] = Array.isArray(v.sectors) ? v.sectors : [];
    return (
      <span className="block">
        {settori.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {settori.map((settore: string) => (
              <span key={settore} className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-[#C4C4C4]">
                {settore}
              </span>
            ))}
          </span>
        )}
        {v.rationale && <span className="mt-1 block text-[11px] text-[#858585]">{v.rationale}</span>}
      </span>
    );
  }

  return <span className="text-white">{String(v)}</span>;
}

/**
 * I segnali di una stima, scritti in modo che si leggano.
 *
 * Arrivano in due forme: parole singole — «climatizzazione», «impianti» — e
 * frasi intere, come quelle dei competitor. Messe nella stessa riga separate
 * da virgole, le frasi producono punti doppi e si leggono male. Quindi: le
 * parole in fila, le frasi in elenco.
 */
function Segnali({ signals }: { signals: string[] }) {
  const sonoFrasi = signals.some(s => s.trim().endsWith('.') || s.length > 40);

  if (sonoFrasi) {
    return (
      <ul className="mt-1 space-y-0.5">
        {signals.map((segnale, i) => (
          <li key={i} className="text-[10px] text-[#F59E0B]">— {segnale.replace(/\.$/, '')}</li>
        ))}
      </ul>
    );
  }

  return (
    <p className="mt-1 text-[10px] text-[#F59E0B]">
      Ci portano: {signals.map(s => s.replace(/\.$/, '')).join(', ')}.
    </p>
  );
}

interface EvidenceFieldProps {
  label: string;
  field: Evidenced<any> | Estimated<any> | undefined;
  /** Fonti per id, per scrivere da dove viene invece dell'id nudo. */
  sourceLabel?: (sourceId: string) => string;
}

export function EvidenceField({ label, field, sourceLabel }: EvidenceFieldProps) {
  if (!field) return null;

  const presente = haValore(field);
  const segnali = (field as Estimated<any>).signals;
  const confidenza = (field as Estimated<any>).confidence;

  return (
    <div className="border-b border-[#131313] py-2 last:border-b-0">
      {/*
        Su uno schermo stretto l'etichetta da 128 punti più il contrassegno
        lasciavano al valore poco più di cento punti: un indirizzo ci passava
        come un nastro. Sotto i 640 punti etichetta e contrassegno stanno sulla
        stessa riga e il valore va a capo, largo quanto la scheda.
      */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="text-[11px] text-[#858585] sm:w-32 sm:shrink-0 sm:pt-0.5">{label}</span>

        <span className="ml-auto flex shrink-0 flex-col items-end gap-1 sm:order-3 sm:ml-0">
          <EvidenceBadge level={field.evidence} compact />
          {presente && confidenza && <ConfidenceBadge level={confidenza} />}
        </span>

        <div className="w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1">
          {presente
            ? <Valore campo={field} />
            // Il campo vuoto porta scritto perché: è la differenza fra «non
            // esiste» e «non siamo riusciti a leggerlo».
            : <span className="flex items-start gap-1.5 text-[11px] italic text-[#3F3F3F]">
                <MinusCircle size={12} className="mt-0.5 shrink-0" />
                {field.note || 'Non raccolto.'}
              </span>}

          {presente && field.note && (
            <p className="mt-1 text-[10px] text-[#585858]">{field.note}</p>
          )}

          {presente && Array.isArray(segnali) && segnali.length > 0 && (
            // Una stima senza il suo metodo è un'opinione con l'aria di un
            // dato: i segnali stanno accanto al valore, non altrove.
            <Segnali signals={segnali} />
          )}

          {presente && (field.at || field.sourceId) && (
            <p className="mt-1 text-[10px] text-[#3F3F3F]">
              {sourceLabel && field.sourceId ? sourceLabel(field.sourceId) : ''}
              {field.at && ` ${new Date(field.at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** La legenda dei tre livelli, in testa alla scheda. Si legge una volta sola. */
export function EvidenceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] px-3 py-2">
      {(['certain', 'declared', 'estimated'] as EvidenceLevel[]).map(level => (
        <span key={level} className="flex items-center gap-1.5">
          <EvidenceBadge level={level} />
          <span className="text-[10px] text-[#585858]">{EVIDENCE_HINTS[level]}</span>
        </span>
      ))}
    </div>
  );
}
