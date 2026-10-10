import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, getMetadata, listAll, ref, uploadBytes, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage';

/**
 * Regole di Storage sull'emulatore, con i percorsi che l'app usa davvero.
 * Le regole leggono Firestore (progetti, organizzazioni, chat): i dati di
 * prova si scrivono nell'emulatore di Firestore, senza regole.
 *
 * - o1: organizzazione di anna e bruno, con il progetto p1 e la chat c1;
 * - o2: organizzazione di carla, con il progetto p2 e la chat c2;
 * - pp: progetto personale di anna (workspace wa).
 */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-unfract',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'organizations/o1'), { name: 'Acme', ownerId: 'anna', memberUids: ['anna', 'bruno'] });
    await setDoc(doc(db, 'workspaces/o1'), { name: 'Acme', ownerId: 'anna' });
    await setDoc(doc(db, 'projects/p1'), { name: 'Sito', workspaceId: 'o1', userId: 'anna' });
    await setDoc(doc(db, 'chats/c1'), { projectId: 'p1', members: ['anna', 'bruno'] });
    await setDoc(doc(db, 'organizations/o2'), { name: 'Beta', ownerId: 'carla', memberUids: ['carla'] });
    await setDoc(doc(db, 'workspaces/o2'), { name: 'Beta', ownerId: 'carla' });
    await setDoc(doc(db, 'projects/p2'), { name: 'Altro', workspaceId: 'o2', userId: 'carla' });
    await setDoc(doc(db, 'chats/c2'), { projectId: 'p2', members: ['carla'] });
    await setDoc(doc(db, 'workspaces/wa'), { name: 'Personale', ownerId: 'anna' });
    await setDoc(doc(db, 'projects/pp'), { name: 'Mio', workspaceId: 'wa', userId: 'anna' });

    const storage = context.storage();
    await uploadBytes(ref(storage, 'crm/p1/2026/1-abc_offerta.pdf'), bytes(10), {
      contentType: 'application/pdf', customMetadata: { uid: 'anna', projectId: 'p1' },
    });
    await uploadBytes(ref(storage, 'meetings/p2/1700.webm'), bytes(10));
    await uploadBytes(ref(storage, 'tasks/attachments/1700_vecchio.pdf'), bytes(10));
  });
});

const anna = () => env.authenticatedContext('anna').storage();
const bruno = () => env.authenticatedContext('bruno').storage();
const carla = () => env.authenticatedContext('carla').storage();
const guest = () => env.unauthenticatedContext().storage();

function bytes(size: number): Uint8Array {
  return new Uint8Array(size);
}

// File grandi a blocchi, come fa l'app: l'emulatore rifiuta da sé un singolo
// caricamento oltre una ventina di MB, prima ancora di valutare le regole.
function uploadLarge(storage: FirebaseStorage, path: string, size: number, contentType?: string) {
  return new Promise((resolve, reject) => {
    uploadBytesResumable(ref(storage, path), bytes(size), contentType ? { contentType } : undefined)
      .on('state_changed', undefined, reject, () => resolve(path));
  });
}

const MB = 1024 * 1024;

