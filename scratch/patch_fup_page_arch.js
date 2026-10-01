const fs = require('fs');
const path = 'components/crm/pages/CrmFollowupsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = "onArchive={followup => { deleteFollowup(ctx!, followup.id); toast.info('Follow-up eliminato'); }}";
const replacement = "onArchive={followup => { archiveFollowup(ctx!, followup.id); toast.info('Follow-up archiviato'); }}";

content = content.replace(target, replacement);

fs.writeFileSync(path, content);
