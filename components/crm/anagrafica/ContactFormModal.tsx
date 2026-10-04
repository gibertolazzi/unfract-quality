'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { CrmContact, CrmAccount, CrmConsents } from '@/components/crm/types';
import { inputClass } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export interface ContactFormValues {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  accountId: string;
  isPrimary: boolean;
  preferredChannel: CrmContact['preferredChannel'];
  preferredTime: string;
  linkedinUrl: string;
  notes: string;
  consents: CrmConsents;
}

interface ContactFormModalProps {
  open: boolean;
  contact?: CrmContact | null;
  accounts: CrmAccount[];
  /** Preselezionata quando si crea dalla scheda di un'azienda. */
  defaultAccountId?: string;
  policyVersion: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: ContactFormValues) => void;
}

function emptyConsents(): CrmConsents {
  return {
    email: { granted: false, source: '', policyVersion: '' },
    sms: { granted: false, source: '', policyVersion: '' },
  };
}

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

export function ContactFormModal({
  open, contact, accounts, defaultAccountId, policyVersion, saving, onClose, onSubmit,
}: ContactFormModalProps) {
  const { t } = useTranslation();
  useCloseOnEscape(onClose, !saving);

  const [values, setValues] = useState<ContactFormValues>(() => ({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    role: contact?.role || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    address: contact?.address || '',
    city: contact?.city || '',
    postalCode: contact?.postalCode || '',
    country: contact?.country || '',
    accountId: contact?.accountId || defaultAccountId || '',
    isPrimary: contact?.isPrimary === true,
    preferredChannel: contact?.preferredChannel || '',
    preferredTime: contact?.preferredTime || '',
    linkedinUrl: contact?.linkedinUrl || '',
    notes: contact?.notes || '',
    consents: contact?.consents || emptyConsents(),
  }));
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<ContactFormValues>) => setValues(v => ({ ...v, ...patch }));

  const setConsent = (channel: 'email' | 'sms', granted: boolean) => {
    set({
      consents: {
        ...values.consents,
        [channel]: {
          granted,
          // La fonte dice su quale base il consenso è stato raccolto: senza,
          // il consenso non è dimostrabile.
          source: granted ? 'inserimento manuale' : '',
          policyVersion: granted ? policyVersion : '',
          grantedAt: granted ? new Date().toISOString() : undefined,
        },
      },
    });
  };

  const submit = () => {
    if (!values.firstName.trim() && !values.lastName.trim()) {
      setError(t.crm.errContactLastname);
      return;
    }
    if (!values.email.trim() && !values.phone.trim()) {
      setError('Serve almeno un recapito: email o telefono');
      return;
    }
    setError('');
    onSubmit(values);
  };

  const sortedAccounts = [...accounts]
    .filter(account => !account.archived)
    .sort((a, b) => (a.displayName || a.legalName).localeCompare(b.displayName || b.legalName, 'it'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <h2 className="text-sm font-medium text-white">{contact ? t.crm.editContact : t.crm.createContact}</h2>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label={t.crm.firstName}>
            <input value={values.firstName} onChange={e => set({ firstName: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.lastName}>
            <input value={values.lastName} onChange={e => set({ lastName: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.email}>
            <input value={values.email} onChange={e => set({ email: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.phone}>
            <input value={values.phone} onChange={e => set({ phone: e.target.value })} className={inputClass} />
          </Field>

                    <Field label="Indirizzo (via e numero)">
            <input value={values.address} onChange={e => set({ address: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.city}>
            <input value={values.city} onChange={e => set({ city: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t.crm.zipCode}>
            <input value={values.postalCode} onChange={e => set({ postalCode: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Nazione">
            <input value={values.country} onChange={e => set({ country: e.target.value })} className={inputClass} />
          </Field>

          <Field label={t.crm.role}>
            <input value={values.role} onChange={e => set({ role: e.target.value })} placeholder="es. Responsabile acquisti" className={inputClass} />
          </Field>
          <Field label={t.crm.company}>
            <select value={values.accountId} onChange={e => set({ accountId: e.target.value })} className={inputClass}>
              <option value="">Nessuna</option>
              {sortedAccounts.map(account => (
                <option key={account.id} value={account.id}>{account.displayName || account.legalName}</option>
              ))}
            </select>
          </Field>

          <Field label={t.crm.preferredChannel}>
            <select
              value={values.preferredChannel}
              onChange={e => set({ preferredChannel: e.target.value as ContactFormValues['preferredChannel'] })}
              className={inputClass}
            >
              <option value="">Non indicato</option>
              <option value="email">{t.crm.email}</option>
              <option value="phone">{t.crm.phone}</option>
              <option value="sms">SMS</option>
            </select>
          </Field>
          <Field label={t.crm.preferredTime} hint={t.crm.preferredTimeHint}>
            <input value={values.preferredTime} onChange={e => set({ preferredTime: e.target.value })} placeholder="es. mattina" className={inputClass} />
          </Field>

          <Field label={t.crm.linkedin} wide>
            <input value={values.linkedinUrl} onChange={e => set({ linkedinUrl: e.target.value })} className={inputClass} />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#C4C4C4] sm:col-span-2">
            <input
              type="checkbox"
              checked={values.isPrimary}
              onChange={e => set({ isPrimary: e.target.checked })}
              className="accent-white"
            />
            Contatto principale dell’azienda
          </label>

          <Field label={t.crm.notes} wide>
            <textarea
              value={values.notes}
              onChange={e => set({ notes: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </Field>

          <div className="flex flex-col gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 p-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Consensi</p>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#C4C4C4]">
              <input
                type="checkbox"
                checked={values.consents.email.granted}
                onChange={e => setConsent('email', e.target.checked)}
                className="accent-white"
              />
              Consenso all’invio di email
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-[#C4C4C4]">
              <input
                type="checkbox"
                checked={values.consents.sms.granted}
                onChange={e => setConsent('sms', e.target.checked)}
                className="accent-white"
              />
              Consenso all’invio di SMS
            </label>

            <p className="text-[10px] text-[#3F3F3F]">
              Registrati con la versione {policyVersion} dell’informativa. Gli SMS non partono
              finché non esiste un backend: il consenso si può raccogliere lo stesso.
            </p>
          </div>

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
            {saving ? 'Salvataggio…' : contact ? t.crm.save : t.crm.createContact}
          </button>
        </footer>
      </div>
    </div>
  );
}
