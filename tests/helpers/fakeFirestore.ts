/**
 * Firestore in memoria, con solo ciò che usano le route sotto test.
 * Non simula le regole di sicurezza: per quelle serve l'emulatore.
 */
export function createFakeDb() {
  const store = new Map<string, Record<string, any>>();

  const snapshot = (path: string) => {
    const data = store.get(path);
    return { id: path.split('/').pop(), exists: data !== undefined, data: () => data, get: (field: string) => data?.[field] };
  };

  const docRef = (path: string): any => ({
    path,
    id: path.split('/').pop(),
    get: async () => snapshot(path),
    set: async (data: Record<string, any>, options?: { merge?: boolean }) => {
      store.set(path, options?.merge ? { ...(store.get(path) || {}), ...data } : { ...data });
    },
    update: async (data: Record<string, any>) => {
      if (!store.has(path)) throw new Error(`No document: ${path}`);
      const current = store.get(path)!;
      const next = { ...current };
      for (const [key, value] of Object.entries(data)) {
        // FieldValue.arrayRemove finto (vedi i test che lo usano).
        next[key] = value && typeof value === 'object' && '__arrayRemove' in value
          ? (current[key] || []).filter((item: unknown) => !(value.__arrayRemove as unknown[]).includes(item))
          : value;
      }
      store.set(path, next);
    },
    delete: async () => { store.delete(path); },
  });

  const inCollection = (name: string, path: string) =>
    path.startsWith(`${name}/`) && path.split('/').length === name.split('/').length + 1;

  const collection = (name: string) => ({
    doc: (id: string) => docRef(`${name}/${id}`),
    get: async () => {
      const docs = Array.from(store.keys()).filter(path => inCollection(name, path)).map(path => ({ ...snapshot(path), ref: docRef(path) }));
      return { empty: docs.length === 0, docs };
    },
    where: (field: string, op: string, value: unknown) => {
      const run = async (limit = Infinity) => {
        const matches = (data: Record<string, any>) => op === 'array-contains'
          ? Array.isArray(data[field]) && data[field].includes(value)
          : op === 'in'
            ? (value as unknown[]).includes(data[field])
            : data[field] === value;
        const docs = Array.from(store.entries())
          .filter(([path, data]) => path.startsWith(`${name}/`) && path.split('/').length === name.split('/').length + 1 && matches(data))
          .slice(0, limit)
          .map(([path]) => ({ ...snapshot(path), ref: docRef(path) }));
        return { empty: docs.length === 0, docs };
      };
      return { get: () => run(), limit: (n: number) => ({ get: () => run(n) }) };
    },
  });

  const getAll = async (...refs: any[]) => Promise.all(refs.map(ref => ref.get().then((snap: any) => ({ ...snap, ref }))));

  return {
    store,
    doc: docRef,
    collection,
    getAll,
    runTransaction: async <T>(fn: (tx: any) => Promise<T>) => fn({
      get: (ref: any) => ref.get(),
      getAll,
      set: (ref: any, data: any, options?: any) => ref.set(data, options),
      update: (ref: any, data: any) => ref.update(data),
      delete: (ref: any) => ref.delete(),
    }),
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        update: (ref: any, data: any) => { ops.push(() => ref.update(data)); },
        delete: (ref: any) => { ops.push(() => ref.delete()); },
        commit: async () => { for (const op of ops) await op(); },
      };
    },
  };
}

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
}
