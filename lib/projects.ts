import { collection, doc, serverTimestamp, writeBatch, type Firestore } from 'firebase/firestore';

/**
 * Nuovo progetto con la sua board e l'accesso del creatore.
 *
 * Prima il progetto si salvava da solo, le colonne partivano senza attendere
 * e l'accesso arrivava dopo: se una scrittura falliva restava un progetto a
 * metà, e senza workspace attivo la creazione si fermava senza dirlo. Ora è
 * un'unica scrittura, e chi chiama riceve un errore da mostrare.
 */

export type ProjectCreateErrorCode = 'not-signed-in' | 'no-workspace' | 'empty-name' | 'write-failed';

export class ProjectCreateError extends Error {
  constructor(public readonly code: ProjectCreateErrorCode, cause?: unknown) {
    super(`Project creation failed: ${code}`);
    this.name = 'ProjectCreateError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export const DEFAULT_COLUMNS = ['To Do', 'Doing', 'Done'] as const;

export async function createProjectWithBoard(db: Firestore, input: {
  uid: string | null | undefined;
  workspaceId: string | null | undefined;
  name: string;
  organizationIds?: string[];
}): Promise<string> {
  const name = input.name.trim();
  if (!input.uid) throw new ProjectCreateError('not-signed-in');
  if (!input.workspaceId) throw new ProjectCreateError('no-workspace');
  if (!name) throw new ProjectCreateError('empty-name');

  const projectRef = doc(collection(db, 'projects'));
  const batch = writeBatch(db);
  batch.set(projectRef, {
    name,
    userId: input.uid,
    creatorId: input.uid,
    workspaceId: input.workspaceId,
    ...(input.organizationIds?.length ? { organizationIds: input.organizationIds } : {}),
    createdAt: serverTimestamp(),
  });
  DEFAULT_COLUMNS.forEach((title, order) => {
    batch.set(doc(collection(db, 'columns')), {
      projectId: projectRef.id,
      title,
      order,
      createdAt: serverTimestamp(),
    });
  });
  batch.set(doc(db, 'access_grants', `${projectRef.id}_${input.uid}`), {
    workspaceId: input.workspaceId,
    subjectType: 'user',
    subjectId: input.uid,
    resourceType: 'project',
    resourceId: projectRef.id,
    role: 'admin',
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    throw new ProjectCreateError('write-failed', error);
  }
  return projectRef.id;
}

/** Messaggio per l'utente, dalle traduzioni di `tasks`. */
export function projectCreateMessage(error: unknown, t: {
  projectCreateError: string;
  projectNoWorkspace: string;
  projectSignedOut: string;
}): string {
  if (error instanceof ProjectCreateError) {
    if (error.code === 'no-workspace') return t.projectNoWorkspace;
    if (error.code === 'not-signed-in') return t.projectSignedOut;
  }
  return t.projectCreateError;
}
