const fs = require('fs');
const path = 'lib/crm/followupService.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}`;

const replacement = `export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}

export async function deleteFollowup(ctx: CrmContextRef, id: string) {
  await deleteRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.deleted', 'followup', id);
}`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
}

fs.writeFileSync(path, content);
