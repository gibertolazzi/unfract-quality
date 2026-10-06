import { describe, expect, it } from 'vitest';
import { escapeIcsText, icsSingleLine } from '@/lib/ics';

describe('escapeIcsText', () => {
  it('applica l’escape di RFC 5545', () => {
    expect(escapeIcsText('a\\b;c,d')).toBe('a\\\\b\\;c\\,d');
  });

  it('trasforma ogni tipo di a capo in \\n, senza lasciare righe nuove', () => {
    const value = escapeIcsText('uno\r\nATTENDEE:x\rdue\ntre');
    expect(value).toBe('uno\\nATTENDEE:x\\ndue\\ntre');
    expect(value).not.toMatch(/[\r\n]/);
  });
});

describe('icsSingleLine', () => {
  it('toglie gli a capo', () => {
    expect(icsSingleLine('id\r\nX-INJECT:1')).toBe('id X-INJECT:1');
  });
});
