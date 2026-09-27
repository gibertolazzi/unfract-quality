import { CrmAccount } from '@/types/crm';
import { CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord, restoreRecord, deleteRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord, extractDomain, byUpdatedAtDesc } from './base';
import { writeAudit } from './audit';
import { findDuplicates } from './duplicates';
import { Page, paginate } from './leadService';
import { toMillis, normalizePhone } from './helpers';
import { SortDirection, AnagraficaFilters, matches, text } from './anagraficaFilters';

// ==================== QUERIES & MUTATIONS ====================
const COLLECTION_NAME = 'crm_accounts';

export function mapAccount(id: string, data: any): CrmAccount {
  return {
    ...mapBase(id, data),
    legalName: data.legalName || '',
    displayName: data.displayName || data.legalName || 'Azienda senza nome',
    domain: data.domain || '',
    website: data.website || '',
    industry: data.industry || '',
    sizeRange: data.sizeRange || '',
    country: data.country || 'IT',
    region: data.region || '',
    city: data.city || '',
    address: data.address || '',
    postalCode: data.postalCode || '',
    vatNumber: data.vatNumber || '',
    taxCode: data.taxCode || '',
    ownerUid: data.ownerUid || '',
    sources: data.sources || [],
    notes: data.notes || '',
    logoUrl: data.logoUrl || '',
    linkedinUrl: data.linkedinUrl || '',
    duplicateCandidateIds: data.duplicateCandidateIds || [],
  };
}

export async function getAccounts(projectId: string, includeArchived = false) {
  const accounts = await getRecords(COLLECTION_NAME, projectId, mapAccount, { includeArchived });
  return accounts.sort(byUpdatedAtDesc);
}

export function subscribeToAccounts(
  projectId: string,
  callback: (accounts: CrmAccount[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapAccount,
    // Ordinamento lato client: evita un indice composito.
    (accounts) => callback(accounts.sort(byUpdatedAtDesc)),
    { includeArchived }
  );
}

export function getAccountById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapAccount);
}

export function subscribeToAccount(id: string, callback: (account: CrmAccount | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapAccount, callback);
}

export interface CreateAccountInput {
  legalName: string;
  displayName?: string;
  website?: string;
  domain?: string;
  industry?: string;
  sizeRange?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  postalCode?: string;
  vatNumber?: string;
  taxCode?: string;
  ownerUid?: string;
  sources?: string[];
  notes?: string;
}

export async function createAccount(ctx: CrmContextRef, input: CreateAccountInput) {
  const domain = extractDomain(input.domain || input.website);
  const duplicates = await findDuplicates(ctx.projectId, { domain });

  const id = await createRecord(COLLECTION_NAME, ctx, {
    legalName: input.legalName || '',
    displayName: input.displayName || input.legalName || '',
    domain,
    website: input.website || '',
    industry: input.industry || '',
    sizeRange: input.sizeRange || '',
    country: input.country || 'IT',
    region: input.region || '',
    city: input.city || '',
    address: input.address || '',
    postalCode: input.postalCode || '',
    vatNumber: input.vatNumber || '',
    taxCode: input.taxCode || '',
    ownerUid: input.ownerUid || ctx.uid,
    sources: input.sources || [],
    notes: input.notes || '',
    logoUrl: '',
    linkedinUrl: '',
    duplicateCandidateIds: duplicates.map(d => d.id),
  });

  if (id) await writeAudit(ctx, 'account.created', 'account', id, null, { legalName: input.legalName });
  return { id, duplicates };
}

export async function updateAccount(ctx: CrmContextRef, id: string, updates: Partial<CrmAccount>) {
  const payload: Record<string, any> = { ...updates };
  if (updates.website !== undefined || updates.domain !== undefined) {
    payload.domain = extractDomain(updates.domain || updates.website);
  }
  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'account.updated', 'account', id, null, payload);
}

export async function archiveAccount(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'account.archived', 'account', id);
}

export async function deleteAccount(ctx: CrmContextRef, id: string): Promise<void> {
  await deleteRecord(COLLECTION_NAME, id);
  await writeAudit(ctx, 'account.deleted', 'account', id);
}

export async function restoreAccount(ctx: CrmContextRef, id: string) {
  await restoreRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'account.restored', 'account', id);
}
// ==================== FILTERS & SORTING ====================
// ------------------------------------------------------------- aziende

export type AccountSortField = 'displayName' | 'city' | 'industry' | 'contacts' | 'updatedAt';
export interface AccountSort { field: AccountSortField; direction: SortDirection }
export const DEFAULT_ACCOUNT_SORT: AccountSort = { field: 'displayName', direction: 'asc' };

export interface AccountContext {
  /** Quanti contatti ha ciascuna azienda: serve a filtrare e a ordinare. */
  contactCountByAccount: Map<string, number>;
}

export function buildAccountView(
  accounts: CrmAccount[],
  filters: AnagraficaFilters,
  sort: AccountSort,
  page: number,
  pageSize: number,
  context: AccountContext
): Page<CrmAccount> {
  const factor = sort.direction === 'asc' ? 1 : -1;
  const contactsOf = (account: CrmAccount) => context.contactCountByAccount.get(account.id) || 0;

  const filtered = accounts.filter(account => {
    if (!filters.includeArchived && account.archived) return false;
    if (filters.ownerUids.length > 0 && !filters.ownerUids.includes(account.ownerUid)) return false;
    if (filters.onlyOrphans && contactsOf(account) > 0) return false;
    return matches(
      [account.displayName, account.legalName, account.domain, account.website,
       account.city, account.region, account.vatNumber, account.taxCode,
       account.industry, account.notes],
      '', filters.search
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort.field) {
      case 'city':      return text(a.city, b.city, factor);
      case 'industry':  return text(a.industry, b.industry, factor);
      case 'contacts':  return (contactsOf(a) - contactsOf(b)) * factor;
      case 'updatedAt': return (toMillis(a.updatedAt) - toMillis(b.updatedAt)) * factor;
      case 'displayName':
      default:          return text(a.displayName || a.legalName, b.displayName || b.legalName, factor);
    }
  });

  return paginate(sorted, page, pageSize);
}
