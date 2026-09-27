'use client';

import { useState } from 'react';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';
import {
  CrmOpportunity, CrmOpportunityItem, CrmCustomer, CrmAccount, CrmLead,
} from '@/components/crm/types';
import { OPPORTUNITY_PHASE_PROBABILITY, OpportunityPhase, OPPORTUNITY_PHASES, OPPORTUNITY_PHASE_LABELS } from '@/components/crm/constants';
import { itemsTotal } from '@/lib/crm/opportunityFilters';
import { inputClass, formatEuro } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export interface OpportunityFormValues {
  title: string;
  description: string;
  customerId: string;
  leadId: string;
  ownerUid: string;
  value: number;
  probability: number | null;
  phase: OpportunityPhase;
  expectedCloseDate: string;
  items: CrmOpportunityItem[];
  notes: string;
}

interface OpportunityFormModalProps {
  open: boolean;
  opportunity?: CrmOpportunity | null;
  customers: CrmCustomer[];
  accounts: CrmAccount[];
  leads: CrmLead[];
  owners: { uid: string; name: string }[];
  /** Controparte preselezionata quando si crea da una scheda. */
  defaultCustomerId?: string;
  defaultLeadId?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: OpportunityFormValues) => void;
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

export function OpportunityFormModal({
  open, opportunity, customers, accounts, leads, owners,
  defaultCustomerId, defaultLeadId, saving, onClose, onSubmit,
}: OpportunityFormModalProps) {
  useCloseOnEscape(onClose, !saving);

  const [values, setValues] = useState<OpportunityFormValues>(() => ({
    title: opportunity?.title || '',
    description: opportunity?.description || '',
    customerId: opportunity?.customerId || defaultCustomerId || '',
    leadId: opportunity?.leadId || defaultLeadId || '',
    ownerUid: opportunity?.ownerUid || '',
    value: opportunity?.value || 0,
    probability: opportunity?.probability ?? null,
    phase: opportunity?.phase || 'QUALIFICATION',
    expectedCloseDate: (opportunity?.expectedCloseDate || '').slice(0, 10),
    items: opportunity?.items || [],
    notes: opportunity?.notes || '',
  }));
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<OpportunityFormValues>) => setValues(v => ({ ...v, ...patch }));

  const computed = values.items.length > 0;
  const total = computed ? itemsTotal(values.items) : values.value;
  const suggested = OPPORTUNITY_PHASE_PROBABILITY[opportunity?.phase || 'QUALIFICATION'];

  const setItem = (index: number, patch: Partial<CrmOpportunityItem>) => {
    set({ items: values.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  };

  const submit = () => {
    if (!values.title.trim()) {
      setError('Serve un titolo');
      return;
    }
    if (!values.customerId && !values.leadId) {
      setError('Un’opportunità sta sempre su un cliente o su un lead: scegline uno');
      return;
    }
    setError('');
    onSubmit({ ...values, title: values.title.trim(), value: total });
  };

  const accountName = (accountId: string) =>
    accounts.find(a => a.id === accountId)?.displayName || 'Cliente';

  const openCustomers = customers.filter(c => !c.archived);
  const openLeads = leads.filter(l => !l.archived && l.state !== 'LOST' && l.state !== 'NOT_INTERESTED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <h2 className="text-sm font-medium text-white">
            {opportunity ? 'Modifica opportunità' : 'Nuova opportunità'}
          </h2>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label="Titolo" wide>
            <input value={values.title} onChange={e => set({ title: e.target.value })} className={inputClass} />
          </Field>

          <Field label="Cliente" hint="Oppure scegli un lead, non entrambi">
            <select
              value={values.customerId}
              onChange={e => set({ customerId: e.target.value, leadId: e.target.value ? '' : values.leadId })}
              className={inputClass}
            >
              <option value="">Nessuno</option>
              {openCustomers.map(customer => (
                <option key={customer.id} value={customer.id}>{accountName(customer.accountId)}</option>
              ))}
            </select>
          </Field>

          <Field label="Lead">
            <select
              value={values.leadId}
              onChange={e => set({ leadId: e.target.value, customerId: e.target.value ? '' : values.customerId })}
              className={inputClass}
            >
              <option value="">Nessuno</option>
              {openLeads.map(lead => (
                <option key={lead.id} value={lead.id}>
                  {lead.fullName || lead.companyName}{lead.companyName && lead.fullName ? ` · ${lead.companyName}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Owner">
            <select value={values.ownerUid} onChange={e => set({ ownerUid: e.target.value })} className={inputClass}>
              <option value="">Non assegnata</option>
              {owners.map(owner => <option key={owner.uid} value={owner.uid}>{owner.name}</option>)}
            </select>
          </Field>

          <Field label="Chiusura prevista">
            <input
              type="date"
              value={values.expectedCloseDate}
              onChange={e => set({ expectedCloseDate: e.target.value })}
              className={inputClass}
            />
          </Field>

          {/* ------------------------------------------------------- voci */}
          <div className="flex flex-col gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 p-3 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Prodotti e servizi</span>
              <button
                type="button"
                onClick={() => set({ items: [...values.items, { name: '', quantity: 1, unitPrice: 0 }] })}
                className="flex items-center gap-1 text-[11px] text-[#858585] hover:text-white"
              >
                <Plus size={11} /> Aggiungi voce
              </button>
            </div>

            {values.items.length === 0 ? (
              <p className="text-[11px] text-[#3F3F3F]">
                Nessuna voce: il valore si scrive a mano qui sotto.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {values.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      value={item.name}
                      onChange={e => setItem(index, { name: e.target.value })}
                      placeholder="Descrizione"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={e => setItem(index, { quantity: Number(e.target.value) })}
                      title="Quantità"
                      className={`${inputClass} w-16 text-right`}
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={e => setItem(index, { unitPrice: Number(e.target.value) })}
                      title="Prezzo unitario"
                      className={`${inputClass} w-24 text-right`}
                    />
                    <span className="w-24 text-right text-xs text-[#858585]">
                      {formatEuro((item.quantity || 0) * (item.unitPrice || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => set({ items: values.items.filter((_, i) => i !== index) })}
                      className="rounded p-1 text-[#3F3F3F] hover:text-[#EF4444]"
                      title="Togli la voce"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field
            label="Valore"
            hint={computed
              ? 'Calcolato dalle voci: per cambiarlo, cambia le voci'
              : 'Scritto a mano: aggiungendo delle voci diventa la loro somma'}
          >
            <input
              type="number"
              min={0}
              value={computed ? total : values.value}
              onChange={e => set({ value: Number(e.target.value) })}
              disabled={computed}
              className={`${inputClass} ${computed ? 'text-[#858585]' : ''}`}
            />
          </Field>

          <Field
            label="Probabilità"
            hint={values.probability === null
              ? `Non impostata: vale ${suggested}%, suggerito dalla fase`
              : 'Impostata a mano: resta anche cambiando fase'}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={values.probability ?? suggested}
                onChange={e => set({ probability: Number(e.target.value) })}
                className={`${inputClass} flex-1`}
              />
              {values.probability !== null && (
                <button
                  type="button"
                  onClick={() => set({ probability: null })}
                  title="Torna alla probabilità suggerita dalla fase"
                  className="rounded-lg border border-[#1A1A1A] p-2 text-[#858585] hover:text-white"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          </Field>

          <Field label="Descrizione" wide>
            <textarea
              value={values.description}
              onChange={e => set({ description: e.target.value })}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Note" wide>
            <textarea
              value={values.notes}
              onChange={e => set({ notes: e.target.value })}
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </Field>

          {error && <p className="text-xs text-[#EF4444] sm:col-span-2">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[#1A1A1A] px-6 py-4">
          <span className="text-[11px] text-[#5A5A5A]">
            Valore {formatEuro(total)} · ponderato {formatEuro(total * ((values.probability ?? suggested) / 100))}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs text-[#858585] hover:text-white">
              Annulla
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Salvataggio…' : opportunity ? 'Salva' : 'Crea opportunità'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
