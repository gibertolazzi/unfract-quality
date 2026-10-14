'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useState } from 'react';
import { X, Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CrmLead, CrmConsents, CrmAccount } from '@/components/crm/types';
import { OwnerOption } from './LeadFiltersBar';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';
import { lookupVat, validateItalianVatChecksum, findExistingAccountByVat } from '@/lib/crm/vatService';
import { useProject } from '@/contexts/ProjectContext';

export interface LeadFormValues {
  fullName: string;
  companyName: string;
  vatNumber?: string;
  taxCode?: string;
  vatVerifiedAt?: any;
  vatSource?: 'vies' | 'provider' | 'manual';
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
  const { t } = useTranslation();
  const { activeProjectId } = useProject();
  useCloseOnEscape(onClose, !saving);

  const isEdit = !!lead;

  const [values, setValues] = useState<LeadFormValues>(() => ({
    fullName: lead?.fullName || '',
    companyName: lead?.companyName || '',
    vatNumber: lead?.vatNumber || '',
    taxCode: lead?.taxCode || '',
    vatVerifiedAt: lead?.vatVerifiedAt || null,
    vatSource: lead?.vatSource || 'manual',
    email: lead?.email || '',
    phone: lead?.phone || '',
    address: lead?.address || '',
    city: lead?.city || '',
    postalCode: lead?.postalCode || '',
    country: lead?.country || 'IT',
    source: lead?.source || '',
    estimatedValue: lead?.estimatedValue || 0,
    ownerUid: lead?.ownerUid || '',
    notes: lead?.notes || '',
    consents: lead?.consents || emptyConsents(),
  }));

  const [vatSearching, setVatSearching] = useState(false);
  const [vatMessage, setVatMessage] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const [duplicateAccount, setDuplicateAccount] = useState<CrmAccount | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<LeadFormValues>) => setValues(v => ({ ...v, ...patch }));

  const handleVatLookup = async () => {
    const vat = (values.vatNumber || '').trim();
    if (!vat) {
      setVatMessage({ text: 'Inserisci prima una Partita IVA.', type: 'warn' });
      return;
    }

    setVatMessage(null);
    setDuplicateAccount(null);

    if (values.country === 'IT' || /^\d{11}$/.test(vat.replace(/^IT/i, ''))) {
      if (!validateItalianVatChecksum(vat)) {
        setVatMessage({
          text: 'Non è una partita IVA valida (la cifra di controllo non torna).',
          type: 'error',
        });
        return;
      }
    }

    if (activeProjectId) {
      const existing = await findExistingAccountByVat(activeProjectId, vat);
      if (existing) {
        setDuplicateAccount(existing);
      }
    }

    setVatSearching(true);
    try {
      const resp = await lookupVat(vat, values.country || 'IT');
      if (!resp.ok) {
        setVatMessage({
          text: resp.error || 'Verifica Partita IVA fallita.',
          type: resp.retryable ? 'warn' : 'error',
        });
        return;
      }

      const res = resp.result;
      if (res) {
        setValues(v => ({
          ...v,
          vatNumber: res.vatNumber || v.vatNumber,
          companyName: res.legalName || v.companyName,
          address: res.address || v.address,
          city: res.city || v.city,
          postalCode: res.postalCode || v.postalCode,
          country: res.countryCode || v.country,
          vatVerifiedAt: res.verifiedAt,
          vatSource: res.source,
        }));

        setVatMessage({
          text: 'Dati azienda compilati con successo da VIES.',
          type: 'success',
        });
      }
    } catch {
      setVatMessage({ text: 'Errore durante la verifica.', type: 'error' });
    } finally {
      setVatSearching(false);
    }
  };

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
            {isEdit ? t.crm.editLead : t.crm.createLead}
          </h2>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          {/* Box P.IVA per Lead B2B */}
          <div className="rounded-xl border border-[#222] bg-[#121212]/80 p-3">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[#A0A0A0]">
                Compilazione da Partita IVA (opzionale)
              </span>
              {values.vatVerifiedAt && (
                <span className="flex items-center gap-1 text-[10px] text-[#10B981]">
                  <CheckCircle2 size={11} /> Verificata VIES
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={values.vatNumber || ''}
                onChange={e => {
                  set({ vatNumber: e.target.value });
                  if (vatMessage) setVatMessage(null);
                  if (duplicateAccount) setDuplicateAccount(null);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleVatLookup();
                  }
                }}
                placeholder="Es. 00743110157"
                className={`${inputClass} flex-1 font-mono text-xs`}
              />
              <button
                type="button"
                onClick={handleVatLookup}
                disabled={vatSearching || !values.vatNumber?.trim()}
                className="flex items-center gap-1 rounded-lg border border-[#2A2A2A] bg-white px-3 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {vatSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                <span>{vatSearching ? 'Verifica…' : 'Compila'}</span>
              </button>
            </div>

            {vatMessage && (
              <div
                className={`mt-2 flex items-center gap-1.5 rounded-lg p-2 text-xs ${
                  vatMessage.type === 'success'
                    ? 'border border-[#10B981]/30 bg-[#10B981]/10 text-[#34D399]'
                    : vatMessage.type === 'warn'
                    ? 'border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FBBF24]'
                    : 'border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171]'
                }`}
              >
                {vatMessage.type === 'success' ? (
                  <CheckCircle2 size={13} className="shrink-0" />
                ) : (
                  <AlertTriangle size={13} className="shrink-0" />
                )}
                <span>{vatMessage.text}</span>
              </div>
            )}

            {duplicateAccount && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-2 text-xs text-[#FBBF24]">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  Nel CRM esiste già l&apos;azienda <strong>&laquo;{duplicateAccount.displayName || duplicateAccount.legalName}&raquo;</strong> con questa P.IVA.
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t.crm.name}>
              <input
                value={values.fullName}
                onChange={e => set({ fullName: e.target.value })}
                placeholder={t.crm.namePlaceholder}
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

            <Field label={t.crm.source}>
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
            {saving ? 'Salvataggio…' : isEdit ? t.crm.saveChanges : t.crm.createLeadBtn}
          </button>
        </footer>
      </div>
    </div>
  );
}
