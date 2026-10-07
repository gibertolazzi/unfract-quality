import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';

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
  });
});

const anna = () => env.authenticatedContext('anna', { email: 'anna@example.com' }).firestore();
const bruno = () => env.authenticatedContext('bruno', { email: 'bruno@example.com' }).firestore();
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

  it('i contatori di consumo si aggiornano, i limiti no', async () => {
    await assertSucceeds(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.aiCreditsUsed': 5, 'quotas.aiCreditsPeriod': '2026-10' }));
    await assertSucceeds(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.storageUsed': increment(2048) }));
    await assertSucceeds(updateDoc(doc(anna(), 'workspaces/w1'), { name: 'Acme srl', bannerGradient: 'x' }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.planTier': 'enterprise' }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.aiCreditsLimit': 99999 }));
    await assertFails(updateDoc(doc(anna(), 'workspaces/w1'), { 'quotas.storageLimit': 1e12 }));
  });

  it('le quote mancanti si riempiono solo con i valori predefiniti', async () => {
    await assertSucceeds(setDoc(doc(anna(), 'workspaces/legacy'), {
      quotas: { planTier: 'free', storageUsed: 0, storageLimit: 1_000_000_000, aiCreditsUsed: 0, aiCreditsLimit: 120, aiCreditsPeriod: '2026-10' },
    }, { merge: true }));
  });

  it('le quote mancanti non si riempiono con un piano superiore', async () => {
    await assertFails(setDoc(doc(anna(), 'workspaces/legacy'), { quotas: { planTier: 'pro' } }, { merge: true }));
  });

  it('il proprietario non si cambia', async () => {
    await assertFails(updateDoc(doc(bruno(), 'workspaces/w1'), { ownerId: 'bruno' }));
    await assertFails(deleteDoc(doc(bruno(), 'workspaces/w1')));
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
    });
    await assertSucceeds(setDoc(doc(anna(), 'workspaces/senza-nome'), { name: 'Acme' }, { merge: true }));
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
    for (const path of ['org_invites/hash', 'oauth_states/s', 'calendar_channels/c', 'booking_locks/l', 'notifications_queue/q']) {
      await assertFails(getDoc(doc(anna(), path)));
      await assertFails(setDoc(doc(anna(), path), { x: 1 }));
    }
    await assertFails(getDocs(collection(anna(), 'org_invites')));
  });
});

describe('dati condivisi (secondo passo)', () => {
  it('restano accessibili a chi ha fatto il login', async () => {
    await assertSucceeds(getDoc(doc(bruno(), 'projects/p1')));
    await assertSucceeds(addDoc(collection(bruno(), 'tasks'), { title: 'Task', projectId: 'p1' }));
  });

  it('chiusi a chi non ha fatto il login', async () => {
    await assertFails(getDoc(doc(guest(), 'projects/p1')));
    await assertFails(addDoc(collection(guest(), 'tasks'), { title: 'Task' }));
  });
});
