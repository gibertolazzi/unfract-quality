/**
 * Funzioni pure del CRM: normalizzazioni, date, ordinamenti.
 *
 * Questo file NON importa Firebase di proposito: così la logica di filtro e
 * ordinamento è utilizzabile (e verificabile) senza tirarsi dietro Firestore.
 */

/** Chiave di confronto per i duplicati. Non modifica il valore memorizzato. */
export function normalizeEmail(email?: string): string {
  return (email || '').trim().toLowerCase();
}

/** Tiene solo le cifre, con il + iniziale del prefisso internazionale. */
export function normalizePhone(phone?: string): string {
  const raw = (phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? '+' + digits.slice(1).replace(/\D/g, '') : digits.replace(/\D/g, '');
}

/** Caselle di posta generiche: non identificano un'azienda. */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.it',
  'live.com', 'live.it', 'yahoo.com', 'yahoo.it', 'icloud.com', 'me.com',
  'libero.it', 'virgilio.it', 'tiscali.it', 'alice.it', 'pec.it', 'protonmail.com',
]);

export function extractDomain(emailOrUrl?: string): string {
  const value = (emailOrUrl || '').trim().toLowerCase();
  if (!value) return '';

  let host = '';
  if (value.includes('@')) {
    host = value.split('@').pop() || '';
  } else {
    host = value.replace(/^https?:\/\//, '').split('/')[0];
  }
  host = host.replace(/^www\./, '');

  if (!host.includes('.')) return '';
  if (FREE_EMAIL_DOMAINS.has(host)) return '';
  return host;
}

/** Millisecondi da un Timestamp Firestore o da una stringa ISO, 0 se assente. */
export function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return value?.toMillis ? value.toMillis() : 0;
}

export function byUpdatedAtDesc(a: { updatedAt: any }, b: { updatedAt: any }) {
  return toMillis(b.updatedAt) - toMillis(a.updatedAt);
}

export function byCreatedAtDesc(a: { createdAt: any }, b: { createdAt: any }) {
  return toMillis(b.createdAt) - toMillis(a.createdAt);
}
