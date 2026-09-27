import os

constants_file = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/constants.ts'
with open(constants_file, 'r') as f:
    content = f.read()

# Fix the import/export issue
wrong_export = """export type {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
} from '@/types/crm';"""

correct_code = """import {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
} from '@/types/crm';

export type {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
};"""

content = content.replace(wrong_export, correct_code)

with open(constants_file, 'w') as f:
    f.write(content)
