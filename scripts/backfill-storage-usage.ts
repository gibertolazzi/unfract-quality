/**
 * Conteggio retroattivo dello spazio dei file (vedi lib/server/storageBackfill.ts).
 *
 *   npx tsx scripts/backfill-storage-usage.ts            # mostra cosa farebbe, non scrive
 *   npx tsx scripts/backfill-storage-usage.ts --apply    # scrive record e contatori
 *
 * Variabili:
 *   FIREBASE_PROJECT_ID   progetto (obbligatoria)
 *   STORAGE_BUCKET        bucket (predefinito: <progetto>.firebasestorage.app)
 * Credenziali: Application Default Credentials (`gcloud auth application-default
 * login`, oppure GOOGLE_APPLICATION_CREDENTIALS) di un account con accesso al
 * progetto.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { applyStorageBackfill, planStorageBackfill } from '../lib/server/storageBackfill';

async function main() {
  const apply = process.argv.includes('--apply');
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Imposta FIREBASE_PROJECT_ID.');
  const bucketName = process.env.STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

  const app = initializeApp({ credential: applicationDefault(), projectId, storageBucket: bucketName });
  const db = getFirestore(app);

  const [files] = await getStorage(app).bucket().getFiles();
  const objects = files.map(file => ({ path: file.name, bytes: Number(file.metadata.size) || 0 }));
  console.log(`${bucketName}: ${objects.length} file`);

  const plan = await planStorageBackfill(db as any, objects);
  console.log('\nByte per workspace (dai file assegnati):');
  for (const [workspaceId, bytes] of Object.entries(plan.totals)) {
    console.log(`  ${workspaceId}  ${(bytes / 1e6).toFixed(2)} MB`);
  }
  if (plan.unassigned.length) {
    console.log(`\nNon assegnati (${plan.unassigned.length}), restano fuori dal conteggio:`);
    for (const item of plan.unassigned) console.log(`  ${item.path.split('/').slice(0, 2).join('/')}/…  ${item.bytes} B  (${item.reason})`);
  }

  if (!apply) {
    console.log('\nNessuna scrittura: rilancia con --apply per registrare i file e ricalcolare i contatori.');
    return;
  }
  const result = await applyStorageBackfill(db, plan);
  console.log(`\nRecord creati: ${result.created}`);
  console.log('storageUsed ricalcolato:');
  for (const [workspaceId, bytes] of Object.entries(result.workspaces)) console.log(`  ${workspaceId}  ${bytes} B`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
