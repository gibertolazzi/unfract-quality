'use client';

import { getLeadStateLabel, getOppPhaseLabel, getFollowupStateLabel, getFollowupTypeLabel, getPriorityLabel, getInteractionTypeLabel, getEmailStateLabel, getCustomerStatusLabel } from '@/components/crm/shared/labels';
import { useTranslation } from '@/contexts/TranslationContext';
import { useState } from 'react';
import { X } from 'lucide-react';
import { CrmFollowup, CrmLead, CrmCustomer, CrmAccount, CrmOpportunity } from '@/components/crm/types';
import {
  FollowupType, FOLLOWUP_TYPES,
  Priority, PRIORITIES,
} from '@/components/crm/constants';
import { inputClass } from '../shared/TableUtils';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export interface FollowupFormValues {
  type: FollowupType;
  title: string;
  notes: string;
  assigneeUid: string;
  priority: Priority;
  dueDate: string;
  leadId: string;
  customerId: string;
  opportunityId: string;
}

interface FollowupFormModalProps {
  open: boolean;
  followup?: CrmFollowup | null;
  owners: { uid: string; name: string }[];
  leads: CrmLead[];
  customers: CrmCustomer[];
  accounts: CrmAccount[];
  opportunities: CrmOpportunity[];
  defaultAssigneeUid?: string;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: FollowupFormValues) => void;
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

export function FollowupFormModal({
  open, followup, owners, leads, customers, accounts, opportunities,
  defaultAssigneeUid, saving, onClose, onSubmit,
}: FollowupFormModalProps) {
  const { t } = useTranslation();
  useCloseOnEscape(onClose, !saving);

  const [values, setValues] = useState<FollowupFormValues>(() => ({
    type: followup?.type || 'call',
    title: followup?.title || '',
    notes: followup?.notes || '',
    assigneeUid: followup?.assigneeUid || defaultAssigneeUid || '',
    priority: followup?.priority || 'MEDIUM',
    dueDate: (followup?.dueDate || '').slice(0, 10),
    leadId: followup?.leadId || '',
    customerId: followup?.customerId || '',
    opportunityId: followup?.opportunityId || '',
  }));
  const [error, setError] = useState('');

  if (!open) return null;

  const set = (patch: Partial<FollowupFormValues>) => setValues(v => ({ ...v, ...patch }));

  const accountName = (accountId: string) =>
    accounts.find(a => a.id === accountId)?.displayName || 'Cliente';

  const submit = () => {
    if (!values.title.trim()) {
      setError('Serve un titolo: «richiamare» non dice cosa fare');
      return;
    }
    setError('');
    onSubmit({ ...values, title: values.title.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <h2 className="text-sm font-medium text-white">
            {followup ? 'Modifica follow-up' : 'Nuovo follow-up'}
          </h2>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <Field label={t.crm.whatToDo} wide>
            <input
              value={values.title}
              onChange={e => set({ title: e.target.value })}
              placeholder="es. Richiamare per la proposta rivista"
              className={inputClass}
            />
          </Field>

          <Field label={t.crm.type}>
            <select
              value={values.type}
              onChange={e => set({ type: e.target.value as FollowupType })}
              className={inputClass}
            >
              {FOLLOWUP_TYPES.map(type => (
                <option key={type} value={type}>{getFollowupTypeLabel(type, t)}</option>
              ))}
            </select>
          </Field>

          <Field label="Priorità">
            <select
              value={values.priority}
              onChange={e => set({ priority: e.target.value as Priority })}
              className={inputClass}
            >
              {PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{getPriorityLabel(priority, t)}</option>
              ))}
            </select>
          </Field>

          <Field label={t.crm.dueDate} hint="Si può lasciare vuota: finisce in «senza data»">
            <input
              type="date"
              value={values.dueDate}
              onChange={e => set({ dueDate: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label={t.crm.assignedTo}>
            <select
              value={values.assigneeUid}
              onChange={e => set({ assigneeUid: e.target.value })}
              className={inputClass}
            >
              <option value="">Non assegnato</option>
              {owners.map(owner => <option key={owner.uid} value={owner.uid}>{owner.name}</option>)}
            </select>
          </Field>

          <Field label={t.crm.linkedLead}>
            <select
              value={values.leadId}
              onChange={e => set({ leadId: e.target.value, customerId: e.target.value ? '' : values.customerId })}
              className={inputClass}
            >
              <option value="">Nessuno</option>
              {leads.filter(l => !l.archived).map(lead => (
                <option key={lead.id} value={lead.id}>{lead.fullName || lead.companyName}</option>
              ))}
            </select>
          </Field>

          <Field label={t.crm.linkedCustomer}>
            <select
              value={values.customerId}
              onChange={e => set({ customerId: e.target.value, leadId: e.target.value ? '' : values.leadId })}
              className={inputClass}
            >
              <option value="">Nessuno</option>
              {customers.filter(c => !c.archived).map(customer => (
                <option key={customer.id} value={customer.id}>{accountName(customer.accountId)}</option>
              ))}
            </select>
          </Field>

          <Field label="Opportunità collegata" wide>
            <select
              value={values.opportunityId}
              onChange={e => set({ opportunityId: e.target.value })}
              className={inputClass}
            >
              <option value="">Nessuna</option>
              {opportunities.filter(o => !o.archived).map(opportunity => (
                <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>
              ))}
            </select>
          </Field>

          <Field label="Note" wide>
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
            {saving ? 'Salvataggio…' : followup ? 'Salva' : 'Crea follow-up'}
          </button>
        </footer>
      </div>
    </div>
  );
}
