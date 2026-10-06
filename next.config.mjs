/**
 * Configurazione web di Firebase, letta solo dall'ambiente.
 *
 * In locale arriva da `.env.local` (vedi `.env.example`). Su Firebase App
 * Hosting, se le `NEXT_PUBLIC_FIREBASE_*` non sono impostate, si usa
 * `FIREBASE_WEBAPP_CONFIG`, che App Hosting fornisce durante la build.
 *
 * Prima `lib/firebase.ts` aveva i valori di `unfract-prod` scritti nel codice
 * come riserva: una build senza variabili andava online lo stesso, puntando a
 * un progetto che nessuno aveva scelto. Ora la build si ferma.
 *
 * Il controllo sta nel passo webpack, che gira solo in build e in sviluppo:
 * `next lint` carica questo file ma non ha bisogno delle variabili.
 */
function firebaseWebEnv() {
  let webapp = {};
  if (process.env.FIREBASE_WEBAPP_CONFIG) {
    try {
      webapp = JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG);
    } catch {
      throw new Error('FIREBASE_WEBAPP_CONFIG non è un JSON valido.');
    }
  }

  const env = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || webapp.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || webapp.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || webapp.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || webapp.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || webapp.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || webapp.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || webapp.measurementId || '',
  };

  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];
  const missing = required.filter(name => !env[name]);
  const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined));
  return { env: defined, missing };
}

const firebaseWeb = firebaseWebEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: firebaseWeb.env,
  webpack(config) {
    if (firebaseWeb.missing.length) {
      throw new Error(
        `Configurazione Firebase mancante: ${firebaseWeb.missing.join(', ')}. ` +
        'Impostale in .env.local (vedi .env.example) o nelle variabili del deploy.'
      );
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://unfract-prod.firebaseapp.com/__/auth/:path*',
      },
    ];
  },
};

export default nextConfig;
