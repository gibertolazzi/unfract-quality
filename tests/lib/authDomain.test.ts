import { describe, expect, it } from 'vitest';

import { authDomainFor } from '@/lib/authDomain';

describe('authDomainFor', () => {
  it('in produzione il login passa dal sito stesso', () => {
    expect(authDomainFor('app.unfract.com', 'unfract-prod.firebaseapp.com')).toBe('app.unfract.com');
  });

  it("anche nell'ambiente di prova", () => {
    expect(authDomainFor('unfract--unfract.europe-west4.hosted.app', 'unfract.firebaseapp.com'))
      .toBe('unfract--unfract.europe-west4.hosted.app');
  });

  it('altrove resta il dominio firebaseapp.com del progetto', () => {
    expect(authDomainFor('localhost', 'unfract-prod.firebaseapp.com')).toBe('unfract-prod.firebaseapp.com');
    expect(authDomainFor('unfract--unfract-prod.europe-west4.hosted.app', 'unfract-prod.firebaseapp.com'))
      .toBe('unfract-prod.firebaseapp.com');
  });

  it('sul server, senza finestra, usa il valore della configurazione', () => {
    expect(authDomainFor(undefined, 'unfract.firebaseapp.com')).toBe('unfract.firebaseapp.com');
  });
});
