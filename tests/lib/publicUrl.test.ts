import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));

import { assertPublicUrl, isPublicIp, UnsafeUrlError } from '@/lib/server/publicUrl';
import { websiteReader } from '@/lib/crm/prospect/providers/website';

/** DNS finto: ogni nome risolve agli indirizzi indicati qui. */
const DNS: Record<string, string[]> = {
  'azienda.example': ['93.184.216.34'],
  'interno.example': ['10.0.0.5'],
  'misto.example': ['93.184.216.34', '127.0.0.1'],
  'metadata.example': ['169.254.169.254'],
  'v6.example': ['2606:4700::6810:84e5'],
  'v6locale.example': ['fd00::1'],
};

beforeEach(() => {
  mocks.lookup.mockReset();
  mocks.lookup.mockImplementation(async (host: string) => {
    const addresses = DNS[host];
    if (!addresses) throw Object.assign(new Error(`ENOTFOUND ${host}`), { code: 'ENOTFOUND' });
    return addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 }));
  });
});

describe('isPublicIp', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
    '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '2001:db8::1', '2002:a00:1::1',
  ])('%s non è pubblico', address => {
    expect(isPublicIp(address)).toBe(false);
  });

  it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::6810:84e5', '2a00:1450:4002:402::200e'])(
    '%s è pubblico', address => {
      expect(isPublicIp(address)).toBe(true);
    });
});

describe('assertPublicUrl', () => {
  it('accetta un dominio che risolve solo a indirizzi pubblici', async () => {
    await expect(assertPublicUrl('https://azienda.example/chi-siamo')).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl('https://v6.example/')).resolves.toBeInstanceOf(URL);
  });

  it.each([
    ['IP scritto a mano', 'http://127.0.0.1/'],
    ['IP in forma numerica', 'http://2130706433/'],
    ['IPv6 scritto a mano', 'http://[::1]/'],
    ['porta diversa da 80/443', 'https://azienda.example:8080/'],
    ['protocollo non web', 'file:///etc/passwd'],
    ['credenziali nell’indirizzo', 'https://user:pw@azienda.example/'],
    ['nome senza dominio', 'http://localhost/'],
    ['dominio con indirizzo privato', 'https://interno.example/'],
    ['dominio con un indirizzo pubblico e uno privato', 'https://misto.example/'],
    ['dominio che punta ai metadati del cloud', 'https://metadata.example/'],
    ['dominio con indirizzo IPv6 locale', 'https://v6locale.example/'],
  ])('rifiuta: %s', async (_caso, url) => {
    await expect(assertPublicUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('un errore del DNS resta un errore di rete', async () => {
    await expect(assertPublicUrl('https://inesistente.example/')).rejects.toThrow('ENOTFOUND');
  });
});

describe('lettore di siti', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const html = (body: string) => new Response(`<html><head><title>Azienda</title></head><body>${body}</body></html>`,
    { status: 200, headers: { 'content-type': 'text/html' } });

  it('non parte nemmeno con un IP e una porta al posto del dominio', async () => {
    const esito = await websiteReader.read('127.0.0.1:8080');
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.failure.code).toBe('INVALID_INPUT');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('non parte con un dominio che risolve a un indirizzo interno', async () => {
    const esito = await websiteReader.read('interno.example');
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.failure.code).toBe('INVALID_INPUT');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('non segue un redirect verso i metadati del cloud', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      if (url === 'https://azienda.example/') {
        return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
      }
      throw new Error(`richiesta inattesa: ${url}`);
    });

    const esito = await websiteReader.read('azienda.example');
    expect(esito.ok).toBe(false);
    const visitati = fetchMock.mock.calls.map(([url]) => String(url));
    expect(visitati.some(url => url.includes('169.254'))).toBe(false);
  });

  it('segue i redirect verso indirizzi pubblici', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/robots.txt')) return new Response('', { status: 404 });
      if (url === 'https://azienda.example/') {
        return new Response(null, { status: 301, headers: { location: 'https://v6.example/' } });
      }
      if (url === 'https://v6.example/') return html('<p>P.IVA 00743110157</p>');
      return new Response('', { status: 404 });
    });

    const esito = await websiteReader.read('azienda.example');
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.result.vatNumbers.map(v => v.value)).toContain('00743110157');
  });
});
