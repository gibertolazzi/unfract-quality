import { CrmContact, CrmConsents } from '@/types/crm';
import { CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord, restoreRecord, deleteRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord, normalizeEmail, normalizePhone } from './base';
import { writeAudit } from './audit';
import { findDuplicates } from './duplicates';
import { Page, paginate } from './leadService';
import { toMillis } from './helpers';
import { SortDirection, AnagraficaFilters, matches, text } from './anagraficaFilters';

// ==================== QUERIES & MUTATIONS ====================
const COLLECTION_NAME = 'crm_contacts';

export function buildInitials(firstName: string, lastName: string): string {
  const a = (firstName || '').trim().charAt(0);
  const b = (lastName || '').trim().charAt(0);
  return (`${a}${b}`).toUpperCase() || '?';
}

function emptyConsents(): CrmConsents {
  return {
    email: { granted: false, source: '', policyVersion: '' },
    sms: { granted: false, source: '', policyVersion: '' },
  };
}

export function mapContact(id: string, data: any): CrmContact {
  const firstName = data.firstName || '';
  const lastName = data.lastName || '';
  const base = emptyConsents();
  return {
    ...mapBase(id, data),
    firstName,
    lastName,
    fullName: data.fullName || `${firstName} ${lastName}`.trim() || 'Contatto senza nome',
    initials: data.initials || buildInitials(firstName, lastName),
    role: data.role || '',
    email: data.email || '',
    emailNormalized: data.emailNormalized || '',
    phone: data.phone || '',
    phoneNormalized: data.phoneNormalized || '',
    address: data.address || '',
    city: data.city || '',
    postalCode: data.postalCode || '',
    country: data.country || '',
    accountId: data.accountId || '',
    isPrimary: data.isPrimary === true,
    preferredChannel: data.preferredChannel || '',
    preferredTime: data.preferredTime || '',
    consents: {
      email: { ...base.email, ...(data.consents?.email || {}) },
      sms: { ...base.sms, ...(data.consents?.sms || {}) },
    },
    suppressed: data.suppressed === true,
    suppressedReason: data.suppressedReason || '',
    linkedinUrl: data.linkedinUrl || '',
    photoURL: data.photoURL || '',
    notes: data.notes || '',
    duplicateCandidateIds: data.duplicateCandidateIds || [],
  };
}

function byName(a: CrmContact, b: CrmContact) {
  return a.fullName.localeCompare(b.fullName, 'it');
}

export async function getContacts(projectId: string, includeArchived = false) {
  const contacts = await getRecords(COLLECTION_NAME, projectId, mapContact, { includeArchived });
  return contacts.sort(byName);
}

export function subscribeToContacts(
  projectId: string,
  callback: (contacts: CrmContact[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapContact,
    (contacts) => callback(contacts.sort(byName)),
    { includeArchived }
  );
}

export function getContactById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapContact);
}

export function subscribeToContact(id: string, callback: (contact: CrmContact | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapContact, callback);
}

export interface CreateContactInput {
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  accountId?: string;
  isPrimary?: boolean;
  preferredChannel?: CrmContact['preferredChannel'];
  preferredTime?: string;
  consents?: CrmConsents;
  notes?: string;
}

export async function createContact(ctx: CrmContextRef, input: CreateContactInput) {
  const email = input.email || '';
  const phone = input.phone || '';
  const duplicates = await findDuplicates(ctx.projectId, { email, phone });

  const firstName = input.firstName || '';
  const lastName = input.lastName || '';

  const id = await createRecord(COLLECTION_NAME, ctx, {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    initials: buildInitials(firstName, lastName),
    role: input.role || '',
    email,
    emailNormalized: normalizeEmail(email),
    phone,
    phoneNormalized: normalizePhone(phone),
    address: input.address || '',
    city: input.city || '',
    postalCode: input.postalCode || '',
    country: input.country || '',
    accountId: input.accountId || '',
    isPrimary: input.isPrimary === true,
    preferredChannel: input.preferredChannel || '',
    preferredTime: input.preferredTime || '',
    consents: input.consents || emptyConsents(),
    suppressed: false,
    suppressedReason: '',
    linkedinUrl: '',
    photoURL: '',
    notes: input.notes || '',
    duplicateCandidateIds: duplicates.map(d => d.id),
  });

  if (id) await writeAudit(ctx, 'contact.created', 'contact', id, null, { fullName: `${firstName} ${lastName}`.trim() });
  return { id, duplicates };
}

