/**
 * Organizzazione e workspace di un progetto.
 *
 * Il workspace di un'organizzazione ha lo stesso ID dell'organizzazione
 * (lib/orgWorkspace.ts): un progetto in quel workspace lo vedono tutti i
 * membri. Un progetto senza organizzazione sta nel workspace personale di chi
 * lo crea, e lo vede solo lui.
 *
 * Prima il menu dei progetti mostrava il nome del workspace, che non cambia
 * quando si rinomina l'organizzazione, e un progetto nuovo finiva nell'ultimo
 * workspace aperto, qualunque organizzazione si fosse scelta.
 */

interface Named {
  id: string;
  name?: string;
}

interface OwnedWorkspace {
  id: string;
  ownerId?: string;
}

/** Nome dell'organizzazione del progetto, o null se è un progetto personale. */
export function projectOrgName(workspaceId: string | null | undefined, organizations: Named[]): string | null {
  if (!workspaceId) return null;
  return organizations.find(org => org.id === workspaceId)?.name || null;
}

/**
 * Il workspace personale dell'utente: suo e non di un'organizzazione. Se ne ha
 * più di uno, il primo dell'elenco (il più vecchio).
 */
export function personalWorkspaceId(workspaces: OwnedWorkspace[], organizations: Named[], uid: string | null | undefined): string | null {
  if (!uid) return null;
  const orgIds = new Set(organizations.map(org => org.id));
  return workspaces.find(ws => ws.ownerId === uid && !orgIds.has(ws.id))?.id || null;
}

/** Workspace da cui leggere i progetti: quelli con un accesso, più le organizzazioni di cui si fa parte. */
export function projectWorkspaceIds(workspaces: Named[], organizations: Named[]): string[] {
  return Array.from(new Set([...workspaces.map(ws => ws.id), ...organizations.map(org => org.id)]));
}
