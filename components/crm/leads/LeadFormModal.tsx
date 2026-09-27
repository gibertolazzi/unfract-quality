'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { CrmLead, CrmConsents } from '@/components/crm/types';
import { OwnerOption } from './LeadFiltersBar';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export interface LeadFormValues {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  source: string;
  estimatedValue: number;
  ownerUid: string;
  notes: string;
  consents: CrmConsents;
}

interface LeadFormModalProps {
  open: boolean;
  /** Assente = creazione. */
  lead?: CrmLead | null;
  owners: OwnerOption[];
  sources: string[];
  /** Versione dell'informativa in vigore, registrata insieme al consenso. */
  policyVersion: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: LeadFormValues) => void;
}

function emptyConsents(): CrmConsents {
  return {
    email: { granted: false, source: '', policyVersion: '' },
    sms: { granted: false, source: '', policyVersion: '' },
  };
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-[#3F3F3F]">{hint}</span>}
    </label>
  );
}

const inputClass =
  'rounded-lg border border-[#1A1A1A] bg-black/30 px-3 py-2 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none';

export function LeadFormModal({
  open, lead, owners, sources, policyVersion, saving, onClose, onSubmit,
}: LeadFormModalProps) {
  useCloseOnEscape(onClose, !saving);

  const isEdit = !!lead;

  const [values, setValues] = useState<LeadFormValues>(() => ({
    fullName: lead?.fullName || '',
    companyName: lead?.companyName || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    address: lead?.address || '',
    city: lead?.city || '',
    postalCode: lead?.postalCode || '',
    country: lead?.country || '',
    source: lead?.source || '',
    estimatedValue: lead?.estimatedValue || 0,
    ownerUid: lead?.ownerUid || '',
    notes: lead?.notes || '',
    consents: lead?.consents || emptyConsents(),
  }));

  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<LeadFormValues>) => setValues(v => ({ ...v, ...patch }));

  const setConsent = (channel: 'email' | 'sms', granted: boolean) => {
    set({
      consents: {
        ...values.consents,
        [channel]: {
          granted,
          source: granted ? 'form-crm' : '',
          policyVersion: granted ? policyVersion : '',
        },
      },
    });
  };

  const submit = () => {
    if (!values.fullName.trim() && !values.companyName.trim()) {
      setError('Serve almeno il nominativo o l’azienda');
      return;
    }
    if (!values.email.trim() && !values.phone.trim()) {
      setError('Serve almeno un recapito: email o telefono');
      return;
    }
    setError('');
    onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <h2 className="text-sm font-medium text-white">
            {isEdit ? 'Modifica lead' : 'Nuovo lead'}
          </h2>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nominativo">
              <input
                value={values.fullName}
                onChange={e => set({ fullName: e.target.value })}
                placeholder="Mario Rossi"
                className={inputClass}
              />
            </Field>

            <Field label="Azienda">
              <input
                value={values.companyName}
                onChange={e => set({ companyName: e.target.value })}
                placeholder="Acme S.r.l."
                className={inputClass}
              />
            </Field>

            <Field label="Email" hint="Usata anche per rilevare i duplicati">
              <input
                type="email"
                value={values.email}
                onChange={e => set({ email: e.target.value })}
                placeholder="mario.rossi@acme.it"
                className={inputClass}
              />
            </Field>

            <Field label="Telefono">
              <input
                value={values.phone}
                onChange={e => set({ phone: e.target.value })}
                placeholder="+39 02 1234567"
                className={inputClass}
              />
            </Field>

                        <Field label="Indirizzo (via e numero)">
              <input value={values.address} onChange={e => set({ address: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Città">
              <input value={values.city} onChange={e => set({ city: e.target.value })} className={inputClass} />
            </Field>
            <Field label="CAP">
              <input value={values.postalCode} onChange={e => set({ postalCode: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Nazione">
              <input value={values.country} onChange={e => set({ country: e.target.value })} className={inputClass} />
            </Field>

            <Field label="Fonte">
              <input
                list="crm-lead-sources"
                value={values.source}
                onChange={e => set({ source: e.target.value })}
                placeholder="Sito, fiera, passaparola…"
                className={inputClass}
              />
              <datalist id="crm-lead-sources">
                {sources.map(s => <option key={s} value={s} />)}
              </datalist>
            </Field>

            <Field label="Valore stimato (€)">
              <input
                type="number"
                min={0}
                value={values.estimatedValue || ''}
                onChange={e => set({ estimatedValue: Number(e.target.value) || 0 })}
                placeholder="0"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Owner">
            <select
              value={values.ownerUid}
              onChange={e => set({ ownerUid: e.target.value })}
              className={inputClass}
            >
              <option value="">Non assegnato</option>
              {owners.map(o => <option key={o.uid} value={o.uid}>{o.name}</option>)}
            </select>
          </Field>

          <Field label="Note">
            <textarea
              value={values.notes}
              onChange={e => set({ notes: e.target.value })}
              rows={3}
              placeholder="Contesto, esigenze, prossimi passi…"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <div className="flex flex-col gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Consensi</p>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#C4C4C4]">
              <input
                type="checkbox"
                checked={values.consents.email.granted}
                onChange={e => setConsent('email', e.target.checked)}
                className="accent-white"
              />
              Consenso all&apos;invio di email
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#C4C4C4]">
              <input
                type="checkbox"
                checked={values.consents.sms.granted}
                onChange={e => setConsent('sms', e.target.checked)}
                className="accent-white"
              />
              Consenso all&apos;invio di SMS
            </label>

            <p className="text-[10px] text-[#3F3F3F]">
              Viene registrata la versione dell&apos;informativa in vigore ({policyVersion || 'non impostata'})
              insieme alla data e alla fonte del consenso.
            </p>
          </div>

          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#1A1A1A] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs text-[#858585] hover:text-white"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : isEdit ? 'Salva modifiche' : 'Crea lead'}
          </button>
        </footer>
      </div>
    </div>
  );
}
