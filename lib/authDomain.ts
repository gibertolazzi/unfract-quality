/**
 * Dominio da cui passa il login con Google.
 *
 * I browser bloccano i dati salvati da un dominio diverso da quello del sito:
 * se il login passa da `<progetto>.firebaseapp.com` mentre l'app è su un altro
 * dominio, Google restituisce l'utente ma l'app non lo riceve e si torna alla
 * pagina di login. Sui siti qui sotto il login passa invece dal sito stesso:
 * `next.config.mjs` gira `/__/auth/*` al `firebaseapp.com` del progetto.
 *
 * Ogni sito della lista deve avere `https://<sito>/__/auth/handler` fra gli
 * URI di reindirizzamento del client OAuth del suo progetto (Google Cloud →
 * API e servizi → Credenziali).
 *
 * Prima c'era solo `app.unfract.com`, scritto in `lib/firebase.ts`: l'ambiente
 * di prova (`unfract-quality`) non riusciva a fare il login con Google.
 */
export const SAME_ORIGIN_AUTH_HOSTS = [
  'app.unfract.com',
  'unfract--unfract.europe-west4.hosted.app',
] as const;

export function authDomainFor(hostname: string | undefined, fallback: string | undefined): string | undefined {
  if (hostname && (SAME_ORIGIN_AUTH_HOSTS as readonly string[]).includes(hostname)) return hostname;
  return fallback;
}
