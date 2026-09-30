'use client';

import { useState } from 'react';
import { FileText, Check, Archive, Sparkles, Cpu, AlertTriangle, Printer } from 'lucide-react';
import { CrmProspectReport } from './types';
import { REPORT_STATE_LABELS, ReportState } from './constants';
import { formatDate } from '../shared/TableUtils';
import { ReportPrintView } from "./ReportPrintView";
import { Paragrafi } from "./TextHelpers";

/**
 * I report di una scheda.
 *
 * Due cose si vedono sempre, e sono le due che contano:
 *
 * - **lo stato**, perché un report in bozza non si manda a nessuno. Da
 *   `APPROVED` non si torna indietro: si scrive una versione nuova, così resta
 *   traccia di cosa era stato approvato e da chi;
 * - **chi ha scritto cosa.** Le due sezioni discorsive possono venire da un
 *   modello; le altre quattro no. Chi approva deve sapere quale parte sta
 *   avallando, e il modello è dichiarato per nome.
 *
 * «Cosa non dire» è aperta di default. È la sezione che giustifica tutte le
 * altre, e se si apre richiudendola nessuno la legge.
 */

const COLORI: Record<ReportState, string> = {
  DRAFT: 'text-[#F59E0B]',
  APPROVED: 'text-[#10B981]',
  ARCHIVED: 'text-[#585858]',
};

interface ReportPanelProps {
  reports: CrmProspectReport[];
  /** Serve solo alla stampa, che non ha la scheda accanto per dire di chi parla. */
  companyName?: string;
  onApprove: (reportId: string) => void;
  onArchive: (reportId: string) => void;
  ownerName: (uid: string) => string;
  busy?: boolean;
}

export function ReportPanel({ reports, companyName = '', onApprove, onArchive, ownerName, busy }: ReportPanelProps) {
  const [aperto, setAperto] = useState<string>(reports[0]?.id || '');
  const [daStampare, setDaStampare] = useState<CrmProspectReport | null>(null);

  if (reports.length === 0) {
    return (
      <p className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-4 text-[11px] text-[#585858]">
        Nessun report per questa azienda. «Scrivi il report» ne compone uno dai dati raccolti; se il
        modello è configurato sul server, riscrive due sezioni su sei.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {daStampare && (
        <ReportPrintView
          report={daStampare}
          companyName={companyName}
          onDone={() => setDaStampare(null)}
        />
      )}

      {reports.map(report => {
        const espanso = aperto === report.id;

        return (
          <article key={report.id} className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F]">
            <header className="flex flex-wrap items-center justify-between gap-2 p-3">
              <button
                type="button"
                onClick={() => setAperto(espanso ? '' : report.id)}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <FileText size={13} className="shrink-0 text-[#585858]" />
                <span className="min-w-0">
                  <span className="block truncate text-xs text-white">{report.title}</span>
                  <span className="text-[10px] text-[#585858]">
                    {formatDate(report.createdAt)} · {ownerName(report.createdBy)}
                    {report.state === 'APPROVED' && report.approvedBy &&
                      ` · approvato da ${ownerName(report.approvedBy)}`}
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px]" title={
                  report.model
                    ? `Due sezioni scritte da ${report.model}; le altre quattro dai dati raccolti.`
                    : 'Composto interamente dai dati raccolti, senza AI.'
                }>
                  {report.model
                    ? <><Cpu size={11} className="text-[#3B82F6]" /><span className="text-[#3B82F6]">{report.model}</span></>
                    : <><Sparkles size={11} className="text-[#585858]" /><span className="text-[#585858]">senza AI</span></>}
                </span>

                <span className={`text-[10px] font-medium ${COLORI[report.state]}`}>
                  {REPORT_STATE_LABELS[report.state]}
                </span>

                <button type="button" onClick={() => setDaStampare(report)} disabled={busy}
                  title="Apre la stampa del browser: da lì si salva in PDF."
                  aria-label="Stampa o salva in PDF"
                  className="text-[#585858] hover:text-white disabled:opacity-30">
                  <Printer size={12} />
                </button>

                {report.state === 'DRAFT' && (
                  <button type="button" onClick={() => onApprove(report.id)} disabled={busy}
                    title="Da approvato non si torna in bozza: si scrive una versione nuova."
                    className="flex items-center gap-1 rounded border border-[#1A1A1A] px-2 py-1 text-[10px] text-[#C4C4C4] hover:bg-white/5 disabled:opacity-30">
                    <Check size={11} /> Approva
                  </button>
                )}
                {report.state !== 'ARCHIVED' && (
                  <button type="button" onClick={() => onArchive(report.id)} disabled={busy}
                    aria-label="Archivia il report"
                    className="text-[#585858] hover:text-white disabled:opacity-30">
                    <Archive size={12} />
                  </button>
                )}
              </div>
            </header>

            {espanso && (
              <div className="space-y-3 border-t border-[#131313] p-3">
                {report.state === 'DRAFT' && (
                  <p className="flex items-center gap-1.5 text-[11px] text-[#F59E0B]">
                    <AlertTriangle size={12} />
                    È una bozza: va letta prima di usarla con un cliente.
                  </p>
                )}

                {report.sections.map(sezione => (
                  <section key={sezione.key}>
                    <h4 className={`mb-1 text-[11px] font-medium ${
                      sezione.key === 'do_not_say' ? 'text-[#F59E0B]' : 'text-white'
                    }`}>
                      {sezione.title}
                    </h4>
                    <Paragrafi
                      testo={sezione.body}
                      className="mb-1 text-[11px] leading-relaxed text-[#C4C4C4] last:mb-0"
                    />
                  </section>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
