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
  // Un segnaposto come "..." non è vuoto, ma Firebase lo rifiuta solo quando
  // l'app è già online (al login): meglio fermare la build qui.
  const invalid = required.filter(name => env[name] && !validFirebaseValue(name, env[name]));
  const defined = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined));
  return { env: defined, missing, invalid };
}

const FIREBASE_FORMATS = {
  NEXT_PUBLIC_FIREBASE_API_KEY: /^AIza[0-9A-Za-z_-]{35}$/,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: /^\d+$/,
  NEXT_PUBLIC_FIREBASE_APP_ID: /^1:\d+:web:[0-9a-f]+$/,
};
const PLACEHOLDER = /^(\.+|x+|changeme|todo|your[-_].*|<.*>)$/i;

function validFirebaseValue(name, value) {
  const text = String(value).trim();
  if (PLACEHOLDER.test(text)) return false;
  return FIREBASE_FORMATS[name] ? FIREBASE_FORMATS[name].test(text) : true;
}

const firebaseWeb = firebaseWebEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // L'app non usa next/image: l'ottimizzatore (/_next/image) resta spento,
  // così non espone una superficie in più.
  images: { unoptimized: true },
  env: firebaseWeb.env,
  webpack(config) {
    if (firebaseWeb.missing.length) {
      throw new Error(
        `Configurazione Firebase mancante: ${firebaseWeb.missing.join(', ')}. ` +
        'Impostale in .env.local (vedi .env.example) o nelle variabili del deploy.'
      );
    }
    if (firebaseWeb.invalid.length) {
      throw new Error(
        `Configurazione Firebase non valida (segnaposto o formato sbagliato): ${firebaseWeb.invalid.join(', ')}. ` +
        'Copia i valori dalla console Firebase in .env.local o nelle variabili del deploy.'
      );
    }
    return config;
  },
  // Login con Google dallo stesso dominio del sito (vedi lib/authDomain.ts),
  // verso il progetto Firebase di questo deploy: prima puntava sempre a
  // unfract-prod, anche dall'ambiente di prova.
  // La pagina di consenso degli assistenti non si può mettere dentro un altro
  // sito: un iframe trasparente potrebbe far cliccare «Consenti» (clickjacking).
  async headers() {
    return [
      {
        source: '/oauth/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
  async rewrites() {
    const projectId = firebaseWeb.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const rewrites = [
      {
        source: '/.well-known/microsoft-identity-association',
        destination: '/.well-known/microsoft-identity-association.json',
      },
      // Server MCP: dove l'assistente scopre come fare il login (RFC 9728 e
      // RFC 8414). Le route stanno in app/api/oauth.
      { source: '/.well-known/oauth-protected-resource', destination: '/api/oauth/protected-resource' },
      { source: '/.well-known/oauth-protected-resource/:path*', destination: '/api/oauth/protected-resource' },
      { source: '/.well-known/oauth-authorization-server', destination: '/api/oauth/authorization-server' },
      { source: '/.well-known/oauth-authorization-server/:path*', destination: '/api/oauth/authorization-server' },
    ];
    if (projectId) {
      rewrites.push({
        source: '/__/auth/:path*',
        destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
      });
    }
    return rewrites;
  },
};

export default nextConfig;
