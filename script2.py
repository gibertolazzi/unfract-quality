import os
import re
import glob

# Fix components/unfract/crm/constants.ts
constants_file = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/constants.ts'
with open(constants_file, 'r') as f:
    content = f.read()

# Remove the type exports from constants.ts since they are now in @/types/crm
content = re.sub(r'export type LeadState = typeof LEAD_STATES\[number\];\n?', '', content)
content = re.sub(r'export type OpportunityPhase = typeof OPPORTUNITY_PHASES\[number\];\n?', '', content)
content = re.sub(r'export type FollowupState = typeof FOLLOWUP_STATES\[number\];\n?', '', content)
content = re.sub(r'export type FollowupType = typeof FOLLOWUP_TYPES\[number\];\n?', '', content)
content = re.sub(r'export type Priority = typeof PRIORITIES\[number\];\n?', '', content)
content = re.sub(r'export type InteractionType = typeof INTERACTION_TYPES\[number\];\n?', '', content)
content = re.sub(r'export type EmailState = typeof EMAIL_STATES\[number\];\n?', '', content)
content = re.sub(r'export type RecordOrigin = typeof RECORD_ORIGINS\[number\];\n?', '', content)
content = re.sub(r'export type ApprovalState = typeof APPROVAL_STATES\[number\];\n?', '', content)
content = re.sub(r'export type VisibilityLevel = typeof VISIBILITY_LEVELS\[number\];\n?', '', content)

# Prepend the import
import_stmt = """import {
  LeadState, OpportunityPhase, FollowupState, FollowupType, Priority,
  InteractionType, EmailState, RecordOrigin, ApprovalState, VisibilityLevel
} from '@/types/crm';\n\n"""
content = import_stmt + content

with open(constants_file, 'w') as f:
    f.write(content)

# Update imports in lib/, contexts/, app/api/
dirs_to_check = ['lib', 'contexts', 'app/api']
base_dir = '/Users/giacomobertolazzi/unfractmvp'

updated_files_count = 0

for d in dirs_to_check:
    target_dir = os.path.join(base_dir, d)
    if not os.path.exists(target_dir):
        continue
    for root, _, files in os.walk(target_dir):
        for file in files:
            if file.endswith('.ts') or file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r') as f:
                    file_content = f.read()

                original_content = file_content
                
                # We need to map @/components/unfract/<module>/types to @/types/<module>
                # and in case of crm/ricerca/types -> @/types/prospect
                
                # regex mapping
                replacements = {
                    r"@/components/unfract/crm/types": "@/types/crm",
                    r"@/components/unfract/calendar/types": "@/types/calendar",
                    r"@/components/unfract/meetings/types": "@/types/meetings",
                    r"@/components/unfract/documentation/types": "@/types/documentation",
                    r"@/components/unfract/organization/types": "@/types/organization",
                    r"@/components/unfract/crm/ricerca/types": "@/types/prospect",
                }
                
                for old, new in replacements.items():
                    file_content = file_content.replace(old, new)
                
                if file_content != original_content:
                    with open(filepath, 'w') as f:
                        f.write(file_content)
                    print(f"Updated {filepath}")
                    updated_files_count += 1

print(f"Total files updated: {updated_files_count}")
