/**
 * Colori degli stati delle attività.
 *
 * Di default una colonna ha il colore della sua categoria, gli stessi della
 * Panoramica (grafico «Completate / In corso / Da fare»): così bacheca,
 * elenco e Panoramica parlano la stessa lingua. Una colonna può scegliere un
 * altro colore della tavolozza (menu ⋯), per distinguere colonne della
 * stessa categoria; i conti della Panoramica restano per categoria.
 */

import { columnCategory, type ColumnCategory, type WorkflowColumn } from '@/lib/taskWorkflow';

export const CATEGORY_COLORS: Record<ColumnCategory, string> = {
  todo: '#FF0004',
  progress: '#FFB800',
  done: '#006AFF',
};

export const COLUMN_COLORS: Record<string, string> = {
  red: '#FF0004',
  orange: '#FF7A00',
  amber: '#FFB800',
  green: '#10B981',
  teal: '#14B8A6',
  blue: '#006AFF',
  purple: '#8B5CF6',
  pink: '#EC4899',
  grey: '#858585',
};

/** Il colore di una colonna: quello scelto, o quello della categoria. */
export function columnColor(column: (WorkflowColumn & { color?: string | null }) | undefined): string {
  const chosen = column?.color ? COLUMN_COLORS[column.color] : undefined;
  return chosen || CATEGORY_COLORS[columnCategory(column)];
}

/** Il colore schiarito verso il bianco (0-1): il blu e il rosso pieni sul nero si leggono poco. */
export function lighten(color: string, amount: number): string {
  const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  return `#${channels.map(c => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Badge tenue: testo schiarito, bordo del colore, sfondo appena accennato. */
export function badgeStyle(color: string): { color: string; borderColor: string; backgroundColor: string } {
  return { color: lighten(color, 0.35), borderColor: `${color}66`, backgroundColor: `${color}1A` };
}
