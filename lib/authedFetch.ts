import { auth } from './firebase';

/**
 * `fetch` verso le route del server con l'ID token dell'utente collegato.
 * Le route ricavano l'utente dal token: il client non manda più `userId`.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Devi effettuare il login.');

  const idToken = await currentUser.getIdToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${idToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  return fetch(input, { ...init, headers });
}
