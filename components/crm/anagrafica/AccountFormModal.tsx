'use client';

import { useState } from 'react';
import { X, Search, Loader2, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import { useTranslation } from '@/contexts/TranslationContext';
import { CrmAccount } from '@/components/crm/types';
import { inputClass } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';
import { lookupVat, validateItalianVatChecksum, findExistingAccountByVat, VatLookupResult } from '@/lib/crm/vatService';
import { useProject } from '@/contexts/ProjectContext';

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
  vatVerifiedAt?: any;
  vatSource?: 'vies' | 'provider' | 'manual';
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
  const { activeProjectId } = useProject();
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
    vatVerifiedAt: account?.vatVerifiedAt || null,
    vatSource: account?.vatSource || 'manual',
  }));

  const [vatSearching, setVatSearching] = useState(false);
  const [vatMessage, setVatMessage] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);
  const [vatWarnings, setVatWarnings] = useState<string[]>([]);
  const [duplicateAccount, setDuplicateAccount] = useState<CrmAccount | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<AccountFormValues>) => setValues(v => ({ ...v, ...patch }));

  const handleVatLookup = async () => {
    const vat = values.vatNumber.trim();
    if (!vat) {
      setVatMessage({ text: 'Inserisci prima una Partita IVA.', type: 'warn' });
      return;
    }

    setVatMessage(null);
    setVatWarnings([]);
    setDuplicateAccount(null);

    // 1. Controllo checksum italiano se paese IT o 11 cifre
    if (values.country === 'IT' || /^\d{11}$/.test(vat.replace(/^IT/i, ''))) {
      if (!validateItalianVatChecksum(vat)) {
        setVatMessage({
          text: 'Non è una partita IVA italiana valida (la cifra di controllo non torna).',
          type: 'error',
        });
        return;
      }
    }

    // 2. Controllo duplicato nel progetto prima della chiamata esterna
    if (activeProjectId) {
      const existing = await findExistingAccountByVat(activeProjectId, vat, account?.id);
      if (existing) {
        setDuplicateAccount(existing);
      }
    }

    // 3. Chiamata al servizio di lookup
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
          legalName: res.legalName || v.legalName,
          displayName: v.displayName || res.displayName || res.legalName,
          address: res.address || v.address,
          city: res.city || v.city,
          postalCode: res.postalCode || v.postalCode,
          region: res.province || v.region,
          country: res.countryCode || v.country,
          vatVerifiedAt: res.verifiedAt,
          vatSource: res.source,
        }));

        setVatWarnings(res.warnings || []);
        setVatMessage({
          text: resp.fromCache
            ? 'Dati recuperati da cache (verificati di recente su VIES UE).'
            : 'Dati ufficiali verificati e compilati con successo da VIES UE.',
          type: 'success',
        });
      }
    } catch {
      setVatMessage({ text: 'Errore imprevisto durante la verifica.', type: 'error' });
    } finally {
      setVatSearching(false);
    }
  };

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
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#858585]" />
            <h2 className="text-sm font-medium text-white">{account ? t.crm.editAccount : t.crm.createAccount}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          {/* Sezione Compilazione da Partita IVA */}
          <div className="rounded-2xl border border-[#222] bg-[#121212]/80 p-4 sm:col-span-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[#A0A0A0]">
                  Compilazione automatica da Partita IVA
                </span>
                {values.vatVerifiedAt && (
                  <span className="flex items-center gap-1 text-[10px] text-[#10B981]">
                    <CheckCircle2 size={12} /> Verificata VIES
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={values.vatNumber}
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
                  placeholder="Es. 00743110157 o IT00743110157"
                  className={`${inputClass} flex-1 font-mono`}
                />
                <button
                  type="button"
                  onClick={handleVatLookup}
                  disabled={vatSearching || !values.vatNumber.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-white px-3 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {vatSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  <span>{vatSearching ? 'Verifica…' : 'Cerca e compila'}</span>
                </button>
              </div>

              {vatMessage && (
                <div
                  className={`mt-1 flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                    vatMessage.type === 'success'
                      ? 'border border-[#10B981]/30 bg-[#10B981]/10 text-[#34D399]'
                      : vatMessage.type === 'warn'
                      ? 'border border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FBBF24]'
                      : 'border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171]'
                  }`}
                >
                  {vatMessage.type === 'success' ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  )}
                  <span>{vatMessage.text}</span>
                </div>
              )}

              {duplicateAccount && (
                <div className="mt-1 flex items-start gap-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/15 p-2.5 text-xs text-[#FBBF24]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">Possibile duplicato:</span> Esiste già l&apos;azienda{' '}
                    <strong className="text-white">&laquo;{duplicateAccount.displayName || duplicateAccount.legalName}&raquo;</strong>{' '}
                    con questa Partita IVA nel progetto.
                  </div>
                </div>
              )}

              {vatWarnings.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 text-[11px] text-[#A0A0A0]">
                  {vatWarnings.map((w, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[#F59E0B]">
                      <span>•</span> {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

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
