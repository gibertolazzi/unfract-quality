import { db } from '@/lib/firebase';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, where, onSnapshot, increment,
} from 'firebase/firestore';
import { CrmBase } from '@/types/crm';
import { RecordOrigin } from '@/components/crm/constants';
import { normalizeEmail, normalizePhone, extractDomain, toMillis, byUpdatedAtDesc, byCreatedAtDesc } from './helpers';

// Riesportate per comodità: i moduli entità le importano già da qui.
export { normalizeEmail, normalizePhone, extractDomain, toMillis, byUpdatedAtDesc, byCreatedAtDesc };

/**
 * Contesto di scrittura: chi scrive e dove.
 * `organizationId` viene valorizzato su ogni record anche se la partizione è
 * `projectId` (deroga 1, vedi docs/DEROGHE.md).
 */
export interface CrmContextRef {
  projectId: string;
  organizationId: string;
  uid: string;
}

// ------------------------------------------------------------ mappatura

/** Campi comuni in lettura, con i default che tollerano documenti incompleti. */
export function mapBase(id: string, data: any): CrmBase {
  return {
    id,
    projectId: data.projectId || '',
    organizationId: data.organizationId || '',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    createdBy: data.createdBy || '',
    updatedBy: data.updatedBy || '',
    version: typeof data.version === 'number' ? data.version : 1,
    origin: data.origin || 'manual',
    archived: data.archived === true,
    archivedAt: data.archivedAt,
    provider: data.provider,
    externalId: data.externalId,
    sourceRef: data.sourceRef,
    approvalStatus: data.approvalStatus,
  };
}

/** Campi comuni in scrittura, al momento della creazione. */
export function buildBasePayload(ctx: CrmContextRef, origin: RecordOrigin = 'manual') {
  return {
    projectId: ctx.projectId,
    organizationId: ctx.organizationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
    version: 1,
    origin,
    archived: false,
    archivedAt: null,
  };
}

// --------------------------------------------------------------- scrittura

/** Campi che nessun update può toccare. */
const IMMUTABLE = ['id', 'projectId', 'organizationId', 'createdAt', 'createdBy', 'version'];

export async function createRecord(
  collectionName: string,
  ctx: CrmContextRef,
  payload: Record<string, any>,
  origin: RecordOrigin = 'manual'
): Promise<string | null> {
  try {
    if (!ctx.projectId || !ctx.uid) {
      console.error(`Missing project or user creating ${collectionName}`);
      return null;
    }
    const ref = await addDoc(collection(db, collectionName), {
      ...payload,
      ...buildBasePayload(ctx, origin),
    });
    return ref.id;
  } catch (error) {
    console.error(`Error creating ${collectionName}:`, error);
    return null;
  }
}

export async function updateRecord(
  collectionName: string,
  id: string,
  updates: Record<string, any>,
  uid: string
): Promise<void> {
  try {
    const payload: Record<string, any> = { ...updates };
    IMMUTABLE.forEach(field => delete payload[field]);

    await updateDoc(doc(db, collectionName, id), {
      ...payload,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      version: increment(1),
    });
  } catch (error) {
    console.error(`Error updating ${collectionName}:`, error);
  }
}

/**
 * Archiviazione logica. La specifica non prevede cancellazione: non esiste
 * una deleteRecord, ed è voluto.
 */
export async function archiveRecord(
  collectionName: string,
  id: string,
  uid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, collectionName, id), {
      archived: true,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      version: increment(1),
    });
  } catch (error) {
    console.error(`Error archiving ${collectionName}:`, error);
  }
}

export async function deleteRecord(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (error) {
    console.error(`Error deleting ${collectionName}:`, error);
  }
}

export async function restoreRecord(
  collectionName: string,
  id: string,
  uid: string
): Promise<void> {
  try {
    await updateDoc(doc(db, collectionName, id), {
      archived: false,
      archivedAt: null,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      version: increment(1),
    });
  } catch (error) {
    console.error(`Error restoring ${collectionName}:`, error);
  }
}

// ----------------------------------------------------------------- lettura

export interface ReadOptions {
  includeArchived?: boolean;
}

export async function getRecords<T>(
  collectionName: string,
  projectId: string,
  mapper: (id: string, data: any) => T,
  options: ReadOptions = {}
): Promise<T[]> {
  try {
    if (!projectId) return [];
    const q = query(collection(db, collectionName), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      // Il filtro sugli archiviati è lato client: evita un indice composito.
      .filter(d => options.includeArchived || d.data().archived !== true)
      .map(d => mapper(d.id, d.data()));
  } catch (error) {
    console.error(`Error fetching ${collectionName}:`, error);
    return [];
  }
}

export function subscribeToRecords<T>(
  collectionName: string,
  projectId: string,
  mapper: (id: string, data: any) => T,
  callback: (records: T[]) => void,
  options: ReadOptions = {}
) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, collectionName), where('projectId', '==', projectId));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs
        .filter(d => options.includeArchived || d.data().archived !== true)
        .map(d => mapper(d.id, d.data()))
    );
  }, (error) => {
    console.error(`Error subscribing to ${collectionName}:`, error);
    callback([]);
  });
}

export async function getRecordById<T>(
  collectionName: string,
  id: string,
  mapper: (id: string, data: any) => T
): Promise<T | null> {
  try {
    if (!id) return null;
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return null;
    return mapper(snap.id, snap.data());
  } catch (error) {
    console.error(`Error fetching ${collectionName} by id:`, error);
    return null;
  }
}

export function subscribeToRecord<T>(
  collectionName: string,
  id: string,
  mapper: (id: string, data: any) => T,
  callback: (record: T | null) => void
) {
  if (!id) {
    callback(null);
    return () => {};
  }
  return onSnapshot(doc(db, collectionName, id), (snap) => {
    callback(snap.exists() ? mapper(snap.id, snap.data()) : null);
  }, (error) => {
    console.error(`Error subscribing to ${collectionName} by id:`, error);
    callback(null);
  });
}
