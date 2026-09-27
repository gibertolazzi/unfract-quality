const fs = require('fs');
const path = 'lib/crm/followupService.ts';
let content = fs.readFileSync(path, 'utf8');

// The duplicate block looks exactly like this:
const dupBlock = `export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}

export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}`;

const singleBlock = `export async function archiveFollowup(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'followup.archived', 'followup', id);
}`;

if (content.includes(dupBlock)) {
    content = content.replace(dupBlock, singleBlock);
    fs.writeFileSync(path, content);
    console.log("Duplicate fixed!");
} else {
    console.log("Duplicate block not found exactly as string. Will try regex.");
    // Let's just remove the first occurrence if there are two
    const occurrences = content.split(singleBlock).length - 1;
    if (occurrences > 1) {
       content = content.replace(singleBlock, '');
       fs.writeFileSync(path, content);
       console.log("Removed one duplicate using replace.");
    }
}
