import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeDb } from '../helpers/fakeFirestore';
import { applyStorageBackfill, planStorageBackfill, storageRecordId } from '@/lib/server/storageBackfill';

let db: ReturnType<typeof createFakeDb>;

beforeEach(() => {
  db = createFakeDb();
  const s = db.store;
  s.set('workspaces/w1', { name: 'Acme', quotas: { planTier: 'free', storageUsed: 3_907_342, storageLimit: 1e9 } });
  s.set('workspaces/w2', { name: 'Beta', quotas: { planTier: 'free', storageUsed: 0, storageLimit: 1e9 } });
  s.set('workspaces/w3', { name: 'Vuoto' });
  s.set('projects/p1', { workspaceId: 'w1' });
  s.set('projects/p2', { workspaceId: 'w2' });
  s.set('projects/vecchio', { name: 'senza workspace' });
  s.set('chats/c1', { projectId: 'p2' });
  s.set('tasks/t1', { projectId: 'p1', attachments: [{ refPath: 'tasks/attachments/1_a.pdf' }] });
});

const objects = [
  { path: 'organizations/w1/logo_1', bytes: 100 },
  { path: 'ai-hub/p1/1_doc.pdf', bytes: 200 },
  { path: 'meetings/p2/1.webm', bytes: 300 },
  { path: 'chats/c1/1_0_foto.png', bytes: 400 },
  { path: 'tasks/attachments/1_a.pdf', bytes: 500 },
  { path: 'documentation/vecchio/d/1-x.png', bytes: 600 },
  { path: 'chats/sparita/1.webm', bytes: 700 },
  { path: 'tasks/attachments/orfano.pdf', bytes: 800 },
];

describe('conteggio retroattivo dello spazio', () => {
  it('assegna ogni file al workspace giusto dal percorso', async () => {
    const plan = await planStorageBackfill(db as any, objects);
    expect(plan.totals).toEqual({ w1: 100 + 200 + 500, w2: 300 + 400 });
    expect(plan.unassigned.map(u => u.path)).toEqual([
      'documentation/vecchio/d/1-x.png', 'chats/sparita/1.webm', 'tasks/attachments/orfano.pdf',
    ]);
  });

  it('allegati dei task con il progetto nel percorso (dal 10 ottobre)', async () => {
    const plan = await planStorageBackfill(db as any, [{ path: 'tasks/p2/1_b.pdf', bytes: 50 }, { path: 'tasks/sparito/1_c.pdf', bytes: 60 }]);
    expect(plan.totals).toEqual({ w2: 50 });
    expect(plan.unassigned.map(u => u.path)).toEqual(['tasks/sparito/1_c.pdf']);
  });

  it('scrive i record mancanti e ricalcola i contatori dalla somma dei record', async () => {
    // Un file già contato dal server dopo la #14 resta com'è e conta nella somma.
    db.store.set(`storage_usage/${storageRecordId('ai-hub/p1/1_doc.pdf')}`, { path: 'ai-hub/p1/1_doc.pdf', workspaceId: 'w1', bytes: 200 });
    const plan = await planStorageBackfill(db as any, objects);
    const result = await applyStorageBackfill(db, plan, () => 'ora');

    expect(result.created).toBe(4);
    expect(result.workspaces).toEqual({ w1: 800, w2: 700, w3: 0 });
    expect(db.store.get('workspaces/w1')!.quotas).toMatchObject({ storageUsed: 800, storageLimit: 1e9, planTier: 'free' });
    expect(db.store.get('workspaces/w2')!.quotas.storageUsed).toBe(700);
    // Un workspace senza quote e senza file non viene toccato.
    expect(db.store.get('workspaces/w3')!.quotas).toBeUndefined();
    expect(db.store.get(`storage_usage/${storageRecordId('chats/c1/1_0_foto.png')}`)).toMatchObject({ workspaceId: 'w2', bytes: 400, backfilled: true });

    // Rilanciarlo non cambia nulla.
    const again = await applyStorageBackfill(db, await planStorageBackfill(db as any, objects));
    expect(again.created).toBe(0);
    expect(again.workspaces).toEqual(result.workspaces);
  });
});
