import { useState } from 'react';
import { useCrm } from '@/contexts/CrmContext';
import { useToast } from '@/contexts/ToastContext';
import { FollowupSection } from '@/components/crm/followup/FollowupSection';
import { FollowupFormModal, FollowupFormValues } from '@/components/crm/followup/FollowupFormModal';
import { CrmLead, CrmCustomer, CrmAccount, CrmOpportunity } from '@/components/crm/types';
import { OwnerOption } from '@/components/crm/leads/LeadFiltersBar';
import { createFollowup, updateFollowup, changeFollowupState, archiveFollowup, deleteFollowup } from '@/lib/crm/followups';
import { FollowupView } from '@/lib/crm/followupFilters';

export interface CrmFollowupsPageProps {
  followups: any[];
  leads: CrmLead[];
  customers: CrmCustomer[];
  accounts: CrmAccount[];
  opportunities: CrmOpportunity[];
  owners: OwnerOption[];
  currentUid: string;
  loading: boolean;
  followupView?: FollowupView;
  createModal: 'followup' | null;
  onCloseModal: () => void;
}

export function CrmFollowupsPage({
  followups, leads, customers, accounts, opportunities, owners,
  currentUid, loading, followupView, createModal, onCloseModal,
}: CrmFollowupsPageProps) {
  const { ctx } = useCrm();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  return (
    <>
      <FollowupSection
        key={followupView || 'default'}
        initialView={followupView}
        followups={followups}
        leads={leads}
        customers={customers}
        accounts={accounts}
        opportunities={opportunities}
        owners={owners}
        currentUid={currentUid}
        loading={loading}
        onCreate={async values => {
          if (!ctx) return;
          const id = await createFollowup(ctx, values);
          if (id) toast.success('Follow-up creato');
          else toast.error('Creazione del follow-up non riuscita');
        }}
        onUpdate={(id, values) => updateFollowup(ctx!, id, values)}
        onChangeState={async (followup, next) => {
          if (!ctx) return;
          await changeFollowupState(ctx, followup.id, next);
          toast.success('Stato aggiornato');
        }}
        onArchive={followup => { archiveFollowup(ctx!, followup.id); toast.info('Follow-up archiviato'); }}
        onDelete={ids => { Promise.all(ids.map(id => deleteFollowup(ctx!, id))); toast.info(ids.length > 1 ? `${ids.length} follow-up eliminati` : 'Follow-up eliminato'); }}
      />

      {createModal === 'followup' && (
        <FollowupFormModal
          open
          followup={null}
          owners={owners}
          leads={leads}
          customers={customers}
          accounts={accounts}
          opportunities={opportunities}
          defaultAssigneeUid={currentUid}
          saving={saving}
          onClose={onCloseModal}
          onSubmit={async (values: FollowupFormValues) => {
            if (ctx) {
              setSaving(true);
              try {
                await createFollowup(ctx, values);
                onCloseModal();
                toast.success('Follow-up creato');
              } finally {
                setSaving(false);
              }
            }
          }}
        />
      )}
    </>
  );
}
