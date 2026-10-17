import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/auth';
import { readJsonObject } from '@/lib/server/requestBody';
import { inWorkspace } from '@/lib/server/mcp/access';
import { disabled } from '@/lib/server/mcp/http';
import { setMcpAllowed, workspaceMcpState } from '@/lib/server/mcp/workspaceSettings';

/**
 * Assistenti AI (MCP) per un workspace: stato per i membri, interruttore per
 * proprietario e amministratori (lib/server/mcp/workspaceSettings.ts).
 */
export async function GET(request: Request) {
  const off = disabled();
  if (off) return off;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const workspaceId = new URL(request.url).searchParams.get('workspaceId') || '';
  if (!(await inWorkspace(auth.user.uid, workspaceId))) return NextResponse.json({ error: 'Workspace non trovato.' }, { status: 404 });
  return NextResponse.json(await workspaceMcpState(auth.user.uid, workspaceId));
}

export async function POST(request: Request) {
  const off = disabled();
  if (off) return off;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await readJsonObject(request);
  if (typeof body?.workspaceId !== 'string' || typeof body.allowed !== 'boolean') {
    return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
  }
  if (!(await setMcpAllowed(auth.user.uid, body.workspaceId, body.allowed))) {
    return NextResponse.json({ error: 'Solo il proprietario o un amministratore del workspace può cambiarlo.' }, { status: 403 });
  }
  return NextResponse.json(await workspaceMcpState(auth.user.uid, body.workspaceId));
}
