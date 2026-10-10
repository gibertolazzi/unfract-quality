import { afterEach, describe, expect, it, vi } from 'vitest';

import { appUrl } from '@/lib/appUrl';

afterEach(() => vi.unstubAllEnvs());

function env(values: Record<string, string>) {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '');
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

describe('appUrl', () => {
  it('usa NEXT_PUBLIC_APP_URL quando c’è, senza la barra finale', () => {
    env({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://app.unfract.com/', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'unfract' });
    expect(appUrl()).toBe('https://app.unfract.com');
  });

  it('senza variabile, il sito del progetto Firebase della build', () => {
    env({ NODE_ENV: 'production', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'unfract' });
    expect(appUrl()).toBe('https://unfract--unfract.europe-west4.hosted.app');
    env({ NODE_ENV: 'production', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'unfract-prod' });
    expect(appUrl()).toBe('https://app.unfract.com');
  });

  it('in sviluppo locale resta su localhost', () => {
    env({ NODE_ENV: 'development', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'unfract-prod' });
    expect(appUrl()).toBe('http://localhost:3000');
  });

  it('mai l’indirizzo interno del server', () => {
    env({ NODE_ENV: 'production', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'altro' });
    expect(appUrl()).toBe('https://app.unfract.com');
  });
});