describe('percorsi dell’app', () => {
  it('registrazione di un meeting', async () => {
    const audio = ref(anna(), 'meetings/p1/1700000000000.webm');
    await assertSucceeds(uploadBytes(audio, bytes(1024), { contentType: 'audio/webm' }));
    await assertSucceeds(getDownloadURL(audio));
  });

  it('allegati di documentazione, task, chat e AI Hub', async () => {
    await assertSucceeds(uploadBytes(ref(anna(), 'documentation/p1/d1/1700-nota.pdf'), bytes(1024)));
    await assertSucceeds(uploadBytes(ref(anna(), 'tasks/p1/1700_file.zip'), bytes(1024)));
    await assertSucceeds(uploadBytes(ref(anna(), 'chats/c1/1700_0_foto.png'), bytes(1024)));
    await assertSucceeds(uploadBytes(ref(anna(), 'chats/c1/vocale.webm'), bytes(1024)));
    await assertSucceeds(uploadBytes(ref(anna(), 'ai-hub/p1/1700_dati.csv'), bytes(1024)));
    await assertSucceeds(deleteObject(ref(anna(), 'tasks/p1/1700_file.zip')));
  });

  it('banner e logo delle organizzazioni solo come immagini', async () => {
    await assertSucceeds(uploadBytes(ref(anna(), 'organizations/o1/banner_1700'), bytes(1024), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(anna(), 'organizations/o1/logo_1700'), bytes(1024), { contentType: 'text/html' }));
  });

  it('limiti di dimensione', async () => {
    await assertSucceeds(uploadLarge(anna(), 'organizations/o1/banner_ok', 19 * MB, 'image/png'));
    await assertFails(uploadLarge(anna(), 'organizations/o1/banner_big', 21 * MB, 'image/png'));
    await assertFails(uploadLarge(anna(), 'tasks/p1/enorme.bin', 201 * MB));
  });

  it('percorsi sconosciuti chiusi', async () => {
    await assertFails(uploadBytes(ref(anna(), 'qualsiasi/file.html'), bytes(10), { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(anna(), 'file.txt'), bytes(10)));
  });

  it('senza login niente', async () => {
    await assertFails(uploadBytes(ref(guest(), 'meetings/p1/x.webm'), bytes(10)));
    await assertFails(getDownloadURL(ref(guest(), 'crm/p1/2026/1-abc_offerta.pdf')));
  });
});

describe('documenti del CRM', () => {
  it('chi carica si firma nei metadati', async () => {
    await assertSucceeds(uploadBytes(ref(anna(), 'crm/p1/2026/2-def_contratto.pdf'), bytes(1024), {
      contentType: 'application/pdf', customMetadata: { uid: 'anna', projectId: 'p1' },
    }));
    await assertFails(uploadBytes(ref(anna(), 'crm/p1/2026/3-ghi_x.pdf'), bytes(1024), {
      customMetadata: { uid: 'bruno', projectId: 'p1' },
    }));
    await assertFails(uploadBytes(ref(anna(), 'crm/p1/2026/4-jkl_x.pdf'), bytes(1024)));
    await assertFails(uploadBytes(ref(anna(), 'crm/p1/2026/5-mno_x.pdf'), bytes(51 * MB), {
      customMetadata: { uid: 'anna', projectId: 'p1' },
    }));
  });

  it('solo chi ha caricato il file lo cancella', async () => {
    await assertFails(deleteObject(ref(bruno(), 'crm/p1/2026/1-abc_offerta.pdf')));
    await assertSucceeds(deleteObject(ref(anna(), 'crm/p1/2026/1-abc_offerta.pdf')));
  });

  it('non si sovrascrive il documento di un altro', async () => {
    await assertFails(uploadBytes(ref(bruno(), 'crm/p1/2026/1-abc_offerta.pdf'), bytes(10), {
      customMetadata: { uid: 'bruno', projectId: 'p1' },
    }));
  });
});

describe('secondo passo: ogni azienda usa solo i propri file', () => {
  it('i membri dell’organizzazione usano i file dei suoi progetti', async () => {
    await assertSucceeds(uploadBytes(ref(bruno(), 'documentation/p1/d1/1700-nota.pdf'), bytes(1024)));
    await assertSucceeds(getDownloadURL(ref(anna(), 'documentation/p1/d1/1700-nota.pdf')));
    await assertSucceeds(deleteObject(ref(anna(), 'documentation/p1/d1/1700-nota.pdf')));
  });

  it('chi è fuori dall’organizzazione non carica, non apre e non cancella', async () => {
    for (const path of ['meetings/p1/x.webm', 'documentation/p1/d1/x.pdf', 'tasks/p1/x.zip', 'ai-hub/p1/x.csv']) {
      await assertFails(uploadBytes(ref(carla(), path), bytes(10)));
    }
    await assertFails(uploadBytes(ref(carla(), 'organizations/o1/banner_x'), bytes(10), { contentType: 'image/png' }));
    await assertFails(getDownloadURL(ref(anna(), 'meetings/p2/1700.webm')));
    await assertFails(getMetadata(ref(anna(), 'meetings/p2/1700.webm')));
    await assertFails(deleteObject(ref(anna(), 'meetings/p2/1700.webm')));
    await assertFails(getDownloadURL(ref(carla(), 'crm/p1/2026/1-abc_offerta.pdf')));
    await assertSucceeds(getDownloadURL(ref(carla(), 'meetings/p2/1700.webm')));
  });

  it('il progetto personale lo usa solo il proprietario', async () => {
    await assertSucceeds(uploadBytes(ref(anna(), 'ai-hub/pp/1700_dati.csv'), bytes(10)));
    await assertFails(uploadBytes(ref(bruno(), 'ai-hub/pp/1700_dati.csv'), bytes(10)));
  });

  it('file delle chat: solo i partecipanti', async () => {
    await assertSucceeds(uploadBytes(ref(bruno(), 'chats/c1/1700_0_foto.png'), bytes(10)));
    await assertFails(uploadBytes(ref(carla(), 'chats/c1/1700_0_foto.png'), bytes(10)));
    await assertFails(getDownloadURL(ref(carla(), 'chats/c1/1700_0_foto.png')));
    await assertFails(uploadBytes(ref(anna(), 'chats/c2/x.png'), bytes(10)));
  });

  it('progetti e chat che non esistono: niente', async () => {
    await assertFails(uploadBytes(ref(anna(), 'meetings/sparito/x.webm'), bytes(10)));
    await assertFails(uploadBytes(ref(anna(), 'chats/sparita/x.png'), bytes(10)));
  });

  it('nessuno elenca i file', async () => {
    await assertFails(listAll(ref(anna(), 'meetings/p1')));
    await assertFails(listAll(ref(anna(), 'crm/p1/2026')));
    await assertFails(listAll(ref(anna(), 'tasks/attachments')));
  });

  it('il server può controllare che un file cancellato non ci sia più', async () => {
    // lib/server/usage.ts legge i metadati con il token dell'utente: un file
    // che non esiste deve rispondere «non trovato», non «non permesso».
    const missing = (path: string) => getMetadata(ref(anna(), path)).then(() => 'esiste', (error: { code?: string }) => error.code);
    expect(await missing('documentation/p1/d1/assente.pdf')).toBe('storage/object-not-found');
    expect(await missing('tasks/attachments/assente.pdf')).toBe('storage/object-not-found');
    expect(await missing('tasks/attachments/1700_vecchio.pdf')).toBe('storage/unauthorized');
  });

  it('allegati vecchi dei task: niente nuovi caricamenti, cancellazione per nome', async () => {
    await assertFails(uploadBytes(ref(anna(), 'tasks/attachments/1800_nuovo.pdf'), bytes(10)));
    await assertFails(getDownloadURL(ref(carla(), 'tasks/attachments/1700_vecchio.pdf')));
    await assertSucceeds(deleteObject(ref(anna(), 'tasks/attachments/1700_vecchio.pdf')));
  });
});
