'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useMemo, useState } from 'react';
import { X, Eye, Send, AlertTriangle, ShieldAlert, Check, MailX } from 'lucide-react';
import {
  EmailTemplate, BUILTIN_TEMPLATES, TemplateContext, VARIABLE_LABELS,
  extractVariables, render, buildValues, optOutFooter, toHtml,
} from '@/lib/crm/emailTemplates';
import { EmailEligibility, SendEmailResult } from '@/lib/crm/emailSend';
import { inputClass } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
  templateId: string;
  templateVars: Record<string, string>;
}

interface EmailComposerProps {
  open: boolean;
  /** Destinatario già risolto: nome e indirizzo. */
  toName: string;
  toEmail: string;
  /** Esito del controllo consenso/soppressione, fatto da chi apre. */
  eligibility: EmailEligibility;
  /** Valori disponibili per le variabili del template. */
  context: TemplateContext;
  /** Indirizzo a cui arrivano le richieste di revoca del consenso. */
  optOutAddress: string;
  /** Riferimento del destinatario, scritto nel piè di pagina. */
  optOutReference: string;
  sending?: boolean;
  onClose: () => void;
  onSend: (email: ComposedEmail) => Promise<SendEmailResult>;
}

/**
 * Composizione di un'email: template, variabili, anteprima, conferma.
 *
 * Non si spedisce dalla schermata di scrittura: c'è un passaggio di anteprima
 * in mezzo, con il testo esattamente come arriverà. La specifica chiede
 * «anteprima e conferma», e serve: le variabili non sostituite si vedono solo
 * guardando il testo finito.
 */
