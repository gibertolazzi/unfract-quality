import { createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl } from '@/lib/appUrl';

/**
 * Normalizza l'indirizzo email per garantire coerenza nei token e nelle ricerche.
 */
export function canonicalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Chiave segreta per la firma dei link di disiscrizione (HMAC-SHA256).
 * Non deve mai essere esposta al client.
 */
function getUnsubscribeSecret(): string {
  return (
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.CRON_SECRET ||
    'unfract-unsubscribe-secure-hmac-fallback'
  );
}

/**
 * Genera un token HMAC-SHA256 univoco e verificabile per l'indirizzo email specificato.
 */
export function generateUnsubscribeToken(email: string): string {
  const normalized = canonicalizeEmail(email);
  if (!normalized) return '';
  return createHmac('sha256', getUnsubscribeSecret())
    .update(normalized)
    .digest('hex');
}

/**
 * Verifica la firma del token per l'indirizzo email specificato.
 * Usa confronto a tempo costante per proteggere contro timing attacks.
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const normalized = canonicalizeEmail(email);
  if (!normalized || !token || typeof token !== 'string') return false;

  const expected = generateUnsubscribeToken(normalized);
  if (token.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Costruisce l'URL completo firmato per la disiscrizione.
 */
export function buildUnsubscribeUrl(email: string, baseUrl?: string): string {
  const normalized = canonicalizeEmail(email);
  const base = baseUrl || appUrl();
  const token = generateUnsubscribeToken(normalized);
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/api/email/unsubscribe?email=${encodeURIComponent(normalized)}&token=${encodeURIComponent(token)}`;
}

/**
 * Esegue l'escape sicuro di caratteri HTML speciali per prevenire attacchi XSS.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
