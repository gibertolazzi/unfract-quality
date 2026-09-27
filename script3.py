import os

constants_file = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/constants.ts'
with open(constants_file, 'r') as f:
    content = f.read()

# Replace the import we added with an export
import_stmt = """import {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
} from '@/types/crm';"""

export_stmt = """export type {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
} from '@/types/crm';"""

content = content.replace(import_stmt, export_stmt)

with open(constants_file, 'w') as f:
    f.write(content)
