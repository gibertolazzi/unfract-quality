'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { CrmCustomer, CrmAccount, CrmContact } from '@/components/crm/types';
import { CUSTOMER_STATUS_LABELS } from '@/lib/crm/anagraficaFilters';
import { inputClass } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export interface CustomerFormValues {
  accountId: string;
  contactIds: string[];
  status: CrmCustomer['status'];
  notes: string;
  privateNotes: string;
  monthlyAmount: number;
  annualAmount: number;
  oneTimeAmount: number;
}

interface CustomerFormModalProps {
  open: boolean;
  customer?: CrmCustomer | null;
  accounts: CrmAccount[];
  contacts: CrmContact[];
  defaultAccountId?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: CustomerFormValues) => void;
}

export function CustomerFormModal({
  open, customer, accounts, contacts, defaultAccountId, saving, onClose, onSubmit,
}: CustomerFormModalProps) {
  useCloseOnEscape(onClose, !saving);

  const [values, setValues] = useState<CustomerFormValues>(() => ({
    accountId: customer?.accountId || defaultAccountId || '',
    contactIds: customer?.contactIds || [],
    status: customer?.status || 'active',
    notes: customer?.notes || '',
    privateNotes: customer?.privateNotes || '',
    monthlyAmount: customer?.monthlyAmount || 0,
    annualAmount: customer?.annualAmount || 0,
    oneTimeAmount: customer?.oneTimeAmount || 0,
  }));
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<CustomerFormValues>) => setValues(v => ({ ...v, ...patch }));

  // I referenti si scelgono fra i contatti dell'azienda selezionata: un cliente
  // con referenti di un'altra azienda sarebbe un errore di inserimento.
  const selectable = contacts.filter(contact => !contact.archived && contact.accountId === values.accountId);

  const toggleContact = (id: string) => {
    set({
      contactIds: values.contactIds.includes(id)
        ? values.contactIds.filter(existing => existing !== id)
        : [...values.contactIds, id],
    });
  };

  const submit = () => {
    if (!values.accountId) {
      setError('Un cliente è sempre legato a un’azienda: selezionala');
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
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <h2 className="text-sm font-medium text-white">{customer ? 'Modifica cliente' : 'Nuovo cliente'}</h2>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Azienda</span>
            <select
              value={values.accountId}
              onChange={e => set({ accountId: e.target.value, contactIds: [] })}
              className={inputClass}
            >
              <option value="">Seleziona</option>
              {sortedAccounts.map(account => (
                <option key={account.id} value={account.id}>{account.displayName || account.legalName}</option>
              ))}
            </select>
            {sortedAccounts.length === 0 && (
              <span className="text-[10px] text-[#F59E0B]">
                Non ci sono aziende: creane una prima, oppure importale da file.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Stato</span>
            <select
              value={values.status}
              onChange={e => set({ status: e.target.value as CrmCustomer['status'] })}
              className={inputClass}
            >
              {(Object.keys(CUSTOMER_STATUS_LABELS) as CrmCustomer['status'][]).map(status => (
                <option key={status} value={status}>{CUSTOMER_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Referenti</span>
            {!values.accountId ? (
              <p className="text-xs text-[#3F3F3F]">Seleziona prima l’azienda.</p>
            ) : selectable.length === 0 ? (
              <p className="text-xs text-[#3F3F3F]">Questa azienda non ha ancora contatti collegati.</p>
            ) : (
              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl border border-[#1A1A1A] bg-black/20 p-2">
                {selectable.map(contact => (
                  <label key={contact.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-[#C4C4C4] hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={values.contactIds.includes(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                      className="accent-white"
                    />
                    {contact.fullName}
                    {contact.role && <span className="text-[10px] text-[#5A5A5A]">{contact.role}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Mensile (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.monthlyAmount || ''}
                onChange={e => set({ monthlyAmount: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Annuale (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.annualAmount || ''}
                onChange={e => set({ annualAmount: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Una tantum (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.oneTimeAmount || ''}
                onChange={e => set({ oneTimeAmount: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Note</span>
            <textarea
              value={values.notes}
              onChange={e => set({ notes: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Note riservate</span>
            <textarea
              value={values.privateNotes}
              onChange={e => set({ privateNotes: e.target.value })}
              rows={2}
              className={`${inputClass} resize-none`}
            />
            <span className="text-[10px] text-[#3F3F3F]">
              Nascoste nella scheda lato progetto. Senza backend è una scelta della UI, non una
              regola imposta: chi legge Firestore le vede. Vedi docs/DEROGHE.md.
            </span>
          </label>

          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
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
            {saving ? 'Salvataggio…' : customer ? 'Salva' : 'Crea cliente'}
          </button>
        </footer>
      </div>
    </div>
  );
}
