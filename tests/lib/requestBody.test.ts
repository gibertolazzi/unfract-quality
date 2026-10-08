import { describe, expect, it } from 'vitest';
import { readJsonObject } from '@/lib/server/requestBody';

const request = (body: string) => new Request('http://localhost/api/x', { method: 'POST', body });

describe('corpo JSON delle richieste', () => {
  it('restituisce l’oggetto', async () => {
    expect(await readJsonObject(request('{"text":"ciao","n":2}'))).toEqual({ text: 'ciao', n: 2 });
  });

  it('null se non è JSON', async () => {
    expect(await readJsonObject(request('{non json'))).toBeNull();
    expect(await readJsonObject(request(''))).toBeNull();
  });

  it('un JSON che non è un oggetto vale come oggetto vuoto', async () => {
    for (const body of ['42', '"testo"', '[1,2]', 'null']) {
      expect(await readJsonObject(request(body))).toEqual({});
    }
  });
});
