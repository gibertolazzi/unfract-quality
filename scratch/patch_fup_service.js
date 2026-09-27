const fs = require('fs');
const path = 'lib/crm/followupService.ts';
let content = fs.readFileSync(path, 'utf8');

// Add deleteRecord to import
content = content.replace('updateRecord, archiveRecord,', 'updateRecord, archiveRecord, deleteRecord,');

// Add deleteFollowup function
const archiveFunction = `export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}`;

const deleteFunction = `export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}

export async function deleteFollowup(ctx: CrmContextRef, id: string) {
  await deleteRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.deleted', 'followup', id);
}`;

content = content.replace(archiveFunction, deleteFunction);
fs.writeFileSync(path, content);
