const fs = require('fs');
const path = 'components/crm/pages/CrmFollowupsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { createFollowup, updateFollowup, changeFollowupState, archiveFollowup } from '@/lib/crm/followups';",
  "import { createFollowup, updateFollowup, changeFollowupState, archiveFollowup, deleteFollowup } from '@/lib/crm/followups';"
);

content = content.replace(
  "onArchive={followup => { archiveFollowup(ctx!, followup.id); toast.info('Follow-up archiviato'); }}",
  "onArchive={followup => { archiveFollowup(ctx!, followup.id); toast.info('Follow-up archiviato'); }}\n        onDelete={ids => { Promise.all(ids.map(id => deleteFollowup(ctx!, id))); toast.info(ids.length > 1 ? `${ids.length} follow-up eliminati` : 'Follow-up eliminato'); }}"
);

fs.writeFileSync(path, content);
