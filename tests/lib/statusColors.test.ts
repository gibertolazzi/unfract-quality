import { describe, expect, it } from 'vitest';

import { badgeStyle, CATEGORY_COLORS, columnColor, COLUMN_COLORS, lighten } from '@/lib/statusColors';

describe('colori degli stati', () => {
  it('di default quelli della Panoramica, per categoria', () => {
    expect(CATEGORY_COLORS).toEqual({ todo: '#FF0004', progress: '#FFB800', done: '#006AFF' });
    expect(columnColor({ id: 'a', category: 'done' })).toBe('#006AFF');
    // Colonne vecchie senza categoria: dal nome, come per lo stato.
    expect(columnColor({ id: 'b', title: 'In corso' })).toBe('#FFB800');
    expect(columnColor(undefined)).toBe('#FF0004');
  });

  it('un colore scelto vale solo se è della tavolozza', () => {
    expect(columnColor({ id: 'c', category: 'progress', color: 'purple' })).toBe(COLUMN_COLORS.purple);
    expect(columnColor({ id: 'd', category: 'progress', color: 'javascript:alert(1)' })).toBe('#FFB800');
    expect(columnColor({ id: 'e', category: 'todo', color: null })).toBe('#FF0004');
  });

  it('badge tenue: testo schiarito, sfondo e bordo trasparenti', () => {
    expect(lighten('#000000', 0.5)).toBe('#808080');
    expect(lighten('#006AFF', 0)).toBe('#006AFF');
    expect(badgeStyle('#006AFF')).toEqual({ color: lighten('#006AFF', 0.35), borderColor: '#006AFF66', backgroundColor: '#006AFF1A' });
  });
});
