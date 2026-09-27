const fs = require('fs');
const path = 'lib/crm/followupService.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `
export async function deleteFollowup(ctx: CrmContextRef, id: string) {
  await deleteRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.deleted', 'followup', id);
}`;

content = content.replace(target, '');
fs.writeFileSync(path, content);
