import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/requestBody';
import { userWorkspaces } from '@/lib/server/mcp/access';
import { disabled } from '@/lib/server/mcp/http';
import { listConnections, revokeConnection } from '@/lib/server/mcp/tokens';

/** Gli assistenti collegati dall'utente (impostazioni): elenco e revoca. */
export async function GET(request: Request) {
  const off = disabled();
  if (off) return off;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const [connections, workspaces] = await Promise.all([listConnections(auth.user.uid), userWorkspaces(auth.user.uid)]);
  const names = new Map(workspaces.map(ws => [ws.id, ws.name]));
  return NextResponse.json({
    connections: connections.map(c => ({ ...c, workspaceName: names.get(c.workspaceId) || null })),
  });
}

export async function POST(request: Request) {
  const off = disabled();
  if (off) return off;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await readJsonObject(request);
  if (body?.action !== 'revoke') return NextResponse.json({ error: 'Azione sconosciuta.' }, { status: 400 });
  if (!(await revokeConnection(auth.user.uid, body.id))) return NextResponse.json({ error: 'Collegamento non trovato.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
