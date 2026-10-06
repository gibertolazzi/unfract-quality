/**
 * Valori per i file .ics (RFC 5545).
 *
 * Titolo e descrizione li scrive l'utente. Senza escape un a capo nel titolo
 * chiude la riga e ne apre un'altra: si possono aggiungere campi all'invito,
 * per esempio un ORGANIZER o un ATTENDEE falsi.
 */

/** Campi di testo (SUMMARY, DESCRIPTION, LOCATION): RFC 5545, 3.3.11. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Valori che non hanno escape (UID, URL): basta che restino su una riga. */
export function icsSingleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}
