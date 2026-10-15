import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Gestione dei membri di un'organizzazione, dal server: espellere, uscire,
 * sospendere, riattivare, cambiare ruolo.
 *
 * Le regole di Firestore non lasciano cambiare dal browser `members` e
 * `memberUids`. Prima non c'era modo di togliere qualcuno: restava membro per
 * sempre.
 *
 * Chi esce dall'organizzazione (espulso o sospeso) perde tutto ciò che la
 * riguarda:
 * - l'accesso al workspace (`memberUids` e il suo `access_grants`);
 * - i progetti che aveva creato lì, che passano al proprietario: chi crea un
 *   progetto lo vede anche fuori dall'organizzazione (firestore.rules,
 *   storage.rules);
 * - le chat dei progetti dell'organizzazione, che si leggono per `members`.
 *
 * Chi è silenziato (`mutedUids`) resta membro ma non scrive nelle chat dei
 * progetti dell'organizzazione: lo bloccano le regole di Firestore.
 *
 * Chi è sospeso resta in `members` con `suspended: true` e i suoi ruoli nei
 * progetti restano: riattivandolo torna come prima. Le chat da cui è uscito
 * si segnano in `org_suspensions`, chiusa al browser.
 */

export type MemberAction = 'remove' | 'suspend' | 'reactivate' | 'role' | 'mute' | 'unmute';
const ACTIONS: MemberAction[] = ['remove', 'suspend', 'reactivate', 'role', 'mute', 'unmute'];
export type MemberRole = 'admin' | 'member';

export type MemberResult =
  | { ok: true; members: OrgMemberEntry[]; memberUids: string[]; memberCount: number; mutedUids: string[] }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

export interface OrgMemberEntry {
  uid: string;
  role?: string;
  suspended?: boolean;
  suspendedAt?: number;
  [key: string]: unknown;
}

interface OrgData {
  ownerId?: string;
  members?: OrgMemberEntry[];
  memberUids?: string[];
  /** Silenziati nelle chat dei progetti: le regole rifiutano i loro messaggi. */
  mutedUids?: string[];
}

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const SUSPENSIONS = 'org_suspensions';
const CHUNK = 400;

/** Membro con accesso: il proprietario, o chi è in `memberUids` (le regole guardano quello). */
export function isActiveOrgMember(org: OrgData | undefined, uid: string): boolean {
  return !!org && !!uid && (org.ownerId === uid || (Array.isArray(org.memberUids) && org.memberUids.includes(uid)));
}

function isAdmin(org: OrgData, uid: string): boolean {
  return org.ownerId === uid
    || (isActiveOrgMember(org, uid) && (org.members || []).some(m => m?.uid === uid && m.role === 'admin'));
}

/**
 * Se `actor` può fare `action` su `target`: null se sì, altrimenti il motivo.
 * - Nessuno tocca il proprietario.
 * - Ognuno può uscire da solo (`remove` su se stesso).
 * - Espellere, sospendere e riattivare: gli admin; un admin solo il
 *   proprietario.
 * - Cambiare ruolo: solo il proprietario.
 * - Silenziare nelle chat: come sospendere.
 */
export function memberActionError(
  org: OrgData, actor: string, target: string, action: MemberAction,
): { status: 403 | 404 | 409; error: string } | null {
  const entry = (org.members || []).find(m => m?.uid === target);
  if (!entry) return { status: 404, error: 'Utente non trovato nell’organizzazione.' };
  if (!isActiveOrgMember(org, actor)) return { status: 403, error: 'Non fai parte di questa organizzazione.' };
  if (target === org.ownerId) {
    return { status: 403, error: 'Il proprietario dell’organizzazione non si può espellere, sospendere o cambiare di ruolo.' };
  }

  if (action === 'remove' && actor === target) return null;
  if (actor === target) return { status: 403, error: 'Non puoi farlo su te stesso.' };

  if (action === 'role') {
    return actor === org.ownerId ? null : { status: 403, error: 'Solo il proprietario può cambiare i ruoli.' };
  }
  if (!isAdmin(org, actor)) return { status: 403, error: 'Solo gli admin possono gestire i membri.' };
  if (entry.role === 'admin' && actor !== org.ownerId) return { status: 403, error: 'Solo il proprietario può farlo su un admin.' };
  if (action === 'suspend' && entry.suspended) return { status: 409, error: 'L’utente è già sospeso.' };
  if (action === 'reactivate' && !entry.suspended) return { status: 409, error: 'L’utente non è sospeso.' };
  const muted = (org.mutedUids || []).includes(target);
  if (action === 'mute' && muted) return { status: 409, error: 'L’utente è già silenziato.' };
  if (action === 'unmute' && !muted) return { status: 409, error: 'L’utente non è silenziato.' };
  return null;
}

