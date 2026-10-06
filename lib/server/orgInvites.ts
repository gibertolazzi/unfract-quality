import { createHash, randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/firebase-admin';
import type { AuthenticatedUser } from '@/lib/server/auth';

/**
 * Inviti alle organizzazioni.
 *
 * Prima il link era `/invite/{orgId}`: bastava conoscere l'ID di
 * un'organizzazione per entrarci, quando si voleva, e l'aggiunta la faceva il
 * browser scrivendo direttamente su Firestore (segnalazione S16).
 *
 * Ora un invito è un codice casuale con scadenza. Nel database si salva solo
 * l'impronta SHA-256 del codice: chi riesce a leggere la collezione non trova
 * codici utilizzabili. L'accettazione la fa il server, che controlla codice,
 * scadenza e, per gli inviti via email, che chi accetta sia il destinatario.
 *
 * - `email`: legato a un indirizzo, si usa una volta sola;
 * - `link`: da condividere, vale per chiunque abbia il link fino alla scadenza.
 */

export const INVITES = 'org_invites';
export const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

export type InviteKind = 'email' | 'link';

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isOrgMember(org: Record<string, any> | undefined, uid: string): boolean {
  return !!org && (
    org.ownerId === uid
    || (Array.isArray(org.memberUids) && org.memberUids.includes(uid))
    || (Array.isArray(org.members) && org.members.some((member: any) => member?.uid === uid))
  );
}

/** Crea un invito e restituisce il codice in chiaro, da mettere nel link. */
export async function createOrgInvite(input: {
  orgId: string;
  invitedBy: string;
  kind: InviteKind;
  email?: string;
}): Promise<{ token: string; expiresAt: number }> {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + INVITE_TTL_MS;
  await adminDb.collection(INVITES).doc(hashInviteToken(token)).set({
    orgId: input.orgId,
    kind: input.kind,
    email: input.kind === 'email' ? (input.email || '').toLowerCase() : null,
    invitedBy: input.invitedBy,
    createdAt: Date.now(),
    expiresAt,
    usedAt: null,
    usedBy: null,
  });
  return { token, expiresAt };
}

export type AcceptResult =
  | { ok: true; orgId: string; alreadyMember: boolean }
  | { ok: false; status: number; error: string };

const INVALID: AcceptResult = { ok: false, status: 404, error: 'Invito non valido o scaduto. Chiedi un nuovo invito.' };

/** Accetta un invito per l'utente del token Firebase. */
export async function acceptOrgInvite(token: string, user: AuthenticatedUser): Promise<AcceptResult> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return INVALID;
  const inviteRef = adminDb.collection(INVITES).doc(hashInviteToken(token));

  const result: AcceptResult = await adminDb.runTransaction(async transaction => {
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists) return INVALID;
    const invite = inviteSnap.data() || {};

    if (typeof invite.expiresAt !== 'number' || invite.expiresAt < Date.now()) return INVALID;
    if (invite.kind === 'email') {
      if (invite.usedAt) return INVALID;
      if (!user.email || user.email.toLowerCase() !== invite.email) {
        return { ok: false, status: 403, error: `Questo invito è per ${invite.email}. Accedi con quell’indirizzo.` };
      }
    } else if (invite.kind !== 'link') {
      return INVALID;
    }

    const orgRef = adminDb.collection('organizations').doc(String(invite.orgId));
    const orgSnap = await transaction.get(orgRef);
    if (!orgSnap.exists) return INVALID;
    const org = orgSnap.data() || {};

    if (isOrgMember(org, user.uid)) {
      return { ok: true, orgId: orgRef.id, alreadyMember: true };
    }

    const members = Array.isArray(org.members) ? org.members : [];
    const memberUids = Array.isArray(org.memberUids) ? org.memberUids : [];
    transaction.update(orgRef, {
      members: [...members, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.name || 'Utente',
        photoURL: user.picture || '',
        initials: (user.name || 'U').charAt(0).toUpperCase(),
        role: 'member',
      }],
      memberUids: [...memberUids, user.uid],
      memberCount: (typeof org.memberCount === 'number' ? org.memberCount : members.length) + 1,
    });
    if (invite.kind === 'email') {
      transaction.update(inviteRef, { usedAt: Date.now(), usedBy: user.uid });
    }
    return { ok: true, orgId: orgRef.id, alreadyMember: false };
  });

  if (result.ok) await ensureWorkspaceGrant(result.orgId, user.uid);
  return result;
}

/**
 * Stesso accesso che dava la vecchia pagina di invito: un `access_grants` sul
 * workspace con l'ID dell'organizzazione. Non lo duplica se c'è già.
 */
async function ensureWorkspaceGrant(orgId: string, uid: string): Promise<void> {
  const existing = await adminDb.collection('access_grants').where('subjectId', '==', uid).get();
  const has = existing.docs.some(grant => {
    const g = grant.data();
    return g.subjectType === 'user' && g.resourceType === 'workspace' && g.workspaceId === orgId;
  });
  if (has) return;

  await adminDb.collection('access_grants').doc(`${orgId}_${uid}`).set({
    workspaceId: orgId,
    subjectType: 'user',
    subjectId: uid,
    resourceType: 'workspace',
    resourceId: orgId,
    role: 'member',
    createdAt: new Date(),
  });
}
