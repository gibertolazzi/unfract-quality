'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { CrmAccount } from '@/components/crm/types';
import { inputClass } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export interface AccountFormValues {
  legalName: string;
  displayName: string;
  website: string;
  vatNumber: string;
  taxCode: string;
  industry: string;
  sizeRange: string;
  address: string;
  city: string;
  postalCode: string;
  region: string;
  country: string;
  linkedinUrl: string;
  notes: string;
}

interface AccountFormModalProps {
  open: boolean;
  /** Assente = creazione. */
  account?: CrmAccount | null;
  industries: string[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => void;
}

/** Fasce dipendenti: le stesse che usano i registri, non numeri liberi. */
const SIZE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];

function Field({ label, children, hint, wide }: {
  label: string; children: React.ReactNode; hint?: string; wide?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-[#3F3F3F]">{hint}</span>}
    </label>
  );
}

export function AccountFormModal({
  open, account, industries, saving, onClose, onSubmit,
}: AccountFormModalProps) {
  const { t } = useTranslation();
  useCloseOnEscape(onClose, !saving);

  const [values, setValues] = useState<AccountFormValues>(() => ({
    legalName: account?.legalName || '',
    displayName: account?.displayName || '',
    website: account?.website || '',
    vatNumber: account?.vatNumber || '',
    taxCode: account?.taxCode || '',
    industry: account?.industry || '',
    sizeRange: account?.sizeRange || '',
    address: account?.address || '',
    city: account?.city || '',
    postalCode: account?.postalCode || '',
    region: account?.region || '',
    country: account?.country || 'IT',
    linkedinUrl: account?.linkedinUrl || '',
    notes: account?.notes || '',
  }));
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<AccountFormValues>) => setValues(v => ({ ...v, ...patch }));

  const submit = () => {
    if (!values.legalName.trim() && !values.displayName.trim()) {
      setError(t.crm.errAccountName);
      return;
    }
    setError('');
    onSubmit({
      ...values,
      legalName: values.legalName.trim() || values.displayName.trim(),
      displayName: values.displayName.trim() || values.legalName.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <h2 className="text-sm font-medium text-white">{account ? t.crm.editAccount : t.crm.createAccount}</h2>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label={t.crm.legalName}>
            <input value={values.legalName} onChange={e => set({ legalName: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.displayName} hint={t.crm.displayNameHint}>
            <input value={values.displayName} onChange={e => set({ displayName: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.website} hint="Da qui si ricava il dominio, chiave per i duplicati">
            <input value={values.website} onChange={e => set({ website: e.target.value })} placeholder="esempio.it" className={inputClass} />
          </Field>
          <Field label={t.crm.linkedin}>
            <input value={values.linkedinUrl} onChange={e => set({ linkedinUrl: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.vatNumber}>
            <input value={values.vatNumber} onChange={e => set({ vatNumber: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.taxId}>
            <input value={values.taxCode} onChange={e => set({ taxCode: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.industry}>
            <input
              value={values.industry}
              onChange={e => set({ industry: e.target.value })}
              list="crm-industries"
              className={inputClass}
            />
            <datalist id="crm-industries">
              {industries.map(industry => <option key={industry} value={industry} />)}
            </datalist>
          </Field>
          <Field label={t.crm.employees}>
            <select value={values.sizeRange} onChange={e => set({ sizeRange: e.target.value })} className={inputClass}>
              <option value="">Non indicato</option>
              {SIZE_RANGES.map(range => <option key={range} value={range}>{range}</option>)}
            </select>
          </Field>

          <Field label={t.crm.address} wide>
            <input value={values.address} onChange={e => set({ address: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.city}>
            <input value={values.city} onChange={e => set({ city: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.zipCode}>
            <input value={values.postalCode} onChange={e => set({ postalCode: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.province}>
            <input value={values.region} onChange={e => set({ region: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.country}>
            <input value={values.country} onChange={e => set({ country: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.notes} wide>
            <textarea
              value={values.notes}
              onChange={e => set({ notes: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </Field>

          {error && <p className="text-xs text-[#EF4444] sm:col-span-2">{error}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#1A1A1A] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-[#858585] hover:text-white">
            Annulla
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : account ? t.crm.save : t.crm.createAccount}
          </button>
        </footer>
      </div>
    </div>
  );
}
