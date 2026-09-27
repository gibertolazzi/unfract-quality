import { CrmSavedView } from '@/types/crm';
import {
  CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord,
  subscribeToRecords, byCreatedAtDesc,
} from './base';
import { writeAudit } from './audit';
import { LeadFilters, LeadSort, EMPTY_FILTERS, DEFAULT_SORT } from './leadFilters';

const COLLECTION_NAME = 'crm_saved_views';

export function mapSavedView(id: string, data: any): CrmSavedView {
  return {
    ...mapBase(id, data),
    name: data.name || 'Vista senza nome',
    entity: data.entity || 'lead',
    ownerUid: data.ownerUid || '',
    shared: data.shared === true,
    filters: { ...EMPTY_FILTERS, ...(data.filters || {}) },
    sort: { ...DEFAULT_SORT, ...(data.sort || {}) },
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : 25,
  };
}

/** Viste visibili all'utente: le proprie più quelle condivise dal progetto. */
export function subscribeToSavedViews(
  projectId: string,
  uid: string,
  callback: (views: CrmSavedView[]) => void
) {
  return subscribeToRecords(
    COLLECTION_NAME,
    projectId,
    mapSavedView,
    (views) => callback(
      views
        .filter(v => v.ownerUid === uid || v.shared)
        .sort(byCreatedAtDesc)
    )
  );
}

export async function createSavedView(
  ctx: CrmContextRef,
  name: string,
  filters: LeadFilters,
  sort: LeadSort,
  pageSize: number,
  shared = false
): Promise<string | null> {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    name,
    entity: 'lead',
    ownerUid: ctx.uid,
    shared,
    filters,
    sort,
    pageSize,
  });
  if (id) await writeAudit(ctx, 'saved_view.created', 'saved_view', id, null, { name, shared });
  return id;
}

export async function updateSavedView(
  ctx: CrmContextRef,
  id: string,
  updates: Partial<CrmSavedView>
): Promise<void> {
  await updateRecord(COLLECTION_NAME, id, updates, ctx.uid);
  await writeAudit(ctx, 'saved_view.updated', 'saved_view', id, null, updates);
}

export async function deleteSavedView(ctx: CrmContextRef, id: string): Promise<void> {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'saved_view.archived', 'saved_view', id);
}
