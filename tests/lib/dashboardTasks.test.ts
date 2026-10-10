import { describe, expect, it } from 'vitest';

import { isMine, myDashboardTasks, taskStatus } from '@/lib/dashboardTasks';

const columns = [
  { id: 'c1', title: 'Da fare' },
  { id: 'c2', title: 'In lavorazione' },
  { id: 'c3', title: 'Fatto' },
];
const anna = { uid: 'anna', displayName: 'Anna Rossi' };

function task(id: string, columnId: string, extra: Record<string, unknown> = {}) {
  return { id, columnId, assigneeUid: 'anna', priority: 'Medium', ...extra };
}

describe('taskStatus', () => {
  it('lo stato viene dal nome della colonna', () => {
    expect(taskStatus({ columnId: 'c1' }, columns)).toBe('todo');
    expect(taskStatus({ columnId: 'c2' }, columns)).toBe('progress');
    expect(taskStatus({ columnId: 'c3' }, columns)).toBe('done');
    expect(taskStatus({ columnId: 'sparita' }, columns)).toBe('todo');
  });
});

describe('isMine', () => {
  it('per ID; per nome solo le task vecchie senza ID', () => {
    expect(isMine(task('t', 'c1'), anna)).toBe(true);
    expect(isMine(task('t', 'c1', { assigneeUid: 'bruno' }), anna)).toBe(false);
    expect(isMine(task('t', 'c1', { assigneeUid: 'bruno', assignee: 'Anna Rossi' }), anna)).toBe(false);
    expect(isMine({ id: 't', assignee: 'Anna Rossi' }, anna)).toBe(true);
  });

  it('le task assegnate ad altri o a nessuno non sono mie', () => {
    expect(isMine({ id: 't' }, anna)).toBe(false);
    expect(isMine({ id: 't', assignee: 'Bruno' }, anna)).toBe(false);
    expect(isMine({ id: 't' }, { uid: 'anna', displayName: null })).toBe(false);
  });
});

describe('myDashboardTasks', () => {
  it('le task fatte lasciano il posto a quelle da fare', () => {
    const tasks = [
      ...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map(id => task(id, 'c3')),
      task('d1', 'c1'),
      task('d2', 'c2'),
    ];
    const { visible, pendingCount } = myDashboardTasks(tasks, columns, anna);
    expect(pendingCount).toBe(2);
    expect(visible.map(t => t.id)).toEqual(['d1', 'd2', 'f1', 'f2', 'f3', 'f4']);
  });

  it('con 6 o più task da fare quelle fatte non compaiono', () => {
    const tasks = [task('f1', 'c3'), ...['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => task(id, 'c1'))];
    const { visible, pendingCount } = myDashboardTasks(tasks, columns, anna);
    expect(pendingCount).toBe(7);
    expect(visible).toHaveLength(6);
    expect(visible.some(t => t.id === 'f1')).toBe(false);
  });

  it('prima le più urgenti, poi nell’ordine della bacheca', () => {
    const tasks = [
      task('low', 'c1', { priority: 'Low', order: 0 }),
      task('med2', 'c1', { order: 2 }),
      task('crit', 'c1', { priority: 'Critical', order: 5 }),
      task('med1', 'c1', { order: 1 }),
      task('high', 'c2', { priority: 'High', order: 9 }),
    ];
    expect(myDashboardTasks(tasks, columns, anna).visible.map(t => t.id)).toEqual(['crit', 'high', 'med1', 'med2', 'low']);
  });

  it('solo le task dell’utente', () => {
    const tasks = [task('mia', 'c1'), task('altrui', 'c1', { assigneeUid: 'bruno' }), { id: 'nessuno', columnId: 'c1' }];
    expect(myDashboardTasks(tasks, columns, anna).visible.map(t => t.id)).toEqual(['mia']);
  });
});
