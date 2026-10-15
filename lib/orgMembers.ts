/**
 * Membri di un'organizzazione che possono lavorare: chi è sospeso resta
 * nell'elenco (per poterlo riattivare) ma non si assegna, non si menziona e
 * non si aggiunge a chat e squadre (vedi lib/server/orgMembers.ts).
 */
export function activeMembers<T extends { suspended?: boolean }>(members: T[] | undefined): T[] {
  return (members || []).filter(member => !member.suspended);
}
