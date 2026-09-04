import { db } from './firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

const COLLECTIONS_TO_MIGRATE = ['tasks', 'columns', 'meetings', 'documentation', 'epics'];

/**
 * Migrates all Firestore documents that don't have a projectId
 * by assigning them to the given default project.
 * Runs only once per project (tracked via localStorage).
 */
export async function migrateOrphanData(projectId: string): Promise<void> {
  if (!projectId) return;

  const migrationKey = `unfract_migration_done_${projectId}`;
  if (typeof window !== 'undefined' && localStorage.getItem(migrationKey)) {
    return; // Already migrated for this project
  }

  let totalMigrated = 0;

  for (const collName of COLLECTIONS_TO_MIGRATE) {
    try {
      const snapshot = await getDocs(collection(db, collName));
      const orphanDocs = snapshot.docs.filter(d => !d.data().projectId);

      if (orphanDocs.length === 0) continue;

      // Firestore batches support max 500 operations
      const batchSize = 500;
      for (let i = 0; i < orphanDocs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = orphanDocs.slice(i, i + batchSize);
        chunk.forEach(docSnap => {
          batch.update(doc(db, collName, docSnap.id), { projectId });
        });
        await batch.commit();
      }

      totalMigrated += orphanDocs.length;
      console.log(`[Migration] Assigned projectId to ${orphanDocs.length} docs in '${collName}'`);
    } catch (error) {
      console.error(`[Migration] Error migrating '${collName}':`, error);
    }
  }

  if (totalMigrated > 0) {
    console.log(`[Migration] Total migrated: ${totalMigrated} documents`);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(migrationKey, 'true');
  }
}
