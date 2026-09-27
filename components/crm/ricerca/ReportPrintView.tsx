'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CrmProspectReport } from './types';
import { REPORT_STATE_LABELS } from './constants';

/**
 * Il report su carta, o in PDF.
 *
 * **Non c'è una libreria PDF**, ed è voluto: il modulo si consegna senza
 * dipendenze nuove, e ogni browser sa già stampare in PDF. Quello che manca in
 * questi casi non è il generatore, è un foglio di stile che tolga di mezzo
 * l'interfaccia — sidebar, filtri, pulsanti — e lasci solo il documento.
 *
 * Il foglio viene aggiunto e tolto insieme al componente, e vale solo per la
 * stampa: a schermo non cambia niente.
 *
 * Una cosa che la stampa **dice più forte** della schermata: se il report è
 * una bozza c'è scritto in cima, in grande. Un foglio stampato gira per
 * l'ufficio senza il suo stato attaccato, e una bozza che sembra un documento
 * finito è esattamente il modo in cui una stima finisce citata a un cliente.
 */

const FOGLIO = `
  @page { margin: 18mm; }
  body > *:not(#crm-report-print) { display: none !important; }
  #crm-report-print {
    display: block !important;
    position: static;
    background: #fff;
    color: #111;
    font: 11pt/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  #crm-report-print h1 { font-size: 17pt; margin: 0 0 2mm; }
  #crm-report-print h2 { font-size: 12pt; margin: 6mm 0 1.5mm; border-bottom: 0.4pt solid #999; padding-bottom: 1mm; }
  #crm-report-print p, #crm-report-print li { orphans: 3; widows: 3; }
  #crm-report-print section { break-inside: avoid; }
  #crm-report-print .bozza {
    border: 1.2pt solid #B45309; color: #B45309;
    padding: 3mm; margin-bottom: 5mm; font-weight: 600;
  }
  #crm-report-print .meta { color: #555; font-size: 9pt; margin: 0 0 5mm; }
  #crm-report-print .piede { margin-top: 8mm; border-top: 0.4pt solid #999; padding-top: 2mm; color: #555; font-size: 8.5pt; }
`;

interface ReportPrintViewProps {
  report: CrmProspectReport;
  companyName: string;
  /** Chiamata quando la stampa è finita o è stata annullata. */
  onDone: () => void;
}

export function ReportPrintView({ report, companyName, onDone }: ReportPrintViewProps) {
  useEffect(() => {
    const stile = document.createElement('style');
    stile.media = 'print';
    stile.setAttribute('data-crm-report-print', 'true');
    stile.textContent = FOGLIO;
    document.head.appendChild(stile);

    const finita = () => onDone();
    window.addEventListener('afterprint', finita);

    // Un giro di rendering prima di aprire la finestra di stampa: senza,
    // Safari stampa la pagina com'era un istante prima.
    const quando = window.setTimeout(() => window.print(), 60);

    return () => {
      window.clearTimeout(quando);
      window.removeEventListener('afterprint', finita);
      stile.remove();
    };
  }, [onDone]);

  if (typeof document === 'undefined') return null;

  const quando = report.approvedAt || '';

  return createPortal(
    <div id="crm-report-print" className="hidden">
      {report.state !== 'APPROVED' && (
        <p className="bozza">
          {REPORT_STATE_LABELS[report.state].toUpperCase()} — non approvata. Non usare con un cliente.
        </p>
      )}

      <h1>{report.title || companyName}</h1>
      <p className="meta">
        {companyName}
        {quando && ` · approvato il ${new Date(quando).toLocaleDateString('it-IT')}`}
        {report.model
          ? ` · due sezioni scritte da ${report.model}, le altre composte dai dati raccolti`
          : ' · composto dai dati raccolti, senza AI'}
      </p>

      {report.sections.map(sezione => (
        <section key={sezione.key}>
          <h2>{sezione.title}</h2>
          <Paragrafi testo={sezione.body} style={{ margin: '0 0 1.5mm' }} />
        </section>
      ))}

      <p className="piede">
        Le stime di questo documento sono dedotte, non verificate: il capitolo «Cosa non dire»
        elenca cosa non va citato come un fatto. Ogni dato della scheda porta la propria fonte e
        la propria data.
      </p>
    </div>,
    document.body
  );
}