export async function updateContact(ctx: CrmContextRef, id: string, updates: Partial<CrmContact>) {
  const payload: Record<string, any> = { ...updates };

  if (updates.email !== undefined) payload.emailNormalized = normalizeEmail(updates.email);
  if (updates.phone !== undefined) payload.phoneNormalized = normalizePhone(updates.phone);

  if (updates.firstName !== undefined || updates.lastName !== undefined) {
    const current = await getContactById(id);
    const firstName = updates.firstName !== undefined ? updates.firstName : current?.firstName || '';
    const lastName = updates.lastName !== undefined ? updates.lastName : current?.lastName || '';
    payload.fullName = `${firstName} ${lastName}`.trim();
    payload.initials = buildInitials(firstName, lastName);
  }

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'contact.updated', 'contact', id, null, payload);
}

/**
 * Consenso di canale, con fonte e versione dell'informativa come richiede la
 * specifica. Ogni cambio finisce nell'audit: serve a dimostrare quando e su
 * quale base è stato raccolto.
 */
export async function setContactConsent(
  ctx: CrmContextRef,
  id: string,
  channel: 'email' | 'sms',
  granted: boolean,
  source: string,
  policyVersion: string
): Promise<void> {
  const contact = await getContactById(id);
  if (!contact) return;

  const consents: CrmConsents = {
    ...contact.consents,
    [channel]: { granted, source, policyVersion, grantedAt: new Date().toISOString() },
  };

  await updateRecord(COLLECTION_NAME, id, { consents }, ctx.uid);
  await writeAudit(
    ctx, granted ? 'contact.consent_granted' : 'contact.consent_revoked', 'contact', id,
    { [channel]: contact.consents[channel] },
    { [channel]: consents[channel] }
  );
}

/** Esclusione permanente dagli invii (lista soppressa). */
export async function suppressContact(ctx: CrmContextRef, id: string, reason: string) {
  await updateRecord(COLLECTION_NAME, id, { suppressed: true, suppressedReason: reason }, ctx.uid);
  await writeAudit(ctx, 'contact.suppressed', 'contact', id, null, { reason });
}

export async function unsuppressContact(ctx: CrmContextRef, id: string) {
  await updateRecord(COLLECTION_NAME, id, { suppressed: false, suppressedReason: '' }, ctx.uid);
  await writeAudit(ctx, 'contact.unsuppressed', 'contact', id);
}

export async function archiveContact(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'contact.archived', 'contact', id);
}

export async function deleteContact(ctx: CrmContextRef, id: string): Promise<void> {
  await deleteRecord(COLLECTION_NAME, id);
  await writeAudit(ctx, 'contact.deleted', 'contact', id);
}

export async function restoreContact(ctx: CrmContextRef, id: string) {
  await restoreRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'contact.restored', 'contact', id);
}
// ==================== FILTERS & SORTING ====================
// ------------------------------------------------------------ contatti

export type ContactSortField = 'fullName' | 'account' | 'role' | 'updatedAt';
export interface ContactSort { field: ContactSortField; direction: SortDirection }
export const DEFAULT_CONTACT_SORT: ContactSort = { field: 'fullName', direction: 'asc' };

export interface ContactContext {
  /** Nome dell'azienda per id: la ricerca deve trovarlo anche da qui. */
  accountNameById: Map<string, string>;
}

export function buildContactView(
  contacts: CrmContact[],
  filters: AnagraficaFilters,
  sort: ContactSort,
  page: number,
  pageSize: number,
  context: ContactContext
): Page<CrmContact> {
  const factor = sort.direction === 'asc' ? 1 : -1;
  const accountName = (contact: CrmContact) => context.accountNameById.get(contact.accountId) || '';

  const filtered = contacts.filter(contact => {
    if (!filters.includeArchived && contact.archived) return false;
    if (filters.accountId && contact.accountId !== filters.accountId) return false;
    if (filters.onlyOrphans && contact.accountId) return false;
    if (filters.onlyConsented && !contact.consents.email.granted) return false;
    if (filters.onlySuppressed && !contact.suppressed) return false;
    return matches(
      [contact.fullName, contact.firstName, contact.lastName, contact.email,
       contact.phone, contact.role, contact.notes, accountName(contact)],
      contact.phone, filters.search
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort.field) {
      case 'account':   return text(accountName(a), accountName(b), factor);
      case 'role':      return text(a.role, b.role, factor);
      case 'updatedAt': return (toMillis(a.updatedAt) - toMillis(b.updatedAt)) * factor;
      case 'fullName':
      default: {
        // Ordine per cognome: è come si cerca una persona in un elenco.
        const keyA = `${a.lastName} ${a.firstName}`.trim() || a.fullName;
        const keyB = `${b.lastName} ${b.firstName}`.trim() || b.fullName;
        return text(keyA, keyB, factor);
      }
    }
  });

  return paginate(sorted, page, pageSize);
}
