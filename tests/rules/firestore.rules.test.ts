import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { createProjectWithBoard as createProjectWith, ProjectCreateError } from '../../lib/projects';

// Il Firestore dell'emulatore ha il tipo "compat", ma va bene alle funzioni modulari.
const createProjectWithBoard = (db: unknown, input: Parameters<typeof createProjectWith>[1]) =>
  createProjectWith(db as Firestore, input);

/**
 * Regole di Firestore sull'emulatore. Ogni caso riproduce un'operazione che
 * l'app fa davvero dal browser (deve passare) o un abuso (deve fallire).
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-unfract',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/anna'), { email: 'anna@example.com', plan: 'free', settings: { timezone: 'Europe/Rome' } });
    await setDoc(doc(db, 'users/anna/integrations/google'), { accessToken: 'secret', refreshToken: 'secret' });
    await setDoc(doc(db, 'users/anna/events/e1'), { title: 'Call', startTime: '09:00' });
    await setDoc(doc(db, 'workspaces/w1'), {
      name: 'Acme', ownerId: 'anna', structureMode: 'teams',
      quotas: { planTier: 'free', storageUsed: 0, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120 },
    });
    await setDoc(doc(db, 'workspaces/legacy'), { name: 'Vecchio', ownerId: 'anna' });
    await setDoc(doc(db, 'notifications/n1'), { userId: 'anna', title: 'Task', read: false });
    await setDoc(doc(db, 'ai_chats/c1'), { userId: 'anna', projectId: 'p1', title: 'Chat', messages: [] });
    await setDoc(doc(db, 'org_invites/hash'), { orgId: 'o1', kind: 'link' });
    await setDoc(doc(db, 'projects/p1'), { name: 'Progetto', workspaceId: 'w1', userId: 'anna' });

    // Fase 2: organizzazione o1 (anna e carla) con il suo workspace e progetto.
    await setDoc(doc(db, 'organizations/o1'), {
      name: 'Acme', ownerId: 'anna', memberUids: ['anna', 'carla'],
      members: [{ uid: 'anna', role: 'admin' }, { uid: 'carla', role: 'member' }],
    });
    await setDoc(doc(db, 'organizations/o-nuova'), { name: 'Nuova', ownerId: 'anna', memberUids: ['anna'], members: [{ uid: 'anna', role: 'admin' }] });
    await setDoc(doc(db, 'workspaces/o1'), { name: 'Acme', ownerId: 'anna', quotas: { planTier: 'free', storageUsed: 0, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120 } });
    await setDoc(doc(db, 'projects/po'), { name: 'Sito Acme', workspaceId: 'o1', userId: 'anna', creatorId: 'anna', organizationIds: ['o1'] });
    await setDoc(doc(db, 'tasks/t1'), { title: 'Task Acme', projectId: 'po' });
    await setDoc(doc(db, 'tasks/tp'), { title: 'Task personale', projectId: 'p1' });
    await setDoc(doc(db, 'crm_accounts/a1'), { name: 'Cliente', projectId: 'po', organizationId: 'o1' });
    await setDoc(doc(db, 'project_members/po_carla'), { projectId: 'po', userId: 'carla', roleId: 'r1' });
    await setDoc(doc(db, 'chats/ch1'), { projectId: 'po', type: 'group', members: ['anna', 'carla'] });
    await setDoc(doc(db, 'messages/m1'), { chatId: 'ch1', senderId: 'anna', text: 'Ciao', readBy: ['anna'] });
    await setDoc(doc(db, 'access_grants/o1_anna'), { workspaceId: 'o1', subjectType: 'user', subjectId: 'anna', resourceType: 'workspace', resourceId: 'o1', role: 'admin' });
    await setDoc(doc(db, 'access_grants/o1_carla'), { workspaceId: 'o1', subjectType: 'user', subjectId: 'carla', resourceType: 'workspace', resourceId: 'o1', role: 'member' });
    await setDoc(doc(db, 'workspace_groups/g1'), { name: 'Vendite', workspaceId: 'o1' });
  });
});

const anna = () => env.authenticatedContext('anna', { email: 'anna@example.com' }).firestore();
const bruno = () => env.authenticatedContext('bruno', { email: 'bruno@example.com' }).firestore();
const carla = () => env.authenticatedContext('carla', { email: 'carla@example.com' }).firestore();
const guest = () => env.unauthenticatedContext().firestore();

describe('profili utente', () => {
  it('ognuno legge e aggiorna il proprio profilo', async () => {
    await assertSucceeds(getDoc(doc(anna(), 'users/anna')));
    await assertSucceeds(setDoc(doc(anna(), 'users/anna'), { settings: { timezone: 'Europe/London' } }, { merge: true }));
    await assertSucceeds(setDoc(doc(anna(), 'users/anna'), { bookingDuration: 45, availability: {} }, { merge: true }));
    await assertSucceeds(setDoc(doc(anna(), 'users/anna'), { lastLogin: new Date().toISOString(), displayName: 'Anna' }, { merge: true }));
  });

  it('nessuno legge o modifica il profilo di un altro', async () => {
    await assertFails(getDoc(doc(bruno(), 'users/anna')));
    await assertFails(setDoc(doc(bruno(), 'users/anna'), { displayName: 'x' }, { merge: true }));
    await assertFails(getDoc(doc(guest(), 'users/anna')));
  });

  it('la registrazione crea il profilo con il piano free', async () => {
    await assertSucceeds(setDoc(doc(bruno(), 'users/bruno'), {
      displayName: 'Bruno', email: 'bruno@example.com', photoURL: null, plan: 'free', createdAt: new Date(),
    }, { merge: true }));
  });

  it('il piano e l’abbonamento non si cambiano dal browser', async () => {
    await assertFails(setDoc(doc(anna(), 'users/anna'), { plan: 'pro' }, { merge: true }));
    await assertFails(updateDoc(doc(anna(), 'users/anna'), { subscriptionStatus: 'active' }));
    await assertFails(updateDoc(doc(anna(), 'users/anna'), { role: 'admin' }));
    await assertFails(setDoc(doc(bruno(), 'users/bruno'), { plan: 'enterprise' }));
    await assertFails(setDoc(doc(bruno(), 'users/bruno'), { stripeCustomerId: 'cus_x' }));
  });

  it('gli eventi del calendario sono solo del proprietario', async () => {
    await assertSucceeds(getDocs(collection(anna(), 'users/anna/events')));
    await assertSucceeds(setDoc(doc(anna(), 'users/anna/events/e2'), { title: 'Nuovo' }));
    await assertSucceeds(deleteDoc(doc(anna(), 'users/anna/events/e1')));
    await assertFails(getDocs(collection(bruno(), 'users/anna/events')));
    await assertFails(setDoc(doc(bruno(), 'users/anna/events/e3'), { title: 'Intruso' }));
  });

  it('i token dei calendari non li legge nemmeno il proprietario', async () => {
    await assertFails(getDoc(doc(anna(), 'users/anna/integrations/google')));
    await assertFails(getDoc(doc(bruno(), 'users/anna/integrations/google')));
    await assertFails(setDoc(doc(anna(), 'users/anna/integrations/google'), { accessToken: 'x' }));
  });
});

describe('workspace', () => {
  it('creazione dalla schermata iniziale, con i limiti del piano free', async () => {
    await assertSucceeds(addDoc(collection(bruno(), 'workspaces'), {
      name: 'Nuovo', ownerId: 'bruno', structureMode: 'teams',
      quotas: { planTier: 'free', storageUsed: 0, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120 },
      createdAt: serverTimestamp(),
    }));
  });

  it('cambio di struttura su un workspace che non esisteva ancora', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'workspaces/o-nuova'), { structureMode: 'flat' }, { merge: true }));
  });

  it('non si crea un workspace a nome di un altro o con un piano superiore', async () => {
    await assertFails(addDoc(collection(bruno(), 'workspaces'), { name: 'X', ownerId: 'anna' }));
    await assertFails(addDoc(collection(bruno(), 'workspaces'), { name: 'X', ownerId: 'bruno', quotas: { planTier: 'pro' } }));
    await assertFails(addDoc(collection(bruno(), 'workspaces'), { name: 'X', ownerId: 'bruno', quotas: { aiCreditsLimit: 100000 } }));
  });

  it('contatori di consumo e limiti non si cambiano dal browser', async () => {
    await assertSucceeds(updateDoc(doc(anna(), 'workspaces/w1'), { name: 'Acme srl', bannerGradient: 'x' }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.aiCreditsUsed': 5, 'quotas.aiCreditsPeriod': '2026-10' }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.storageUsed': increment(2048) }));
    await assertFails(updateDoc(doc(bruno(), 'workspaces/w1'), { 'quotas.storageUsed': 1 }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.aiCreditsPeriod': '2020-01' }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.planTier': 'enterprise' }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.aiCreditsLimit': 99999 }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.storageLimit': 1e12 }));
  });

  it('i limiti mancanti si riempiono solo con i valori predefiniti, i contatori no', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'workspaces/legacy'), {
      quotas: { planTier: 'free', storageLimit: 1_000_000_000, aiCreditsLimit: 120 },
    }, { merge: true }));
    await assertFails(setDoc(doc(anna(), 'workspaces/legacy'), { quotas: { storageUsed: 0 } }, { merge: true }));
  });

  it('un workspace nuovo parte con i contatori a zero', async () => {
    await assertFails(addDoc(collection(bruno(), 'workspaces'), { name: 'X', ownerId: 'bruno', quotas: { storageUsed: 5 } }));
    await assertFails(addDoc(collection(bruno(), 'workspaces'), { name: 'X', ownerId: 'bruno', quotas: { aiCreditsUsed: -100 } }));
  });

  it('le quote mancanti non si riempiono con un piano superiore', async () => {
    await assertFails(setDoc(doc(anna(), 'workspaces/legacy'), { quotas: { planTier: 'pro' } }, { merge: true }));
  });

  it('il proprietario non si cambia', async () => {
    await assertFails(updateDoc(doc(bruno(), 'workspaces/w1'), { ownerId: 'bruno' }));
    await assertFails(deleteDoc(doc(bruno(), 'workspaces/w1')));
  });

  it('l’abbonamento (billing) lo scrive solo il server', async () => {
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { billing: { subscriptionStatus: 'active', plan: 'scale' } }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'billing.subscriptionStatus': 'canceled' }));
    await assertFails(addDoc(collection(bruno(), 'workspaces'), { name: 'X', ownerId: 'bruno', billing: { plan: 'pro' } }));
    await assertFails(setDoc(doc(anna(), 'workspaces/legacy'), { billing: { plan: 'pro' } }, { merge: true }));
  });
});

describe('organizzazioni con il loro workspace (lib/orgWorkspace.ts)', () => {
  it('organizzazione, workspace e accesso del creatore in un’unica scrittura', async () => {
    const db = bruno();
    const orgRef = doc(collection(db, 'organizations'));
    const batch = writeBatch(db);
    batch.set(orgRef, { name: 'Nuova', ownerId: 'bruno', memberUids: ['bruno'], members: [{ uid: 'bruno', role: 'admin' }], createdAt: serverTimestamp() });
    batch.set(doc(db, 'workspaces', orgRef.id), {
      name: 'Nuova', ownerId: 'bruno', structureMode: 'teams',
      quotas: { planTier: 'free', storageUsed: 0, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120 },
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'access_grants', `${orgRef.id}_bruno`), {
      workspaceId: orgRef.id, subjectType: 'user', subjectId: 'bruno', resourceType: 'workspace', resourceId: orgRef.id, role: 'admin', createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it('un workspace rimasto senza nome si completa senza cambiarne il proprietario', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'workspaces/senza-nome'), { structureMode: 'flat' });
      await setDoc(doc(context.firestore(), 'organizations/senza-nome'), { name: 'Acme', ownerId: 'anna', memberUids: ['anna'] });
    });
    await assertSucceeds(setDoc(doc(anna(), 'workspaces/senza-nome'), { name: 'Acme' }, { merge: true }));
  });
});

describe('progetti (lib/projects.ts)', () => {
  it('progetto, colonne e accesso del creatore in un’unica scrittura', async () => {
    const db = anna();
    const projectId = await assertSucceeds(createProjectWithBoard(db, {
      uid: 'anna', workspaceId: 'w1', name: '  Sito  ', organizationIds: ['o1'],
    }));
    await env.withSecurityRulesDisabled(async context => {
      const admin = context.firestore();
      const project = await getDoc(doc(admin, 'projects', projectId));
      expect(project.data()).toMatchObject({ name: 'Sito', workspaceId: 'w1', userId: 'anna', organizationIds: ['o1'] });
      const columns = await getDocs(query(collection(admin, 'columns'), where('projectId', '==', projectId)));
      expect(columns.docs.map(c => c.data().title).sort()).toEqual(['Doing', 'Done', 'To Do']);
      const grant = await getDoc(doc(admin, 'access_grants', `${projectId}_anna`));
      expect(grant.data()).toMatchObject({ resourceType: 'project', resourceId: projectId, role: 'admin', workspaceId: 'w1' });
    });
  });

  it('senza workspace attivo non scrive nulla e lo dice', async () => {
    await expect(createProjectWithBoard(anna(), { uid: 'anna', workspaceId: null, name: 'Sito' }))
      .rejects.toMatchObject({ code: 'no-workspace' });
    await expect(createProjectWithBoard(anna(), { uid: 'anna', workspaceId: 'w1', name: '   ' }))
      .rejects.toBeInstanceOf(ProjectCreateError);
  });

  it('chi non ha fatto il login riceve un errore, non un progetto a metà', async () => {
    await expect(createProjectWithBoard(guest(), { uid: 'anna', workspaceId: 'w1', name: 'Sito' }))
      .rejects.toMatchObject({ code: 'write-failed' });
    await env.withSecurityRulesDisabled(async context => {
      const projects = await getDocs(query(collection(context.firestore(), 'projects'), where('name', '==', 'Sito')));
      expect(projects.empty).toBe(true);
    });
  });
});

describe('notifiche', () => {
  it('il destinatario le legge, le segna come lette e le cancella', async () => {
    await assertSucceeds(getDocs(query(collection(anna(), 'notifications'), where('userId', '==', 'anna'))));
    await assertSucceeds(updateDoc(doc(anna(), 'notifications/n1'), { read: true }));
    await assertSucceeds(deleteDoc(doc(anna(), 'notifications/n1')));
  });

  it('chiunque abbia fatto il login può avvisare un altro utente', async () => {
    await assertSucceeds(addDoc(collection(bruno(), 'notifications'), {
      userId: 'anna', title: 'Nuova Richiesta di Accesso', description: '...', type: 'access_request', read: false, createdAt: serverTimestamp(),
    }));
  });

  it('chi manda una notifica si firma con il proprio ID, non con quello di altri', async () => {
    await assertSucceeds(addDoc(collection(bruno(), 'notifications'), { userId: 'anna', title: 'Task', type: 'task', senderId: 'bruno', read: false }));
    await assertFails(addDoc(collection(bruno(), 'notifications'), { userId: 'anna', title: 'Task', type: 'task', senderId: 'carla', read: false }));
  });

  it('le notifiche altrui non si leggono né si modificano', async () => {
    await assertFails(getDoc(doc(bruno(), 'notifications/n1')));
    await assertFails(getDocs(collection(bruno(), 'notifications')));
    await assertFails(updateDoc(doc(bruno(), 'notifications/n1'), { read: true }));
    await assertFails(deleteDoc(doc(bruno(), 'notifications/n1')));
    await assertFails(updateDoc(doc(anna(), 'notifications/n1'), { title: 'Cambiata' }));
  });
});

describe('chat AI', () => {
  it('le proprie chat: lista, creazione, aggiornamento', async () => {
    await assertSucceeds(getDocs(query(collection(anna(), 'ai_chats'), where('projectId', '==', 'p1'), where('userId', '==', 'anna'))));
    await assertSucceeds(addDoc(collection(anna(), 'ai_chats'), { projectId: 'p1', userId: 'anna', title: 'New chat...', messages: [] }));
    await assertSucceeds(updateDoc(doc(anna(), 'ai_chats/c1'), { title: 'Riassunto' }));
  });

  it('le chat degli altri no', async () => {
    await assertFails(getDoc(doc(bruno(), 'ai_chats/c1')));
    await assertFails(getDocs(query(collection(bruno(), 'ai_chats'), where('projectId', '==', 'p1'))));
    await assertFails(addDoc(collection(bruno(), 'ai_chats'), { projectId: 'p1', userId: 'anna', messages: [] }));
    await assertFails(updateDoc(doc(anna(), 'ai_chats/c1'), { userId: 'bruno' }));
  });
});

describe('collezioni del server', () => {
  it('chiuse al browser, anche a chi ha fatto il login', async () => {
    for (const path of ['org_invites/hash', 'oauth_states/s', 'calendar_channels/c', 'booking_locks/l', 'notifications_queue/q', 'storage_usage/u', 'rate_limits/r', 'org_suspensions/o1_carla']) {
      await assertFails(getDoc(doc(anna(), path)));
      await assertFails(setDoc(doc(anna(), path), { x: 1 }));
    }
    await assertFails(getDocs(collection(anna(), 'org_invites')));
  });
});

describe('fase 2: ogni azienda vede solo i propri dati', () => {
  it('i membri dell’organizzazione usano progetto, task e CRM', async () => {
    await assertSucceeds(getDoc(doc(carla(), 'projects/po')));
    await assertSucceeds(getDocs(query(collection(carla(), 'projects'), where('workspaceId', 'in', ['o1']))));
    await assertSucceeds(getDocs(query(collection(carla(), 'tasks'), where('projectId', '==', 'po'))));
    await assertSucceeds(addDoc(collection(carla(), 'tasks'), { title: 'Nuovo', projectId: 'po' }));
    await assertSucceeds(updateDoc(doc(carla(), 'tasks/t1'), { title: 'Rinominato' }));
    await assertSucceeds(getDocs(query(collection(carla(), 'crm_accounts'), where('projectId', '==', 'po'))));
    await assertSucceeds(deleteDoc(doc(carla(), 'tasks/t1')));
  });

  it('chi è fuori dall’organizzazione non vede e non scrive niente', async () => {
    await assertFails(getDoc(doc(bruno(), 'projects/po')));
    await assertFails(getDocs(query(collection(bruno(), 'projects'), where('workspaceId', 'in', ['o1']))));
    await assertFails(getDocs(query(collection(bruno(), 'tasks'), where('projectId', '==', 'po'))));
    await assertFails(getDoc(doc(bruno(), 'tasks/t1')));
    await assertFails(addDoc(collection(bruno(), 'tasks'), { title: 'Intruso', projectId: 'po' }));
    await assertFails(updateDoc(doc(bruno(), 'tasks/t1'), { title: 'x' }));
    await assertFails(deleteDoc(doc(bruno(), 'tasks/t1')));
    await assertFails(getDocs(query(collection(bruno(), 'crm_accounts'), where('projectId', '==', 'po'))));
    await assertFails(addDoc(collection(bruno(), 'crm_accounts'), { name: 'x', projectId: 'po' }));
  });

  it('il workspace personale lo vede solo il proprietario', async () => {
    await assertSucceeds(getDocs(query(collection(anna(), 'tasks'), where('projectId', '==', 'p1'))));
    await assertFails(getDocs(query(collection(carla(), 'tasks'), where('projectId', '==', 'p1'))));
    await assertFails(getDoc(doc(carla(), 'projects/p1')));
    await assertFails(getDoc(doc(carla(), 'workspaces/w1')));
  });

  it('le ricerche senza filtro per progetto o workspace sono rifiutate', async () => {
    await assertFails(getDocs(collection(anna(), 'tasks')));
    await assertFails(getDocs(collection(anna(), 'projects')));
    await assertFails(getDocs(collection(anna(), 'organizations')));
    await assertFails(getDocs(collection(anna(), 'workspaces')));
  });

  it('un task non si sposta in un progetto di altri', async () => {
    await assertFails(updateDoc(doc(carla(), 'tasks/t1'), { projectId: 'p1' }));
  });

  it('i progetti si creano solo nel proprio workspace e non cambiano proprietario', async () => {
    await assertSucceeds(createProjectWithBoard(carla(), { uid: 'carla', workspaceId: 'o1', name: 'Di Carla' }));
    await expect(createProjectWithBoard(bruno(), { uid: 'bruno', workspaceId: 'o1', name: 'Intruso' }))
      .rejects.toMatchObject({ code: 'write-failed' });
    await assertSucceeds(updateDoc(doc(carla(), 'projects/po'), { name: 'Sito nuovo' }));
    await assertFails(updateDoc(doc(carla(), 'projects/po'), { workspaceId: 'w1' }));
    await assertFails(updateDoc(doc(carla(), 'projects/po'), { userId: 'carla' }));
    await assertFails(deleteDoc(doc(anna(), 'projects/po')));
  });

  it('organizzazioni: le vede e le modifica solo chi ne fa parte, i membri li cambia il server', async () => {
    await assertSucceeds(getDocs(query(collection(carla(), 'organizations'), where('memberUids', 'array-contains', 'carla'))));
    await assertSucceeds(getDocs(query(collection(bruno(), 'organizations'), where('memberUids', 'array-contains', 'bruno'))));
    await assertSucceeds(updateDoc(doc(carla(), 'organizations/o1'), { name: 'Acme srl' }));
    await assertFails(updateDoc(doc(carla(), 'organizations/o1'), { memberUids: ['anna', 'carla', 'bruno'] }));
    await assertFails(updateDoc(doc(carla(), 'organizations/o1'), { ownerId: 'carla' }));
    await assertFails(getDoc(doc(bruno(), 'organizations/o1')));
    await assertFails(updateDoc(doc(bruno(), 'organizations/o1'), { name: 'x' }));
    await assertFails(setDoc(doc(bruno(), 'organizations/finta'), { ownerId: 'bruno', memberUids: ['bruno', 'anna'] }));
    await assertFails(deleteDoc(doc(anna(), 'organizations/o1')));
  });

  it('il workspace dell’organizzazione lo usano i membri', async () => {
    await assertSucceeds(getDoc(doc(carla(), 'workspaces/o1')));
    await assertSucceeds(updateDoc(doc(carla(), 'workspaces/o1'), { structureMode: 'flat' }));
    await assertFails(getDoc(doc(bruno(), 'workspaces/o1')));
    await assertFails(updateDoc(doc(bruno(), 'workspaces/o1'), { name: 'x' }));
    await assertSucceeds(getDoc(doc(bruno(), 'workspaces/non-esiste')));
  });

  it('rinominare l’organizzazione rinomina anche il suo workspace (OrgDetail)', async () => {
    await assertSucceeds(updateDoc(doc(carla(), 'organizations/o1'), { name: 'Acme srl' }));
    await assertSucceeds(updateDoc(doc(carla(), 'workspaces/o1'), { name: 'Acme srl' }));
  });

  it('progetto senza organizzazione: nel workspace personale, lo vede solo chi lo crea', async () => {
    // Come createPersonalWorkspace (lib/orgWorkspace.ts), se l'utente non ne ha uno.
    const db = carla();
    const workspaceRef = doc(collection(db, 'workspaces'));
    const workspaceId = workspaceRef.id;
    const batch = writeBatch(db);
    batch.set(workspaceRef, {
      name: 'Personal Workspace', ownerId: 'carla', structureMode: 'teams',
      quotas: { planTier: 'free', storageUsed: 0, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120 },
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'access_grants', `${workspaceId}_carla`), {
      workspaceId, subjectType: 'user', subjectId: 'carla', resourceType: 'workspace', resourceId: workspaceId, role: 'admin', createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    const projectId = await assertSucceeds(createProjectWithBoard(carla(), { uid: 'carla', workspaceId, name: 'Mio' }));
    await assertSucceeds(getDoc(doc(carla(), 'projects', projectId)));
    await assertFails(getDoc(doc(anna(), 'projects', projectId)));
  });

  it('progetto in un’organizzazione di cui manca il workspace: lo creano e lo cercano i membri', async () => {
    const projectId = await assertSucceeds(createProjectWithBoard(anna(), {
      uid: 'anna', workspaceId: 'o-nuova', name: 'Nuovo', organizationIds: ['o-nuova'],
    }));
    const found = await assertSucceeds(getDocs(query(collection(anna(), 'projects'), where('workspaceId', 'in', ['o1', 'o-nuova']))));
    expect(found.docs.map(d => d.id)).toContain(projectId);
  });

  it('ruoli dei membri: si leggono per ID dentro i propri progetti', async () => {
    await assertSucceeds(getDoc(doc(carla(), 'project_members/po_carla')));
    await assertSucceeds(getDoc(doc(carla(), 'project_members/po_nessuno')));
    await assertFails(getDoc(doc(bruno(), 'project_members/po_carla')));
    await assertFails(getDocs(query(collection(anna(), 'project_members'), where('userId', '==', 'carla'))));
  });

  it('chat e messaggi: solo i partecipanti', async () => {
    await assertSucceeds(getDocs(query(collection(carla(), 'chats'), where('members', 'array-contains', 'carla'))));
    await assertSucceeds(getDocs(query(collection(carla(), 'messages'), where('chatId', '==', 'ch1'))));
    await assertSucceeds(addDoc(collection(carla(), 'messages'), { chatId: 'ch1', senderId: 'carla', text: 'Ok', readBy: ['carla'] }));
    await assertSucceeds(updateDoc(doc(carla(), 'messages/m1'), { readBy: ['anna', 'carla'] }));
    await assertSucceeds(addDoc(collection(carla(), 'chats'), { projectId: 'po', type: 'direct', members: ['carla', 'anna'] }));
    await assertFails(getDoc(doc(bruno(), 'chats/ch1')));
    await assertFails(getDocs(query(collection(bruno(), 'messages'), where('chatId', '==', 'ch1'))));
    await assertFails(addDoc(collection(bruno(), 'messages'), { chatId: 'ch1', senderId: 'bruno', text: 'x' }));
    await assertFails(addDoc(collection(carla(), 'messages'), { chatId: 'ch1', senderId: 'anna', text: 'a nome di anna' }));
    await assertFails(addDoc(collection(bruno(), 'chats'), { projectId: 'po', type: 'direct', members: ['bruno', 'anna'] }));
  });

  it('silenziato: legge ma non scrive nelle chat dei progetti dell’organizzazione', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const admin = context.firestore();
      await updateDoc(doc(admin, 'organizations/o1'), { mutedUids: ['carla'] });
      await setDoc(doc(admin, 'chats/libera'), { type: 'direct', members: ['anna', 'carla'] });
      await setDoc(doc(admin, 'workspaces/wc'), { name: 'Di Carla', ownerId: 'carla' });
      await setDoc(doc(admin, 'projects/pc'), { name: 'Personale', workspaceId: 'wc', userId: 'carla', creatorId: 'carla' });
      await setDoc(doc(admin, 'chats/personale'), { projectId: 'pc', type: 'group', members: ['carla'] });
    });
    await assertSucceeds(getDocs(query(collection(carla(), 'messages'), where('chatId', '==', 'ch1'))));
    await assertSucceeds(updateDoc(doc(carla(), 'messages/m1'), { readBy: ['anna', 'carla'] }));
    await assertFails(addDoc(collection(carla(), 'messages'), { chatId: 'ch1', senderId: 'carla', text: 'Ok' }));
    await assertSucceeds(addDoc(collection(anna(), 'messages'), { chatId: 'ch1', senderId: 'anna', text: 'Ok' }));
    // Chat senza progetto o di un workspace personale: nessun silenzio.
    await assertSucceeds(addDoc(collection(carla(), 'messages'), { chatId: 'libera', senderId: 'carla', text: 'Ok' }));
    await assertSucceeds(addDoc(collection(carla(), 'messages'), { chatId: 'personale', senderId: 'carla', text: 'Ok' }));
    // Il silenzio lo decide il server, non i membri.
    await assertFails(updateDoc(doc(carla(), 'organizations/o1'), { mutedUids: [] }));
    await assertFails(updateDoc(doc(anna(), 'organizations/o1'), { mutedUids: ['carla', 'anna'] }));
  });

  it('accessi: i propri e quelli del proprio workspace; non ci si dà accesso da soli', async () => {
    await assertSucceeds(getDocs(query(collection(carla(), 'access_grants'), where('subjectId', '==', 'carla'))));
    await assertSucceeds(getDocs(query(collection(carla(), 'access_grants'), where('workspaceId', '==', 'o1'), where('resourceType', '==', 'workspace_group'))));
    await assertSucceeds(getDoc(doc(carla(), 'access_grants/o1_nessuno')));
    await assertFails(getDocs(query(collection(bruno(), 'access_grants'), where('workspaceId', '==', 'o1'))));
    await assertFails(getDocs(collection(anna(), 'access_grants')));
    const grant = (id: string, role: string) => ({ workspaceId: 'o1', subjectType: 'user', subjectId: id, resourceType: 'workspace', resourceId: 'o1', role });
    await assertFails(setDoc(doc(bruno(), 'access_grants/o1_bruno'), grant('bruno', 'member')));
    await assertFails(setDoc(doc(carla(), 'access_grants/o1_carla'), grant('carla', 'admin')));
    await assertFails(setDoc(doc(carla(), 'access_grants/casuale'), grant('carla', 'member')));
    await assertFails(updateDoc(doc(carla(), 'access_grants/o1_carla'), { role: 'admin' }));
  });

  it('auto-riparazione: un membro senza accesso se lo crea con ID fisso', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'organizations/o1'), { memberUids: ['anna', 'carla', 'dora'] });
    });
    const dora = env.authenticatedContext('dora').firestore();
    await assertSucceeds(setDoc(doc(dora, 'access_grants/o1_dora'), {
      workspaceId: 'o1', subjectType: 'user', subjectId: 'dora', resourceType: 'workspace', resourceId: 'o1', role: 'member', createdAt: serverTimestamp(),
    }));
  });

  it('squadre: i membri del workspace aggiungono e tolgono persone', async () => {
    const teamGrant = { workspaceId: 'o1', subjectType: 'user', subjectId: 'anna', resourceType: 'workspace_group', resourceId: 'g1', role: 'member' };
    await assertSucceeds(getDocs(query(collection(carla(), 'workspace_groups'), where('workspaceId', '==', 'o1'))));
    await assertSucceeds(setDoc(doc(carla(), 'access_grants/g1_anna'), teamGrant));
    await assertSucceeds(deleteDoc(doc(carla(), 'access_grants/g1_anna')));
    await assertFails(setDoc(doc(bruno(), 'access_grants/g1_anna'), teamGrant));
    await assertFails(getDocs(query(collection(bruno(), 'workspace_groups'), where('workspaceId', '==', 'o1'))));
    await assertFails(addDoc(collection(bruno(), 'workspace_groups'), { name: 'x', workspaceId: 'o1' }));
  });

  it('un membro sospeso (in members ma non in memberUids) non vede organizzazione, progetti e chat', async () => {
    await env.withSecurityRulesDisabled(async context => {
      const admin = context.firestore();
      await setDoc(doc(admin, 'organizations/o1'), {
        name: 'Acme', ownerId: 'anna', memberUids: ['anna'],
        members: [{ uid: 'anna', role: 'admin' }, { uid: 'carla', role: 'member', suspended: true }],
      });
      await setDoc(doc(admin, 'chats/ch1'), { projectId: 'po', type: 'group', members: ['anna'] });
    });
    await assertFails(getDoc(doc(carla(), 'organizations/o1')));
    await assertFails(getDoc(doc(carla(), 'projects/po')));
    await assertFails(getDoc(doc(carla(), 'workspaces/o1')));
    await assertFails(getDoc(doc(carla(), 'chats/ch1')));
    await assertFails(updateDoc(doc(anna(), 'organizations/o1'), { memberUids: ['anna', 'carla'] }));
  });

  it('le collezioni non previste sono chiuse', async () => {
    await assertFails(getDoc(doc(anna(), 'qualcosa/x')));
    await assertFails(setDoc(doc(anna(), 'qualcosa/x'), { a: 1 }));
  });

  it('chi non ha fatto il login non vede niente', async () => {
    await assertFails(getDoc(doc(guest(), 'projects/p1')));
    await assertFails(addDoc(collection(guest(), 'tasks'), { title: 'Task', projectId: 'p1' }));
    await assertFails(getDoc(doc(guest(), 'organizations/o1')));
  });
});
