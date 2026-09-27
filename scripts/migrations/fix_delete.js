const fs = require('fs');

const basePath = '/Users/giacomobertolazzi/unfractmvp/lib/crm/base.ts';
let base = fs.readFileSync(basePath, 'utf8');
if (!base.includes('deleteRecord')) {
  base = base.replace(
    'import {',
    "import { deleteDoc } from 'firebase/firestore';\nimport {"
  );
  base = base.replace(
    'export async function restoreRecord',
    "export async function deleteRecord(collectionName: string, id: string): Promise<void> {\n  try {\n    await deleteDoc(doc(db, collectionName, id));\n  } catch (error) {\n    console.error(`Error deleting ${collectionName}:`, error);\n  }\n}\n\nexport async function restoreRecord"
  );
  fs.writeFileSync(basePath, base, 'utf8');
}

const files = [
  { path: '/Users/giacomobertolazzi/unfractmvp/lib/crm/leads.ts', name: 'Lead' },
  { path: '/Users/giacomobertolazzi/unfractmvp/lib/crm/contacts.ts', name: 'Contact' },
  { path: '/Users/giacomobertolazzi/unfractmvp/lib/crm/accounts.ts', name: 'Account' },
  { path: '/Users/giacomobertolazzi/unfractmvp/lib/crm/customers.ts', name: 'Customer' },
];

files.forEach(f => {
  let content = fs.readFileSync(f.path, 'utf8');
  if (!content.includes('deleteRecord')) {
    content = content.replace('archiveRecord, restoreRecord,', 'archiveRecord, restoreRecord, deleteRecord,');
    content = content.replace(
      'export async function restore' + f.name,
      'export async function delete' + f.name + '(ctx: CrmContextRef, id: string): Promise<void> {\n  await deleteRecord(COLLECTION_NAME, id);\n  await writeAudit(ctx, \'' + f.name.toLowerCase() + '.deleted\', \'' + f.name.toLowerCase() + '\', id);\n}\n\nexport async function restore' + f.name
    );
    fs.writeFileSync(f.path, content, 'utf8');
  }
});
