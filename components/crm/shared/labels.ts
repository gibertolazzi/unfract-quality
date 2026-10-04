import { LeadState, OpportunityPhase, FollowupState, FollowupType, Priority, InteractionType, EmailState } from '../constants';
import { CrmCustomer } from '../types';

export const getLeadStateLabel = (state: LeadState, t: any) => {
  const map: Record<LeadState, string> = {
    NEW: t.crm.leadStateNew,
    TO_CONTACT: t.crm.leadStateToContact,
    CONTACTED: t.crm.leadStateContacted,
    FOLLOWUP: t.crm.leadStateFollowup,
    QUALIFIED: t.crm.leadStateQualified,
    PROPOSAL_SENT: t.crm.leadStateProposalSent,
    NEGOTIATION: t.crm.leadStateNegotiation,
    CONVERTED: t.crm.leadStateConverted,
    LOST: t.crm.leadStateLost,
    NOT_INTERESTED: 'Non interessato',
  };
  return map[state] || state;
};

export const getOppPhaseLabel = (phase: OpportunityPhase, t: any) => {
  const map: Record<OpportunityPhase, string> = {
    QUALIFICATION: t.crm.oppPhaseQualification,
    DISCOVERY: t.crm.oppPhaseDiscovery,
    PROPOSAL: t.crm.oppPhaseProposal,
    NEGOTIATION: t.crm.oppPhaseNegotiation,
    WON: t.crm.oppPhaseWon,
    LOST: t.crm.oppPhaseLost,
  };
  return map[phase] || phase;
};

export const getFollowupStateLabel = (state: FollowupState, t: any) => {
  const map: Record<FollowupState, string> = {
    OPEN: t.crm.followupStateOpen,
    IN_PROGRESS: t.crm.followupStateInProgress,
    DONE: t.crm.followupStateDone,
    SNOOZED: t.crm.followupStateSnoozed,
    CANCELLED: t.crm.followupStateCancelled,
  };
  return map[state] || state;
};

export const getFollowupTypeLabel = (type: FollowupType, t: any) => {
  const map: Record<FollowupType, string> = {
    call: t.crm.followupTypeCall,
    email: t.crm.followupTypeEmail,
    sms: t.crm.followupTypeSms,
    meeting: t.crm.followupTypeMeeting,
    internal: t.crm.followupTypeInternal,
    note: t.crm.followupTypeNote,
  };
  return map[type] || type;
};

export const getPriorityLabel = (priority: Priority, t: any) => {
  const map: Record<Priority, string> = {
    LOW: t.crm.priorityLow,
    MEDIUM: t.crm.priorityMedium,
    HIGH: t.crm.priorityHigh,
    CRITICAL: t.crm.priorityCritical,
  };
  return map[priority] || priority;
};

export const getInteractionTypeLabel = (type: InteractionType, t: any) => {
  const map: Record<InteractionType, string> = {
    call: t.crm.interactionTypeCall,
    email: t.crm.interactionTypeEmail,
    sms: t.crm.interactionTypeSms,
    meeting: t.crm.interactionTypeMeeting,
    note: t.crm.interactionTypeNote,
    activity: t.crm.interactionTypeActivity,
  };
  return map[type] || type;
};

export const getEmailStateLabel = (state: EmailState, t: any) => {
  const map: Record<EmailState, string> = {
    DRAFT: t.crm.emailStateDraft,
    QUEUED: t.crm.emailStateQueued,
    SENT: t.crm.emailStateSent,
    DELIVERED: t.crm.emailStateDelivered,
    BOUNCED: t.crm.emailStateBounced,
    FAILED: t.crm.emailStateFailed,
    CANCELLED: t.crm.emailStateCancelled,
  };
  return map[state] || state;
};

export const getCustomerStatusLabel = (status: CrmCustomer['status'], t: any) => {
  if (status === 'active') return t.crm.statusActive;
  if (status === 'inactive') return t.crm.statusInactive;
  if (status === 'suspended') return t.crm.statusSuspended;
  return status;
};

