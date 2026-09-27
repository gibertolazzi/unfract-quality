import { CrmCustomer } from '@/types/crm';
import { CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord, restoreRecord, deleteRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord, byUpdatedAtDesc } from './base';
import { writeAudit } from './audit';
import { Page, paginate } from './leadService';
import { toMillis, normalizePhone } from './helpers';
import { SortDirection, AnagraficaFilters, matches, text } from './anagraficaFilters';

// ==================== QUERIES & MUTATIONS ====================
const COLLECTION_NAME = 'crm_customers';

export function mapCustomer(id: string, data: any): CrmCustomer {
  return {
    ...mapBase(id, data),
    accountId: data.accountId || '',
    contactIds: data.contactIds || [],
    ownerUid: data.ownerUid || '',
    status: data.status || 'active',
    monthlyAmount: data.monthlyAmount || 0,
    annualAmount: data.annualAmount || 0,
    oneTimeAmount: data.oneTimeAmount || 0,
    linkedProjectIds: data.linkedProjectIds || [],
    sharedWithProjectFields: data.sharedWithProjectFields || [],
    originLeadId: data.originLeadId || '',
    customerSince: data.customerSince,
    notes: data.notes || '',
    privateNotes: data.privateNotes || '',
  };
}

export async function getCustomers(projectId: string, includeArchived = false) {
  const customers = await getRecords(COLLECTION_NAME, projectId, mapCustomer, { includeArchived });
  return customers.sort(byUpdatedAtDesc);
}

export function subscribeToCustomers(
  projectId: string,
  callback: (customers: CrmCustomer[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapCustomer,
    (customers) => callback(customers.sort(byUpdatedAtDesc)),
    { includeArchived }
  );
}

export function getCustomerById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapCustomer);
}

export function subscribeToCustomer(id: string, callback: (customer: CrmCustomer | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapCustomer, callback);
}

export interface CreateCustomerInput {
  accountId: string;
  contactIds?: string[];
  ownerUid?: string;
  originLeadId?: string;
  notes?: string;
}

export async function createCustomer(ctx: CrmContextRef, input: CreateCustomerInput) {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    accountId: input.accountId || '',
    contactIds: input.contactIds || [],
    ownerUid: input.ownerUid || ctx.uid,
    status: 'active',
    linkedProjectIds: [],
    sharedWithProjectFields: [],
    originLeadId: input.originLeadId || '',
    customerSince: new Date().toISOString(),
    notes: input.notes || '',
    privateNotes: '',
  });

  if (id) await writeAudit(ctx, 'customer.created', 'customer', id, null, { accountId: input.accountId });
  return id;
}

export async function updateCustomer(ctx: CrmContextRef, id: string, updates: Partial<CrmCustomer>) {
  await updateRecord(COLLECTION_NAME, id, updates, ctx.uid);
  await writeAudit(ctx, 'customer.updated', 'customer', id, null, updates);
}

/**
 * Collega un cliente a un progetto, dichiarando quali campi commerciali il
 * progetto può vedere.
 *
 * La specifica è esplicita: «il progetto deve ricevere solo informazioni
 * commerciali espressamente autorizzate». Con la deroga 2 l'elenco qui sotto
 * è rispettato dalla UI ma non imposto lato server: chi legge Firestore vede
 * tutto. Vedi docs/DEROGHE.md.
 */
export async function linkCustomerToProject(
  ctx: CrmContextRef,
  id: string,
  targetProjectId: string,
  sharedFields: string[]
): Promise<void> {
  const customer = await getCustomerById(id);
  if (!customer) return;

  const linkedProjectIds = Array.from(new Set([...customer.linkedProjectIds, targetProjectId]));

  await updateRecord(COLLECTION_NAME, id, {
    linkedProjectIds,
    sharedWithProjectFields: sharedFields,
  }, ctx.uid);

  await writeAudit(ctx, 'customer.linked_to_project', 'customer', id, null, {
    targetProjectId, sharedFields,
  });
}

export async function archiveCustomer(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'customer.archived', 'customer', id);
}

export async function deleteCustomer(ctx: CrmContextRef, id: string): Promise<void> {
  await deleteRecord(COLLECTION_NAME, id);
  await writeAudit(ctx, 'customer.deleted', 'customer', id);
}

export async function restoreCustomer(ctx: CrmContextRef, id: string) {
  await restoreRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'customer.restored', 'customer', id);
}
// ==================== FILTERS & SORTING ====================
// ------------------------------------------------------------- clienti

export type CustomerSortField = 'account' | 'status' | 'customerSince' | 'updatedAt';
export interface CustomerSort { field: CustomerSortField; direction: SortDirection }
export const DEFAULT_CUSTOMER_SORT: CustomerSort = { field: 'customerSince', direction: 'desc' };

export interface CustomerContext {
  accountNameById: Map<string, string>;
  contactNameById: Map<string, string>;
}

const STATUS_ORDER: Record<CrmCustomer['status'], number> = { active: 0, suspended: 1, inactive: 2 };

export function buildCustomerView(
  customers: CrmCustomer[],
  filters: AnagraficaFilters,
  sort: CustomerSort,
  page: number,
  pageSize: number,
  context: CustomerContext
): Page<CrmCustomer> {
  const factor = sort.direction === 'asc' ? 1 : -1;
  const accountName = (customer: CrmCustomer) => context.accountNameById.get(customer.accountId) || '';

  const filtered = customers.filter(customer => {
    if (!filters.includeArchived && customer.archived) return false;
    if (filters.ownerUids.length > 0 && !filters.ownerUids.includes(customer.ownerUid)) return false;
    if (filters.accountId && customer.accountId !== filters.accountId) return false;
    if (filters.status && customer.status !== filters.status) return false;
    return matches(
      [accountName(customer), customer.notes,
       ...customer.contactIds.map(id => context.contactNameById.get(id) || '')],
      '', filters.search
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort.field) {
      case 'account':       return text(accountName(a), accountName(b), factor);
      case 'status':        return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * factor;
      case 'customerSince': return (toMillis(a.customerSince) - toMillis(b.customerSince)) * factor;
      case 'updatedAt':
      default:              return (toMillis(a.updatedAt) - toMillis(b.updatedAt)) * factor;
    }
  });

  return paginate(sorted, page, pageSize);
}