/** I nuovi `members` e `memberUids` dopo l'azione. */
export function applyMemberAction(
  org: OrgData, target: string, action: MemberAction, role?: MemberRole, now = Date.now(),
): { members: OrgMemberEntry[]; memberUids: string[] } {
  const members = org.members || [];
  const uids = (org.memberUids || []).filter(uid => uid !== target);
  switch (action) {
    case 'remove':
      return { members: members.filter(m => m?.uid !== target), memberUids: uids };
    case 'suspend':
      return { members: members.map(m => m?.uid === target ? { ...m, suspended: true, suspendedAt: now } : m), memberUids: uids };
    case 'reactivate':
      return {
        members: members.map(m => {
          if (m?.uid !== target) return m;
          const { suspended: _s, suspendedAt: _at, ...rest } = m;
          return rest as OrgMemberEntry;
        }),
        memberUids: [...uids, target],
      };
    case 'role':
      return { members: members.map(m => m?.uid === target ? { ...m, role } : m), memberUids: org.memberUids || [] };
    case 'mute':
    case 'unmute':
      return { members, memberUids: org.memberUids || [] };
  }
}

type Ref = FirebaseFirestore.DocumentReference;

async function inChunks<T>(items: T[], write: (batch: FirebaseFirestore.WriteBatch, item: T) => void): Promise<void> {
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = adminDb.batch();
    items.slice(i, i + CHUNK).forEach(item => write(batch, item));
    await batch.commit();
  }
}

async function orgProjects(orgId: string) {
  return (await adminDb.collection('projects').where('workspaceId', '==', orgId).get()).docs;
}

/** I progetti creati da `uid` nel workspace passano al proprietario. */
async function transferProjects(projects: FirebaseFirestore.QueryDocumentSnapshot[], uid: string, ownerId: string): Promise<void> {
  const owned = projects.filter(p => p.data().userId === uid || p.data().creatorId === uid);
  await inChunks(owned, (batch, p) => {
    const data = p.data();
    batch.update(p.ref, {
      ...(data.userId === uid ? { userId: ownerId } : {}),
      ...(data.creatorId === uid ? { creatorId: ownerId } : {}),
      transferredFrom: uid,
    });
  });
}

/** Toglie `uid` dalle chat dei progetti dell'organizzazione; restituisce quali. */
async function leaveProjectChats(projectIds: Set<string>, uid: string): Promise<string[]> {
  const chats = (await adminDb.collection('chats').where('members', 'array-contains', uid).get()).docs
    .filter(chat => projectIds.has(chat.data().projectId));
  await inChunks(chats, (batch, chat) => batch.update(chat.ref, { members: FieldValue.arrayRemove(uid) }));
  return chats.map(chat => chat.id);
}

async function grantsOf(orgId: string, uid: string): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  return (await adminDb.collection('access_grants').where('subjectId', '==', uid).get()).docs
    .filter(g => g.data().workspaceId === orgId && g.data().subjectType === 'user');
}

async function deleteRefs(refs: Ref[]): Promise<void> {
  await inChunks(refs, (batch, ref) => batch.delete(ref));
}

