import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { CrmAuditEntry } from '@/types/crm';
import { CrmContextRef, byCreatedAtDesc, toMillis } from './base';

const COLLECTION_NAME = 'crm_audit';

/**
 * Registro delle operazioni. La specifica chiede di tracciare creazione,
 * modifica, archiviazione, conversione, cambio stato, assegnazione, invio,
 * esito provider, download, consenso, opt-out, campagne e azioni AI.
 *
 * ATTENZIONE: con la deroga 2 queste voci sono scritte dal browser, quindi chi
 * ha accesso a Firestore può falsificarle o ometterle. È un registro utile per
 * ricostruire cosa è successo, non una prova. Vedi docs/DEROGHE.md.
 */
export async function writeAudit(
  ctx: CrmContextRef,
  action: string,
  entityType: string,
  entityId: string,
  before?: any,
  after?: any,
  meta?: Record<string, any>
): Promise<void> {
  try {
    if (!ctx.projectId || !ctx.uid) return;
    await addDoc(collection(db, COLLECTION_NAME), {
      projectId: ctx.projectId,
      organizationId: ctx.organizationId,
      action,
      entityType,
      entityId,
      actorUid: ctx.uid,
      at: serverTimestamp(),
      before: before ?? null,
      after: after ?? null,
      meta: meta ?? null,
    });
  } catch (error) {
    // L'audit non deve mai far fallire l'operazione che sta tracciando.
    console.error('Error writing CRM audit entry:', error);
  }
}

function mapAudit(id: string, data: any): CrmAuditEntry {
  return {
    id,
    projectId: data.projectId || '',
    organizationId: data.organizationId || '',
    action: data.action || '',
    entityType: data.entityType || '',
    entityId: data.entityId || '',
    actorUid: data.actorUid || '',
    at: data.at,
    before: data.before,
    after: data.after,
    meta: data.meta,
  };
}

/** Voci di audit di una singola entità, dalla più recente. */
export function subscribeToEntityAudit(
  projectId: string,
  entityType: string,
  entityId: string,
  callback: (entries: CrmAuditEntry[]) => void
) {
  if (!projectId || !entityId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId),
    where('entityId', '==', entityId)
  );
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs
      .map(d => mapAudit(d.id, d.data()))
      .filter(e => e.entityType === entityType)
      // Ordinamento lato client: evita un indice composito.
      .sort((a, b) => toMillis(b.at) - toMillis(a.at));
    callback(entries);
  }, (error) => {
    console.error('Error subscribing to CRM audit:', error);
    callback([]);
  });
}
