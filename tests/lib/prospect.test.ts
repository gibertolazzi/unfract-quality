import { describe, expect, it } from 'vitest';
import { normalizeDomain } from '@/lib/crm/prospect/base';
import { partitaIvaValida } from '@/lib/crm/prospect/recognize';

describe('partitaIvaValida', () => {
  it('accetta partite IVA con la cifra di controllo corretta', () => {
    expect(partitaIvaValida('00743110157')).toBe(true);
    expect(partitaIvaValida('00488410010')).toBe(true);
  });

  it('rifiuta una cifra di controllo sbagliata', () => {
    expect(partitaIvaValida('00743110158')).toBe(false);
  });

  it('rifiuta lunghezze diverse da 11 cifre', () => {
    expect(partitaIvaValida('0074311015')).toBe(false);
    expect(partitaIvaValida('')).toBe(false);
  });
});

describe('normalizeDomain', () => {
  it('toglie protocollo, www, percorso e punto finale', () => {
    expect(normalizeDomain('https://www.Illy.com/it/chi-siamo?x=1')).toBe('illy.com');
    expect(normalizeDomain('illy.com.')).toBe('illy.com');
  });
});
