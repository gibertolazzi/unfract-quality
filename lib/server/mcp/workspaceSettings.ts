import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { canManageWorkspace } from '@/lib/server/usage';
import { validId } from '@/lib/server/mcp/access';

/**
 * Interruttore degli assistenti AI (MCP) per workspace.
 *
 * Il proprietario o un amministratore del workspace può spegnere MCP per
 * tutti i membri: da quel momento nessun assistente collegato a quel
 * workspace legge più nulla, i token non si rinnovano e non se ne possono
 * creare di nuovi. I collegamenti non si cancellano: riaccendendo, tornano a
 * funzionare.
 *
 * Sta in `mcp_settings/{workspaceId}`, chiusa al browser (firestore.rules):
 * il documento del workspace lo possono modificare tutti i membri, questo no.
 * Senza documento MCP è acceso.
 */

const settings = () => adminDb.collection('mcp_settings');

export async function mcpAllowed(workspaceId: string): Promise<boolean> {
  if (!validId(workspaceId)) return false;
  const data = (await settings().doc(workspaceId).get()).data();
  return data?.disabled !== true;
}

/** Quali workspace dell'elenco hanno MCP spento. */
export async function disabledWorkspaces(workspaceIds: string[]): Promise<Set<string>> {
  const disabled = new Set<string>();
  await Promise.all(workspaceIds.map(async id => {
    if (!(await mcpAllowed(id))) disabled.add(id);
  }));
  return disabled;
}

export async function workspaceMcpState(uid: string, workspaceId: string) {
  if (!validId(workspaceId)) return null;
  const [allowed, canManage, grants] = await Promise.all([
    mcpAllowed(workspaceId),
    canManageWorkspace(uid, workspaceId),
    adminDb.collection('mcp_grants').where('workspaceId', '==', workspaceId).get(),
  ]);
  const active = grants.docs.filter(doc => !doc.data()?.revokedAt).length;
  return { allowed, canManage, activeConnections: canManage ? active : null };
}

/** Accende o spegne. `false` se l'utente non è proprietario o amministratore. */
export async function setMcpAllowed(uid: string, workspaceId: string, allowed: boolean): Promise<boolean> {
  if (!validId(workspaceId) || !(await canManageWorkspace(uid, workspaceId))) return false;
  await settings().doc(workspaceId).set({ disabled: !allowed, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
  return true;
}
