import { describe, expect, it } from 'vitest';

import {
  allowedTargets, canTransition, categoryFromTitle, columnCategory, deleteColumnBlock, displayColumnId, entryBlock, firstColumnOf,
  moveBlock, moveTargets, taskStatus, toggleDoneTarget,
} from '@/lib/taskWorkflow';
import { planTemplate, planWriteCount, WORKFLOW_TEMPLATES } from '@/lib/workflowTemplates';

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

describe('transizioni', () => {
  const flow = [
    { id: 'a', title: 'Backlog', order: 0, category: 'todo', blockedTargets: ['c'] },
    { id: 'b', title: 'In corso', order: 1, category: 'progress' },
    { id: 'c', title: 'Fatto', order: 2, category: 'done', entryRules: { assignee: true } },
    { id: 'd', title: 'Altro fatto', order: 3, category: 'done' },
  ];
  const member = { uid: 'u1', isAdmin: false };

  it('una colonna senza blocchi va ovunque; quelle bloccate no', () => {
    expect(canTransition(flow, 'b', 'c')).toBe(true);
    expect(canTransition(flow, 'a', 'c')).toBe(false);
    expect(allowedTargets(flow, 'a').map(c => c.id)).toEqual(['b', 'd']);
    // Un'attività senza colonna valida non ha vincoli di partenza.
    expect(canTransition(flow, 'sparita', 'c')).toBe(true);
  });

  it('moveBlock: prima la transizione, poi le condizioni della colonna', () => {
    expect(moveBlock({ columnId: 'a', assigneeUid: 'u1' }, 'c', flow, member)).toBe('transition');
    expect(moveBlock({ columnId: 'b' }, 'c', flow, member)).toBe('assignee');
    expect(moveBlock({ columnId: 'b', assigneeUid: 'u1' }, 'c', flow, member)).toBeNull();
    expect(moveBlock({ columnId: 'c' }, 'c', flow, member)).toBeNull();
  });

  it('la spunta «fatto» sceglie la prima colonna «Completato» raggiungibile', () => {
    expect(toggleDoneTarget({ columnId: 'a' }, flow)).toEqual({ columnId: 'd', done: true });
    expect(toggleDoneTarget({ columnId: 'b' }, flow)).toEqual({ columnId: 'c', done: true });
  });
});

describe('condizioni per entrare in una colonna', () => {
  const col = (entryRules: object) => ({ id: 'x', entryRules });

  it('assegnatario e scadenza', () => {
    expect(entryBlock({}, col({ assignee: true }), { isAdmin: true })).toBe('assignee');
    expect(entryBlock({ date: '  ' }, col({ dueDate: true }), { isAdmin: true })).toBe('dueDate');
    expect(entryBlock({ date: '2026-10-20' }, col({ dueDate: true }), { isAdmin: false })).toBeNull();
  });

  it('solo admin, e solo l’assegnatario (o un admin)', () => {
    expect(entryBlock({}, col({ adminOnly: true }), { uid: 'u1', isAdmin: false })).toBe('adminOnly');
    expect(entryBlock({}, col({ adminOnly: true }), { uid: 'u1', isAdmin: true })).toBeNull();
    expect(entryBlock({ assigneeUid: 'u2' }, col({ assigneeOnly: true }), { uid: 'u1', isAdmin: false })).toBe('assigneeOnly');
    expect(entryBlock({ assigneeUid: 'u1' }, col({ assigneeOnly: true }), { uid: 'u1', isAdmin: false })).toBeNull();
    expect(entryBlock({ assigneeUid: 'u2' }, col({ assigneeOnly: true }), { uid: 'u1', isAdmin: true })).toBeNull();
  });
});

describe('modelli di flusso', () => {
  const software = WORKFLOW_TEMPLATES.find(tpl => tpl.id === 'software')!;
  const board = [
    { id: 'todo', title: 'To Do', order: 0, category: 'todo' },
    { id: 'doing', title: 'Doing', order: 1, category: 'progress' },
    { id: 'done', title: 'Done', order: 2, category: 'done' },
    { id: 'extra', title: 'Bloccate', order: 3, category: 'progress' },
    { id: 'old', title: 'Archivio', order: 4, category: 'done' },
  ];
  const tasks = [
    { id: 't1', columnId: 'todo' },
    { id: 't2', columnId: 'old' },
    { id: 't3', columnId: 'old' },
    { id: 't4', columnId: 'done' },
  ];
  let n = 0;
  const plan = planTemplate(software, board, tasks, 'it', () => `new${++n}`);

  it('riusa le colonne per categoria, nell’ordine, e crea quelle che mancano', () => {
    expect(plan.writes.map(w => [w.id, w.data.title])).toEqual([
      ['todo', 'Backlog'], ['new1', 'Da fare'], ['doing', 'In corso'], ['extra', 'In revisione'], ['new2', 'Test'], ['done', 'Completato'],
    ]);
    expect(plan.writes.filter(w => w.isNew).map(w => w.id)).toEqual(['new1', 'new2']);
  });

  it('le colonne in più si eliminano spostando le attività, senza perderne', () => {
    expect(plan.removals).toEqual([{ id: 'old', title: 'Archivio', moveTo: 'done', taskIds: ['t2', 't3'], startOrder: 1 }]);
    expect(planWriteCount(plan)).toBe(6 + 3);
  });

  it('le transizioni del modello diventano colonne bloccate, con gli ID veri', () => {
    const backlog = plan.writes.find(w => w.id === 'todo')!;
    expect(backlog.data.blockedTargets.sort()).toEqual(['doing', 'done', 'extra', 'new2']);
    expect(plan.writes.find(w => w.id === 'done')!.data.entryRules).toEqual({ assignee: true });
    const kanban = planTemplate(WORKFLOW_TEMPLATES[0], board, tasks, 'en', () => 'x');
    expect(kanban.writes.every(w => w.data.blockedTargets.length === 0)).toBe(true);
    expect(kanban.writes.map(w => w.data.title)).toEqual(['To Do', 'In Progress', 'Done']);
  });

  it('ogni modello ha almeno una colonna «Da fare» e una «Completato», e transizioni valide', () => {
    for (const tpl of WORKFLOW_TEMPLATES) {
      expect(tpl.columns.some(c => c.category === 'todo')).toBe(true);
      expect(tpl.columns.some(c => c.category === 'done')).toBe(true);
      const keys = tpl.columns.map(c => c.key);
      expect(new Set(keys).size).toBe(keys.length);
      tpl.columns.forEach(c => (c.to || []).forEach(k => expect(keys).toContain(k)));
    }
  });
});
