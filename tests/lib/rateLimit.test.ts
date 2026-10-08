import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ db: undefined as any }));

vi.mock('@/lib/firebase-admin', async () => {
  const { createFakeDb } = await import('../helpers/fakeFirestore');
  mocks.db = createFakeDb();
  return { adminDb: mocks.db };
});

import { tooManyRequestsShared } from '@/lib/server/rateLimit';

const rateDocs = (): string[] => Array.from(mocks.db.store.keys() as Iterable<string>).filter(path => path.startsWith('rate_limits/'));

beforeEach(() => {
  mocks.db.store.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-08T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('limite di richieste condiviso', () => {
  it('blocca oltre il limite nella stessa finestra', async () => {
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push(await tooManyRequestsShared('ai-chat:anna', 3));
    expect(results).toEqual([false, false, false, true]);
  });

  it('riparte da zero nella finestra successiva, sullo stesso documento', async () => {
    for (let i = 0; i < 4; i += 1) await tooManyRequestsShared('ai-chat:anna', 3);
    vi.setSystemTime(new Date('2026-10-08T10:01:00Z'));
    expect(await tooManyRequestsShared('ai-chat:anna', 3)).toBe(false);
    expect(rateDocs()).toHaveLength(1);
  });

  it('conta separatamente utenti e operazioni, senza uid in chiaro nell’id', async () => {
    for (let i = 0; i < 3; i += 1) await tooManyRequestsShared('ai-chat:anna', 3);
    expect(await tooManyRequestsShared('ai-chat:bruno', 3)).toBe(false);
    expect(await tooManyRequestsShared('ai-title:anna', 3)).toBe(false);
    expect(rateDocs()).toHaveLength(3);
    expect(rateDocs().some((path: string) => path.includes('anna'))).toBe(false);
  });

  it('se Firestore non risponde ripiega sul contatore in memoria', async () => {
    const spy = vi.spyOn(mocks.db, 'runTransaction').mockRejectedValue(new Error('unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const results = [];
    for (let i = 0; i < 3; i += 1) results.push(await tooManyRequestsShared('ai-meeting:carla', 2));
    expect(results).toEqual([false, false, true]);
    spy.mockRestore();
  });
});
