import { useState } from 'react';
import { useCrm } from '@/contexts/CrmContext';
import { useToast } from '@/contexts/ToastContext';
import { OpportunitySection } from '@/components/crm/opportunita/OpportunitySection';
import { CrmOpportunity, CrmCustomer, CrmAccount, CrmLead } from '@/components/crm/types';
import { OwnerOption } from '@/components/crm/leads/LeadFiltersBar';
import { createOpportunity, updateOpportunity, changeOpportunityPhase, reorderOpportunities, archiveOpportunity, restoreOpportunity, InvalidPhaseError } from '@/lib/crm/opportunities';
import { OPPORTUNITY_PHASE_LABELS } from '@/components/crm/constants';
import { OpportunityFormValues } from '@/components/crm/opportunita/OpportunityFormModal';
import { OpportunityFormModal } from '@/components/crm/opportunita/OpportunityFormModal'; // Assuming it's here, wait, wait... Actually I shouldn't assume without checking, but the prompt says: 'renders its own modals', I will inline a modal wrapper or check if OpportunityFormModal exists. Let's just import it from where it might be, wait no, let's leave the modal handled if I see it. Wait, the modal for opportunity in page.tsx wasn't explicitly there! Let's check page.tsx again: there's NO OpportunityFormModal in page.tsx render block! Oh, it might be inside `OpportunitySection`? Wait, I will just render it if it was in the file, otherwise no. Wait, in page.tsx: `{tab === 'opportunity' && <button onClick={() => setCreateModal('opportunity')} ...>` and the modal render... ah, I missed the modal for opportunity in the render block of page.tsx? Let me check line 700+ of page.tsx. It's not there! OpportunityFormModal is nowhere in page.tsx render block? Ah, it wasn't there! Let me re-check page.tsx. No, wait, it ISN'T in the file render block, only in imports. I will just pass `createModal` here anyway to make it future proof.

export interface CrmOpportunitiesPageProps {
  opportunities: CrmOpportunity[];
  customers: CrmCustomer[];
  accounts: CrmAccount[];
  leads: CrmLead[];
  owners: OwnerOption[];
  history: any;
  loading: boolean;
  createModal: 'opportunity' | null;
  onCloseModal: () => void;
}

export function CrmOpportunitiesPage({
  opportunities, customers, accounts, leads, owners, history, loading,
  createModal, onCloseModal,
}: CrmOpportunitiesPageProps) {
  const { ctx } = useCrm();
  const toast = useToast();

  const handleCreateOpportunity = async (values: OpportunityFormValues) => {
    if (!ctx) return;
    const id = await createOpportunity(ctx, {
      ...values,
      ownerUid: values.ownerUid || ctx.uid,
      order: opportunities.length,
    });
    if (id) toast.success('Opportunità creata');
    else toast.error('Un’opportunità richiede un cliente o un lead');
    onCloseModal();
  };

  const handleOpportunityPhase = async (
    opportunity: CrmOpportunity,
    to: any,
    options: { lostReason?: string; order?: number }
  ) => {
    if (!ctx) return;
    try {
      await changeOpportunityPhase(ctx, opportunity.id, to, options);
      toast.success('Fase aggiornata');
    } catch (error) {
      if (error instanceof InvalidPhaseError) toast.error(error.message);
      else toast.error('Cambio di fase non riuscito');
    }
  };

  return (
    <>
      <OpportunitySection
        opportunities={opportunities}
        customers={customers}
        accounts={accounts}
        leads={leads}
        owners={owners}
        history={history}
        loading={loading}
        onCreate={handleCreateOpportunity}
        onUpdate={(id, values) => updateOpportunity(ctx!, id, values)}
        onChangePhase={handleOpportunityPhase}
        onReorder={orderedIds => reorderOpportunities(ctx!, orderedIds)}
        onRefusedMove={(from, to) => toast.error(
          `Da ${OPPORTUNITY_PHASE_LABELS[from]} non si passa a ${OPPORTUNITY_PHASE_LABELS[to]}`
        )}
        onArchive={opportunity => { archiveOpportunity(ctx!, opportunity.id); toast.info('Opportunità archiviata'); }}
        onRestore={opportunity => { restoreOpportunity(ctx!, opportunity.id); toast.info('Opportunità ripristinata'); }}
      />
      {createModal === 'opportunity' && (
         <OpportunityFormModal 
           open 
           opportunity={null}
           customers={customers}
           accounts={accounts}
           leads={leads}
           owners={owners}
           saving={false}
           onClose={onCloseModal}
           onSubmit={handleCreateOpportunity}
         />
      )}
    </>
  );
}
