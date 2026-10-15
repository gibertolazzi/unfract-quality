import { describe, expect, it } from 'vitest';

import {
  categoryFromTitle, columnCategory, deleteColumnBlock, displayColumnId, firstColumnOf, moveTargets, taskStatus, toggleDoneTarget,
} from '@/lib/taskWorkflow';

const columns = [
  { id: 'c3', title: 'Completate', order: 2, category: 'done' },
  { id: 'c1', title: 'Da fare', order: 0, category: 'todo' },
  { id: 'c2', title: 'Doing', order: 1 },
  { id: 'c4', title: 'To test', order: 3 },
];

describe('categoria delle colonne', () => {
  it('quella salvata; per le colonne vecchie, dal nome', () => {
    expect(columnCategory(columns[0])).toBe('done');
    expect(columnCategory(columns[2])).toBe('progress');
    expect(columnCategory(columns[3])).toBe('todo');
    expect(columnCategory(undefined)).toBe('todo');
    expect(categoryFromTitle('Done')).toBe('done');
    expect(categoryFromTitle('Fatto')).toBe('done');
    expect(categoryFromTitle('In corso')).toBe('progress');
  });

  it('rinominare non cambia lo stato: decide la categoria, non il nome', () => {
    expect(taskStatus({ columnId: 'c3' }, columns)).toBe('done');
    const renamed = columns.map(c => c.id === 'c3' ? { ...c, title: 'Archivio' } : c);
    expect(taskStatus({ columnId: 'c3' }, renamed)).toBe('done');
  });
});

describe('attività senza una colonna valida', () => {
  it('compaiono nella prima colonna «Da fare» e contano come da fare', () => {
    expect(displayColumnId({ columnId: 'sparita' }, columns)).toBe('c1');
    expect(displayColumnId({ columnId: 'c2' }, columns)).toBe('c2');
    expect(taskStatus({ columnId: 'sparita' }, columns)).toBe('todo');
  });
});

describe('spunta «fatto»', () => {
  it('va nella prima «Completato» e torna nella prima «Da fare»', () => {
    expect(toggleDoneTarget({ columnId: 'c2' }, columns)).toEqual({ columnId: 'c3', done: true });
    expect(toggleDoneTarget({ columnId: 'c3' }, columns)).toEqual({ columnId: 'c1', done: false });
  });

  it('senza una colonna «Completato» non sposta niente (prima finiva nell’ultima colonna)', () => {
    const noDone = columns.filter(c => c.id !== 'c3');
    expect(toggleDoneTarget({ columnId: 'c2' }, noDone)).toBeNull();
  });

  it('prima colonna di una categoria, in ordine', () => {
    expect(firstColumnOf(columns, 'todo')?.id).toBe('c1');
  });
});

describe('eliminare una colonna', () => {
  it('non l’ultima «Da fare» né l’ultima «Completato»', () => {
    expect(deleteColumnBlock(columns, 'c3')).toBe('last-done');
    expect(deleteColumnBlock(columns, 'c2')).toBeNull();
    // c1 e c4 sono entrambe «Da fare»: se ne può togliere una.
    expect(deleteColumnBlock(columns, 'c1')).toBeNull();
    expect(deleteColumnBlock(columns.filter(c => c.id !== 'c4'), 'c1')).toBe('last-todo');
  });

  it('le attività si spostano prima in una colonna della stessa categoria', () => {
    expect(moveTargets(columns, 'c1').map(c => c.id)).toEqual(['c4', 'c2', 'c3']);
  });
});
