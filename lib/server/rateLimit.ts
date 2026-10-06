/**
 * Limite di richieste per chiave (di solito `operazione:uid`).
 *
 * Sta in memoria: ogni istanza del server ha il suo contatore e si azzera a
 * ogni riavvio. Ferma un ciclo sbagliato o un abuso grossolano, non un attacco
 * distribuito su più istanze: per quello serve un contatore condiviso
 * (segnalazione S21).
 */
const windows = new Map<string, number[]>();

export function tooManyRequests(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (windows.get(key) || []).filter(at => now - at < windowMs);
  recent.push(now);
  windows.set(key, recent);
  return recent.length > limit;
}
