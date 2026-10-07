import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getDownloadURL, ref, uploadBytes, uploadBytesResumable, type FirebaseStorage } from 'firebase/storage';

/** Regole di Storage sull'emulatore, con i percorsi che l'app usa davvero. */

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-unfract',
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async context => {
    const storage = context.storage();
    await uploadBytes(ref(storage, 'crm/p1/2026/1-abc_offerta.pdf'), bytes(10), {
      contentType: 'application/pdf', customMetadata: { uid: 'anna', projectId: 'p1' },
    });
  });
});

const anna = () => env.authenticatedContext('anna').storage();
const bruno = () => env.authenticatedContext('bruno').storage();
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
    await assertSucceeds(uploadBytes(ref(anna(), 'tasks/attachments/1700_file.zip'), bytes(1024)));
    await assertSucceeds(uploadBytes(ref(anna(), 'chats/c1/1700_0_foto.png'), bytes(1024)));
    await assertSucceeds(uploadBytes(ref(anna(), 'chats/c1/vocale.webm'), bytes(1024)));
    await assertSucceeds(uploadBytes(ref(anna(), 'ai-hub/p1/1700_dati.csv'), bytes(1024)));
    await assertSucceeds(deleteObject(ref(anna(), 'tasks/attachments/1700_file.zip')));
  });

  it('banner e logo delle organizzazioni solo come immagini', async () => {
    await assertSucceeds(uploadBytes(ref(anna(), 'organizations/o1/banner_1700'), bytes(1024), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(anna(), 'organizations/o1/logo_1700'), bytes(1024), { contentType: 'text/html' }));
  });

  it('limiti di dimensione', async () => {
    await assertSucceeds(uploadLarge(anna(), 'organizations/o1/banner_ok', 19 * MB, 'image/png'));
    await assertFails(uploadLarge(anna(), 'organizations/o1/banner_big', 21 * MB, 'image/png'));
    await assertFails(uploadLarge(anna(), 'tasks/attachments/enorme.bin', 201 * MB));
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