export async function manageOrgMember(actor: string, input: {
  orgId: string; uid: string; action: MemberAction; role?: MemberRole;
}): Promise<MemberResult> {
  const { orgId, uid: target, action, role } = input;
  if (!ID.test(orgId) || !ID.test(target)) return { ok: false, status: 400, error: 'Richiesta non valida.' };
  if (!ACTIONS.includes(action)) return { ok: false, status: 400, error: 'Azione non valida.' };
  if (action === 'role' && role !== 'admin' && role !== 'member') return { ok: false, status: 400, error: 'Ruolo non valido.' };

  const orgRef = adminDb.collection('organizations').doc(orgId);
  const outcome = await adminDb.runTransaction(async tx => {
    const snap = await tx.get(orgRef);
    if (!snap.exists) return { ok: false as const, status: 404 as const, error: 'Organizzazione non trovata.' };
    const org = (snap.data() || {}) as OrgData;
    const denied = memberActionError(org, actor, target, action);
    if (denied) return { ok: false as const, ...denied };

    const next = applyMemberAction(org, target, action, role);
    const previous = (org.members || []).find(m => m?.uid === target);
    const others = (org.mutedUids || []).filter(uid => uid !== target);
    const mutedUids = action === 'mute' ? [...others, target] : action === 'unmute' || action === 'remove' ? others : org.mutedUids || [];
    tx.update(orgRef, { members: next.members, memberUids: next.memberUids, memberCount: next.memberUids.length, mutedUids });
    return { ok: true as const, next, mutedUids, ownerId: org.ownerId || '', previousRole: previous?.role === 'admin' ? 'admin' : 'member' };
  });
  if (!outcome.ok) return outcome;

  const { next, mutedUids, ownerId, previousRole } = outcome;
  const suspensionRef = adminDb.collection(SUSPENSIONS).doc(`${orgId}_${target}`);

  if (action === 'role') {
    const grants = (await grantsOf(orgId, target)).filter(g => g.data().resourceType === 'workspace');
    await inChunks(grants, (batch, g) => batch.update(g.ref, { role }));
  } else if (action === 'remove' || action === 'suspend') {
    const projects = await orgProjects(orgId);
    const projectIds = new Set(projects.map(p => p.id));
    await transferProjects(projects, target, ownerId);
    const chatIds = await leaveProjectChats(projectIds, target);
    const grants = await grantsOf(orgId, target);

    if (action === 'remove') {
      // Ruoli nei progetti, accessi (workspace, progetti, squadre) e l'eventuale sospensione.
      const roles = (await adminDb.collection('project_members').where('userId', '==', target).get()).docs
        .filter(d => projectIds.has(d.data().projectId));
      await deleteRefs([...grants.map(g => g.ref), ...roles.map(r => r.ref), suspensionRef]);
    } else {
      // Solo l'accesso al workspace: ruoli e squadre restano per quando torna.
      await deleteRefs(grants.filter(g => g.data().resourceType === 'workspace').map(g => g.ref));
      const earlier = (await suspensionRef.get()).data()?.chatIds || [];
      await suspensionRef.set({
        orgId, uid: target, chatIds: Array.from(new Set([...earlier, ...chatIds])), suspendedAt: Date.now(), suspendedBy: actor,
      });
    }
  } else if (action === 'reactivate') {
    // Riattivazione: accesso al workspace con il suo ruolo, e le chat da cui era uscito.
    await adminDb.collection('access_grants').doc(`${orgId}_${target}`).set({
      workspaceId: orgId, subjectType: 'user', subjectId: target,
      resourceType: 'workspace', resourceId: orgId, role: previousRole, createdAt: FieldValue.serverTimestamp(),
    });
    const chatIds: string[] = (await suspensionRef.get()).data()?.chatIds || [];
    const chatRefs = chatIds.map(id => adminDb.collection('chats').doc(id));
    const chatSnaps = await Promise.all(chatRefs.map(ref => ref.get()));
    const stillThere = chatRefs.filter((_, i) => chatSnaps[i].exists);
    await inChunks(stillThere, (batch, ref) => batch.update(ref, { members: FieldValue.arrayUnion(target) }));
    await suspensionRef.delete();
  }

  return { ok: true, members: next.members, memberUids: next.memberUids, memberCount: next.memberUids.length, mutedUids };
}
