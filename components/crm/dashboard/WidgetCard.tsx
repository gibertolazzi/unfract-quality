'use client';

import { Info, ArrowRight } from 'lucide-react';

/**
 * Riquadro del riepilogo.
 *
 * Le `notes` non sono decorazione: la specifica chiede che ogni widget
 * «indichi quando il risultato è parziale o calcolato su dati incompleti».
 * Stanno dentro il riquadro, sotto il numero che riguardano, perché è lì che
 * vengono lette — una nota in fondo alla pagina la legge nessuno.
 */
export function WidgetCard({ title, subtitle, notes, action, children }: {
  title: string;
  subtitle?: string;
  notes?: string[];
  /** Porta alla scheda che contiene i dati per esteso. */
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#1A1A1A] bg-black/20 px-5 py-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-xs font-medium text-white">{title}</h3>
          {subtitle && <p className="text-[11px] text-[#5A5A5A]">{subtitle}</p>}
        </div>

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-[#858585] transition-colors hover:bg-white/5 hover:text-white"
          >
            {action.label}
            <ArrowRight size={10} />
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-2">{children}</div>

      {notes && notes.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-[#131313] pt-2">
          {notes.map((note, index) => (
            <li key={index} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-[#5A5A5A]">
              <Info size={10} className="mt-0.5 shrink-0" />
              {note}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Riquadro di un widget che in questo rilascio non esiste. */
export function MissingWidgetCard({ title, reason }: { title: string; reason: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-[#1A1A1A] px-5 py-4">
      <h3 className="text-xs font-medium text-[#5A5A5A]">{title}</h3>
      <p className="text-[11px] leading-relaxed text-[#3F3F3F]">{reason}</p>
    </section>
  );
}

export function EmptyLine({ text }: { text: string }) {
  return <p className="py-2 text-[11px] text-[#5A5A5A]">{text}</p>;
}
