import { describe, expect, it } from 'vitest';

import { personalWorkspaceId, projectOrgName, projectWorkspaceIds } from '@/lib/projectWorkspace';

const organizations = [{ id: 'o1', name: 'GMF Labs' }, { id: 'o2', name: 'Labs 33' }];
const workspaces = [
  { id: 'o1', name: 'Luca', ownerId: 'anna' },
  { id: 'p1', name: 'Personal Workspace', ownerId: 'anna' },
  { id: 'p2', name: 'Secondo', ownerId: 'anna' },
  { id: 'p3', name: 'Di Bruno', ownerId: 'bruno' },
];

describe('projectOrgName', () => {
  it('il nome attuale dell’organizzazione, non quello del workspace', () => {
    expect(projectOrgName('o1', organizations)).toBe('GMF Labs');
  });

  it('null per un progetto personale o senza workspace', () => {
    expect(projectOrgName('p1', organizations)).toBeNull();
    expect(projectOrgName(undefined, organizations)).toBeNull();
  });
});

describe('personalWorkspaceId', () => {
  it('il primo workspace dell’utente che non è di un’organizzazione', () => {
    expect(personalWorkspaceId(workspaces, organizations, 'anna')).toBe('p1');
  });

  it('null se non ne ha uno', () => {
    expect(personalWorkspaceId(workspaces, organizations, 'carla')).toBeNull();
    expect(personalWorkspaceId(workspaces.slice(0, 1), organizations, 'anna')).toBeNull();
    expect(personalWorkspaceId(workspaces, organizations, null)).toBeNull();
  });
});

describe('projectWorkspaceIds', () => {
  it('anche le organizzazioni senza workspace, senza doppioni', () => {
    expect(projectWorkspaceIds(workspaces.slice(0, 2), organizations)).toEqual(['o1', 'p1', 'o2']);
  });
});