export function EmailComposer({
  open, toName, toEmail, eligibility, context, optOutAddress, optOutReference,
  sending, onClose, onSend,
}: EmailComposerProps) {
  const { t } = useTranslation();
  useCloseOnEscape(onClose, !sending);

  const [template, setTemplate] = useState<EmailTemplate>(BUILTIN_TEMPLATES[0]);
  const [subject, setSubject] = useState(BUILTIN_TEMPLATES[0].subject);
  const [body, setBody] = useState(BUILTIN_TEMPLATES[0].body);
  const [values, setValues] = useState<Record<string, string>>(() => buildValues(context));
  const [preview, setPreview] = useState(false);
  const [result, setResult] = useState<SendEmailResult | null>(null);

  const variables = useMemo(() => extractVariables(subject, body), [subject, body]);

  const rendered = useMemo(() => {
    const subjectResult = render(subject, values);
    const bodyResult = render(body, values);
    const missing = Array.from(new Set([...subjectResult.missing, ...bodyResult.missing]));
    const footer = optOutFooter({ address: optOutAddress, reference: optOutReference });
    return {
      subject: subjectResult.text,
      text: `${bodyResult.text}${footer}`,
      missing,
    };
  }, [subject, body, values, optOutAddress, optOutReference]);

  if (!open) return null;

  const pickTemplate = (next: EmailTemplate) => {
    setTemplate(next);
    setSubject(next.subject);
    setBody(next.body);
  };

  const blocked = !eligibility.allowed;
  const ready = !blocked && rendered.missing.length === 0 && subject.trim() && body.trim();

  const send = async () => {
    const outcome = await onSend({
      subject: rendered.subject,
      text: rendered.text,
      html: toHtml(rendered.text),
      templateId: template.id,
      templateVars: values,
    });
    setResult(outcome);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-medium text-white">
              {result ? 'Esito dell’invio' : preview ? 'Anteprima' : 'Scrivi email'}
            </h2>
            <p className="text-[11px] text-[#5A5A5A]">
              A {toName || toEmail}{toName && ` · ${toEmail}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          {blocked ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2.5">
              <MailX size={14} className="mt-0.5 shrink-0 text-[#EF4444]" />
              <div className="flex flex-col gap-1">
                <p className="text-xs text-[#EF4444]">{eligibility.message}</p>
                <p className="text-[11px] text-[#858585]">
                  {eligibility.reason === 'no-consent'
                    ? 'Il consenso si registra sulla scheda del contatto, con la fonte da cui è stato raccolto.'
                    : eligibility.reason === 'suppressed'
                      ? 'Chi ha chiesto di non essere più contattato resta escluso: è la ragione per cui esiste la lista.'
                      : 'Aggiungi un indirizzo email alla scheda.'}
                </p>
              </div>
            </div>
          ) : result ? (
            <div className="flex flex-col gap-3">
              {result.sent ? (
                <div className="flex items-center gap-3">
                  <Check size={18} className="text-[#10B981]" />
                  <p className="text-sm text-white">
                    {result.duplicate ? 'Già inviata: il doppio invio è stato fermato.' : 'Email inviata'}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#EF4444]" />
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-[#EF4444]">{result.error}</p>
                    <p className="text-[11px] text-[#858585]">
                      La bozza resta registrata come «Fallita», con il motivo: non è andata persa.
                    </p>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-[#5A5A5A]">
                L’email compare nella timeline del destinatario con il suo stato.
              </p>
            </div>
          ) : preview ? (
            <>
              <div className="flex flex-col gap-2 rounded-2xl border border-[#1A1A1A] bg-black/20 p-4">
                <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Oggetto</span>
                <p className="text-sm text-white">{rendered.subject || '(senza oggetto)'}</p>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl border border-[#1A1A1A] bg-black/20 p-4">
                <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Testo</span>
                <p className="whitespace-pre-wrap text-xs text-[#C4C4C4]">{rendered.text}</p>
              </div>

              {rendered.missing.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#F59E0B]" />
                  <p className="text-xs text-[#F59E0B]">
                    Variabili senza valore: {rendered.missing.join(', ')}. Finché restano vuote
                    l’invio è bloccato — anche dal server.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Template</span>
                <div className="flex flex-wrap gap-1">
                  {BUILTIN_TEMPLATES.map(candidate => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => pickTemplate(candidate)}
                      title={candidate.description}
                      className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                        template.id === candidate.id
                          ? 'bg-white/10 font-medium text-white'
                          : 'text-[#858585] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {candidate.name}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-[#3F3F3F]">{template.description}</span>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Oggetto</span>
                <input value={subject} onChange={e => setSubject(e.target.value)} className={inputClass} />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Testo</span>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={12}
                  className={`${inputClass} resize-none font-mono`}
                />
                <span className="text-[10px] text-[#3F3F3F]">
                  Le variabili si scrivono fra doppie graffe, per esempio {'{{nome}}'}.
                </span>
              </label>

              {variables.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 p-3">
                  <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">
                    Variabili · {variables.length}
                  </span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {variables.map(name => (
                      <label key={name} className="flex flex-col gap-1">
                        <span className="text-[10px] text-[#858585]">
                          {VARIABLE_LABELS[name] || name}
                          <span className="ml-1 text-[#3F3F3F]">{`{{${name}}}`}</span>
                        </span>
                        <input
                          value={values[name] || ''}
                          onChange={e => setValues(v => ({ ...v, [name]: e.target.value }))}
                          className={`${inputClass} ${!values[name] ? 'border-[#F59E0B]/40' : ''}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2.5">
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[#858585]" />
                <p className="text-[11px] text-[#858585]">
                  In fondo all’email viene aggiunta la revoca del consenso, con il riferimento
                  del destinatario. Il consenso risulta registrato: l’invio lo annota sul record.
                </p>
              </div>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[#1A1A1A] px-6 py-4">
          <span className="text-[10px] text-[#5A5A5A]">
            {!blocked && !result && (preview
              ? 'Questo è il testo che partirà.'
              : `${variables.length} variabili nel testo`)}
          </span>

          <div className="flex items-center gap-2">
            {blocked || result ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90"
              >
                Chiudi
              </button>
            ) : preview ? (
              <>
                <button
                  type="button"
                  onClick={() => setPreview(false)}
                  disabled={sending}
                  className="rounded-lg px-3 py-2 text-xs text-[#858585] hover:text-white disabled:opacity-50"
                >
                  Torna a scrivere
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={!ready || sending}
                  className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Send size={13} />
                  {sending ? 'Invio…' : 'Invia'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setPreview(true)}
                disabled={!subject.trim() || !body.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Eye size={13} />
                Anteprima
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
