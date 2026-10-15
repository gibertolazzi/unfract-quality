import { describe, expect, it } from 'vitest';

import {
  buildLanes, cellId, EMPTY_FILTERS, filterTasks, hasActiveFilters, laneKey, laneUpdate, NO_EPIC, parseCellId, UNASSIGNED,
} from '@/lib/boardFilters';
import { completedAtUpdate } from '@/lib/taskWorkflow';

const tasks = [
  { id: '1', title: 'Logo nuovo', assigneeUid: 'me', priority: 'High', epicId: 'e2' },
  { id: '2', title: 'Fattura', description: 'cliente Rossi', assigneeUid: 'zoe', priority: 'Low' },
  { id: '3', title: 'Sito', assigneeUid: null, priority: 'Critical', epicId: 'e1' },
  { id: '4', title: 'Post', assigneeUid: 'anna' },
];

describe('filtri rapidi', () => {
  it('nessun filtro: tutte le attività', () => {
    expect(filterTasks(tasks, EMPTY_FILTERS, 'me')).toHaveLength(4);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '  ' })).toBe(false);
  });

  it('solo mie, assegnatario, priorità, epic, testo', () => {
    const ids = (f: Partial<typeof EMPTY_FILTERS>) => filterTasks(tasks, { ...EMPTY_FILTERS, ...f }, 'me').map(t => t.id);
    expect(ids({ mine: true })).toEqual(['1']);
    expect(ids({ assignee: UNASSIGNED })).toEqual(['3']);
    expect(ids({ assignee: 'zoe' })).toEqual(['2']);
    // Senza priorità conta come «Media», come nella scheda.
    expect(ids({ priority: 'Medium' })).toEqual(['4']);
    expect(ids({ epic: NO_EPIC })).toEqual(['2', '4']);
    expect(ids({ search: 'rossi' })).toEqual(['2']);
    expect(ids({ search: 'LOGO', mine: true })).toEqual(['1']);
  });

  it('«solo mie» senza utente non mostra niente', () => {
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, mine: true }, null)).toEqual([]);
  });
});

describe('corsie', () => {
  const nameOf = (uid: string) => ({ me: 'Matteo', zoe: 'Zoe', anna: 'Anna' }[uid] || uid);

  it('per assegnatario: io, poi per nome, i non assegnati in fondo', () => {
    expect(buildLanes(tasks, 'assignee', { uid: 'me', nameOf, epics: [] }).map(l => [l.key, l.tasks.length]))
      .toEqual([['me', 1], ['anna', 1], ['zoe', 1], [UNASSIGNED, 1]]);
  });

  it('la mia corsia c’è anche se vuota, per trascinarci un’attività', () => {
    const lanes = buildLanes(tasks.filter(t => t.assigneeUid !== 'me'), 'assignee', { uid: 'me', nameOf, epics: [] });
    expect(lanes[0]).toEqual({ key: 'me', tasks: [] });
  });

  it('per epic nell’ordine delle epic, per priorità dalla più alta', () => {
    const epics = [{ id: 'e1' }, { id: 'e2' }];
    expect(buildLanes(tasks, 'epic', { nameOf, epics }).map(l => l.key)).toEqual(['e1', 'e2', NO_EPIC]);
    expect(buildLanes(tasks, 'priority', { nameOf, epics }).map(l => l.key)).toEqual(['Critical', 'High', 'Medium', 'Low']);
    expect(laneKey({ priority: 'strana' }, 'priority')).toBe('Medium');
  });

  it('spostare in un’altra corsia cambia quel campo', () => {
    expect(laneUpdate('assignee', 'zoe', nameOf)).toEqual({ assigneeUid: 'zoe', assignee: 'Zoe' });
    expect(laneUpdate('assignee', UNASSIGNED, nameOf)).toEqual({ assigneeUid: null, assignee: null });
    expect(laneUpdate('epic', NO_EPIC, nameOf)).toEqual({ epicId: null });
    expect(laneUpdate('priority', 'High', nameOf)).toEqual({ priority: 'High' });
  });

  it('ID delle celle corsia × colonna', () => {
    expect(parseCellId(cellId('me', 'col1'))).toEqual({ lane: 'me', columnId: 'col1' });
    expect(parseCellId(cellId(UNASSIGNED, 'c'))).toEqual({ lane: UNASSIGNED, columnId: 'c' });
    expect(parseCellId('col1')).toEqual({ lane: null, columnId: 'col1' });
  });
});

describe('completedAt quando si cambia colonna', () => {
  const columns = [{ id: 'a', category: 'todo' }, { id: 'b', category: 'progress' }, { id: 'c', category: 'done' }];
  it('si fissa entrando in «Completato», si toglie uscendone', () => {
    expect(completedAtUpdate({ columnId: 'a' }, 'c', columns, () => 'ora')).toEqual({ completedAt: 'ora' });
    expect(completedAtUpdate({ columnId: 'c' }, 'b', columns)).toEqual({ completedAt: null });
    expect(completedAtUpdate({ columnId: 'a' }, 'b', columns)).toEqual({});
  });
});
