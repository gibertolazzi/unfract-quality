/**
 * Filtri, ordinamento e paginazione di aziende, contatti e clienti.
 *
 * Funzioni pure come leadFilters.ts: nessun Firestore, nessun React. La
 * paginazione riusa quella dei lead invece di riscriverla.
 *
 * Stesso limite dichiarato per i lead: tutto avviene nel browser sull'insieme
 * completo del progetto. Regge qualche migliaio di record per entità; oltre
 * servono query indicizzate e cursori lato server, esclusi dalla deroga 2.
 */

import { CrmAccount, CrmContact, CrmCustomer } from '@/types/crm';
import { normalizePhone, toMillis } from './helpers';
import { Page, paginate } from './leadService';

export type SortDirection = 'asc' | 'desc';

/** Filtri comuni alle tre anagrafiche. */
export interface AnagraficaFilters {
  search: string;
  ownerUids: string[];
  includeArchived: boolean;
  /** Aziende: solo quelle senza contatti. Contatti: solo quelli senza azienda. */
  onlyOrphans: boolean;
  /** Contatti: solo chi ha dato il consenso email. */
  onlyConsented: boolean;
  /** Contatti: solo chi è escluso dagli invii. */
  onlySuppressed: boolean;
  /** Contatti e clienti: limita a una sola azienda. */
  accountId: string;
  /** Clienti: stato del rapporto. */
  status: '' | CrmCustomer['status'];
}

export const EMPTY_ANAGRAFICA_FILTERS: AnagraficaFilters = {
  search: '',
  ownerUids: [],
  includeArchived: false,
  onlyOrphans: false,
  onlyConsented: false,
  onlySuppressed: false,
  accountId: '',
  status: '',
};

export function countAnagraficaFilters(filters: AnagraficaFilters): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.ownerUids.length) count++;
  if (filters.includeArchived) count++;
  if (filters.onlyOrphans) count++;
  if (filters.onlyConsented) count++;
  if (filters.onlySuppressed) count++;
  if (filters.accountId) count++;
  if (filters.status) count++;
  return count;
}

/** Cerca la sottostringa, e sui numeri confronta anche le sole cifre. */
export function matches(haystack: string[], phone: string, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  if (haystack.filter(Boolean).join(' ').toLowerCase().includes(needle)) return true;

  const digits = normalizePhone(needle);
  return digits.length >= 3 && normalizePhone(phone).includes(digits);
}

export const text = (comparator: string, other: string, factor: number) =>
  comparator.localeCompare(other, 'it', { sensitivity: 'base' }) * factor;


export * from './accountService';
export * from './contactService';
export * from './customerService';
// ------------------------------------------------------------- etichette

export const CUSTOMER_STATUS_LABELS: Record<CrmCustomer['status'], string> = {
  active: 'Attivo',
  inactive: 'Non attivo',
  suspended: 'Sospeso',
};

export const CUSTOMER_STATUS_COLORS: Record<CrmCustomer['status'], string> = {
  active: '#10B981',
  inactive: '#71717A',
  suspended: '#F59E0B',
};

/** Indici pronti per le tre viste, calcolati una volta sola. */
export function buildAnagraficaIndexes(accounts: CrmAccount[], contacts: CrmContact[]) {
  const accountNameById = new Map<string, string>();
  accounts.forEach(account => {
    accountNameById.set(account.id, account.displayName || account.legalName);
  });

  const contactNameById = new Map<string, string>();
  const contactCountByAccount = new Map<string, number>();
  contacts.forEach(contact => {
    contactNameById.set(contact.id, contact.fullName);
    if (contact.accountId && !contact.archived) {
      contactCountByAccount.set(contact.accountId, (contactCountByAccount.get(contact.accountId) || 0) + 1);
    }
  });

  return { accountNameById, contactNameById, contactCountByAccount };
}
