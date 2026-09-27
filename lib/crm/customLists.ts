import { CrmCustomList } from '@/types/crm';
import {
  CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord,
  subscribeToRecords, byCreatedAtDesc,
} from './base';
import { writeAudit } from './audit';

const COLLECTION_NAME = 'crm_custom_lists';

export function mapCustomList(id: string, data: any): CrmCustomList {
  return {
    ...mapBase(id, data),
    name: data.name || 'Lista senza nome',
    ownerUid: data.ownerUid || '',
    entityIds: Array.isArray(data.entityIds) ? data.entityIds : [],
  };
}

export function subscribeToCustomLists(
  projectId: string,
  uid: string,
  callback: (lists: CrmCustomList[]) => void
) {
  return subscribeToRecords(
    COLLECTION_NAME,
    projectId,
    mapCustomList,
    (lists) => callback(
      lists
        .filter(l => l.ownerUid === uid)
        .sort(byCreatedAtDesc)
    )
  );
}

export async function createCustomList(
  ctx: CrmContextRef,
  name: string,
  entityIds: string[] = []
): Promise<string | null> {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    name,
    ownerUid: ctx.uid,
    entityIds,
  });
  if (id) await writeAudit(ctx, 'custom_list.created', 'custom_list', id, null, { name });
  return id;
}

export async function updateCustomList(
  ctx: CrmContextRef,
  id: string,
  updates: Partial<CrmCustomList>
): Promise<void> {
  await updateRecord(COLLECTION_NAME, id, updates, ctx.uid);
  await writeAudit(ctx, 'custom_list.updated', 'custom_list', id, null, updates);
}

export async function deleteCustomList(ctx: CrmContextRef, id: string): Promise<void> {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'custom_list.archived', 'custom_list', id);
}
