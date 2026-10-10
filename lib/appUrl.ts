/**
 * Indirizzo pubblico dell'app, per i link nelle email, negli inviti e nei
 * ritorni da Google, Microsoft e Stripe.
 *
 * Di solito lo dà `NEXT_PUBLIC_APP_URL`. Senza, ogni file usava un ripiego
 * diverso (`localhost:3000`, `unfract.com`, `tuodominio.com`, oppure
 * l'indirizzo della richiesta, che su App Hosting è quello interno del server:
 * `0.0.0.0:8080`). Ora il ripiego è l'indirizzo del sito del progetto Firebase
 * della build. Non si usa l'host della richiesta: un'intestazione falsa
 * potrebbe far partire inviti con un link a un altro sito.
 */
const APP_URL_BY_PROJECT: Record<string, string> = {
  'unfract-prod': 'https://app.unfract.com',
  unfract: 'https://unfract--unfract.europe-west4.hosted.app',
};

export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  return APP_URL_BY_PROJECT[process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''] ?? 'https://app.unfract.com';
}
