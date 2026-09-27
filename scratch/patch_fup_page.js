const fs = require('fs');
const path = 'components/crm/pages/CrmFollowupsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('changeFollowupState, archiveFollowup', 'changeFollowupState, archiveFollowup, deleteFollowup');
content = content.replace("onArchive={followup => { archiveFollowup(ctx!, followup.id); toast.info('Follow-up archiviato'); }}", "onArchive={followup => { deleteFollowup(ctx!, followup.id); toast.info('Follow-up eliminato'); }}");
content = content.replace("onDelete={followup => { deleteFollowup(ctx!, followup.id); toast.info('Follow-up eliminato'); }}", "onArchive={followup => { deleteFollowup(ctx!, followup.id); toast.info('Follow-up eliminato'); }}"); // Just in case

fs.writeFileSync(path, content);
