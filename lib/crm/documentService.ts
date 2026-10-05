import { db, storage } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { CrmDocument, CrmDocumentVersion } from '@/types/crm';
import { VisibilityLevel } from '@/components/crm/constants';
import { CrmContextRef, mapBase, createRecord, updateRecord, archiveRecord, getRecords, getRecordById, subscribeToRecords, subscribeToRecord, restoreRecord, byCreatedAtDesc } from './base';
import { writeAudit } from './audit';
import { getOpportunityById } from './opportunities';
import { toMillis } from './helpers';
import { Page, paginate } from './leadFilters';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { incrementStorageUsage } from '@/lib/usage';

const COLLECTION_NAME = 'crm_documents';

async function trackWorkspaceStorage(ctx: CrmContextRef, bytes: number) {
  try {
    const projectSnap = await getDoc(doc(db, 'projects', ctx.projectId));
    const workspaceId = projectSnap.data()?.workspaceId || ctx.organizationId;
    if (workspaceId) await incrementStorageUsage(workspaceId, bytes);
  } catch (error) {
    console.error('Unable to attribute CRM storage usage to its workspace:', error);
  }
}

/** Formati minimi richiesti dalla specifica. */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/mp4': 'm4a',
  'video/mp4': 'mp4',
};

export const MAX_FILE_BYTES = 50 * 1024 * 1024;   // 50 MB

export interface FileValidationResult {
  ok: boolean;
  reason?: string;
  extension?: string;
}

/**
 * Validazione di tipo ed estensione.
 *
 * ATTENZIONE: gira nel browser, quindi è un filtro di comodo, non un controllo
 * di sicurezza — chi scrive su Storage direttamente lo aggira. Il controllo
 * antivirus richiesto dalla specifica non è realizzabile lato client ed è
 * fuori dal primo rilascio. Vedi docs/DEROGHE.md.
 */
export function validateFile(file: { type: string; size: number; name: string }): FileValidationResult {
  const extension = ALLOWED_MIME_TYPES[file.type];
  if (!extension) return { ok: false, reason: `Formato non consentito: ${file.type || 'sconosciuto'}` };
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: `File troppo grande: massimo ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB` };
  }
  return { ok: true, extension };
}

export function mapDocument(id: string, data: any): CrmDocument {
  return {
    ...mapBase(id, data),
    fileName: data.fileName || '',
    mimeType: data.mimeType || '',
    extension: data.extension || '',
    sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : 0,
    storagePath: data.storagePath || '',
    downloadUrl: data.downloadUrl || '',
    leadId: data.leadId || '',
    accountId: data.accountId || '',
    contactId: data.contactId || '',
    customerId: data.customerId || '',
    opportunityId: data.opportunityId || '',
    interactionId: data.interactionId || '',
    communicationId: data.communicationId || '',
    linkedMeetingId: data.linkedMeetingId || '',
    tags: data.tags || [],
    visibility: data.visibility || 'team',
    versions: data.versions || [],
    retentionUntil: data.retentionUntil || '',
    extractedText: data.extractedText || '',
    scanStatus: data.scanStatus || 'skipped',
  };
}

export async function getDocuments(projectId: string, includeArchived = false) {
  const items = await getRecords(COLLECTION_NAME, projectId, mapDocument, { includeArchived });
  return items.sort(byCreatedAtDesc);
}

export function subscribeToDocuments(
  projectId: string,
  callback: (documents: CrmDocument[]) => void,
  includeArchived = false
) {
  return subscribeToRecords(
    COLLECTION_NAME, projectId, mapDocument,
    (items) => callback(items.sort(byCreatedAtDesc)),
    { includeArchived }
  );
}

export function getDocumentById(id: string) {
  return getRecordById(COLLECTION_NAME, id, mapDocument);
}

export function subscribeToDocument(id: string, cb: (d: CrmDocument | null) => void) {
  return subscribeToRecord(COLLECTION_NAME, id, mapDocument, cb);
}

export type DocumentLinkField =
  'leadId' | 'accountId' | 'contactId' | 'customerId' | 'opportunityId' | 'interactionId';

export function subscribeToDocumentsFor(
  projectId: string,
  field: DocumentLinkField,
  targetId: string,
  callback: (documents: CrmDocument[]) => void
) {
  if (!projectId || !targetId) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId),
    where(field, '==', targetId)
  );
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs
        .filter(d => d.data().archived !== true)
        .map(d => mapDocument(d.id, d.data()))
        .sort(byCreatedAtDesc)
    );
  }, (error) => {
    console.error('Error subscribing to CRM documents:', error);
    callback([]);
  });
}

export interface CreateDocumentInput {
  fileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  storagePath: string;
  downloadUrl: string;
  visibility?: VisibilityLevel;
  tags?: string[];
  retentionUntil?: string;

  leadId?: string;
  accountId?: string;
  contactId?: string;
  customerId?: string;
  opportunityId?: string;
  interactionId?: string;
  communicationId?: string;
  linkedMeetingId?: string;
}

export async function createDocument(ctx: CrmContextRef, input: CreateDocumentInput) {
  let finalAccountId = input.accountId || '';

  if (input.opportunityId && !finalAccountId) {
    const opp = await getOpportunityById(input.opportunityId);
    if (opp && (opp as any).accountId) {
      finalAccountId = (opp as any).accountId;
    }
  }

  const firstVersion: Omit<CrmDocumentVersion, 'uploadedAt'> & { uploadedAt: string } = {
    version: 1,
    storagePath: input.storagePath,
    downloadUrl: input.downloadUrl,
    sizeBytes: input.sizeBytes,
    uploadedAt: new Date().toISOString(),
    uploadedBy: ctx.uid,
  };

  const id = await createRecord(COLLECTION_NAME, ctx, {
    fileName: input.fileName,
    mimeType: input.mimeType,
    extension: input.extension,
    sizeBytes: input.sizeBytes,
    storagePath: input.storagePath,
    downloadUrl: input.downloadUrl,
    leadId: input.leadId || '',
    accountId: finalAccountId,
    contactId: input.contactId || '',
    customerId: input.customerId || '',
    opportunityId: input.opportunityId || '',
    interactionId: input.interactionId || '',
    communicationId: input.communicationId || '',
    linkedMeetingId: input.linkedMeetingId || '',
    tags: input.tags || [],
    visibility: input.visibility || 'team',
    versions: [firstVersion],
    retentionUntil: input.retentionUntil || '',
    extractedText: '',
    scanStatus: 'skipped',
  });

  if (id) await writeAudit(ctx, 'document.uploaded', 'document', id, null, { fileName: input.fileName });
  return id;
}

/**
 * Nuova versione di un documento. La specifica chiede «versionamento senza
 * sovrascrittura distruttiva»: il file precedente resta in `versions` e nello
 * storage, non viene rimpiazzato.
 */
export async function addDocumentVersion(
  ctx: CrmContextRef,
  id: string,
  version: { storagePath: string; downloadUrl: string; sizeBytes: number }
): Promise<void> {
  const current = await getDocumentById(id);
  if (!current) return;

  const nextVersion = {
    version: current.versions.length + 1,
    storagePath: version.storagePath,
    downloadUrl: version.downloadUrl,
    sizeBytes: version.sizeBytes,
    uploadedAt: new Date().toISOString(),
    uploadedBy: ctx.uid,
  };

  await updateRecord(COLLECTION_NAME, id, {
    storagePath: version.storagePath,
    downloadUrl: version.downloadUrl,
    sizeBytes: version.sizeBytes,
    versions: [...current.versions, nextVersion],
  }, ctx.uid);

  await writeAudit(ctx, 'document.version_added', 'document', id, null, { version: nextVersion.version });
}

export async function updateDocument(ctx: CrmContextRef, id: string, updates: Partial<CrmDocument>) {
  const payload: Record<string, any> = { ...updates };
  delete payload.versions;   // le versioni si aggiungono da addDocumentVersion
  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'document.updated', 'document', id, null, payload);
}

/** La specifica chiede che i download finiscano nell'audit. */
export async function recordDocumentDownload(ctx: CrmContextRef, id: string) {
  await writeAudit(ctx, 'document.downloaded', 'document', id);
}

export async function archiveDocument(ctx: CrmContextRef, id: string) {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'document.archived', 'document', id);
}

export async function restoreDocument(ctx: CrmContextRef, id: string) {
  await restoreRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'document.restored', 'document', id);
}
/**
 * Filtri, ordinamento e paginazione dei documenti.
 *
 * Funzioni pure come gli altri `*Filters.ts`: nessun Firestore, nessun React,
 * paginazione riusata da leadFilters. Stesso limite dichiarato altrove: si
 * lavora nel browser sull'insieme completo del progetto.
 */


/** Famiglie di formato: all'utente interessa «un PDF», non il MIME type. */
export type DocumentKind = 'pdf' | 'office' | 'image' | 'text' | 'media' | 'other';

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  pdf: 'PDF',
  office: 'Office',
  image: 'Immagini',
  text: 'Testo',
  media: 'Audio e video',
  other: 'Altro',
};

export function documentKind(document: CrmDocument): DocumentKind {
  const mime = document.mimeType || '';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return 'media';
  if (mime.startsWith('text/')) return 'text';
  if (mime.includes('officedocument')) return 'office';
  return 'other';
}

/** A quale entità è agganciato: serve alla colonna «collegato a» e al filtro. */
export type DocumentLink = 'lead' | 'account' | 'contact' | 'customer' | 'opportunity' | 'none';

export const DOCUMENT_LINK_LABELS: Record<DocumentLink, string> = {
  lead: 'Lead',
  account: 'Azienda',
  contact: 'Contatto',
  customer: 'Cliente',
  opportunity: 'Opportunità',
  none: 'Nessun collegamento',
};

export function documentLink(document: CrmDocument): DocumentLink {
  if (document.opportunityId) return 'opportunity';
  if (document.customerId) return 'customer';
  if (document.contactId) return 'contact';
  if (document.accountId) return 'account';
  if (document.leadId) return 'lead';
  return 'none';
}

export interface DocumentFilters {
  search: string;
  kinds: DocumentKind[];
  links: DocumentLink[];
  tags: string[];
  uploaderUids: string[];
  /** Solo documenti con più di una versione. */
  onlyVersioned: boolean;
  /** Solo documenti la cui data di conservazione è passata. */
  onlyExpired: boolean;
  includeArchived: boolean;
}

export const EMPTY_DOCUMENT_FILTERS: DocumentFilters = {
  search: '',
  kinds: [],
  links: [],
  tags: [],
  uploaderUids: [],
  onlyVersioned: false,
  onlyExpired: false,
  includeArchived: false,
};

export function countDocumentFilters(filters: DocumentFilters): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.kinds.length) count++;
  if (filters.links.length) count++;
  if (filters.tags.length) count++;
  if (filters.uploaderUids.length) count++;
  if (filters.onlyVersioned) count++;
  if (filters.onlyExpired) count++;
  if (filters.includeArchived) count++;
  return count;
}

/** Data di conservazione superata: il documento andrebbe eliminato secondo policy. */
export function isExpired(document: CrmDocument, today = new Date().toISOString().slice(0, 10)): boolean {
  return Boolean(document.retentionUntil) && document.retentionUntil! < today;
}

export function applyDocumentFilters(documents: CrmDocument[], filters: DocumentFilters): CrmDocument[] {
  const search = filters.search.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  return documents.filter(document => {
    if (!filters.includeArchived && document.archived) return false;

    if (search) {
      // Il testo estratto è vuoto finché non c'è un backend che lo riempia:
      // cercarci dentro ora non trova nulla, ma non sbaglia nulla.
      const haystack = [document.fileName, document.extension, document.extractedText, ...document.tags]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    if (filters.kinds.length && !filters.kinds.includes(documentKind(document))) return false;
    if (filters.links.length && !filters.links.includes(documentLink(document))) return false;
    if (filters.tags.length && !filters.tags.some(tag => document.tags.includes(tag))) return false;
    if (filters.uploaderUids.length && !filters.uploaderUids.includes(document.createdBy)) return false;
    if (filters.onlyVersioned && document.versions.length < 2) return false;
    if (filters.onlyExpired && !isExpired(document, today)) return false;

    return true;
  });
}

export type DocumentSortField = 'fileName' | 'sizeBytes' | 'createdAt' | 'updatedAt' | 'versions';

export interface DocumentSort {
  field: DocumentSortField;
  direction: 'asc' | 'desc';
}

export const DEFAULT_DOCUMENT_SORT: DocumentSort = { field: 'createdAt', direction: 'desc' };

export function applyDocumentSort(documents: CrmDocument[], sort: DocumentSort): CrmDocument[] {
  const sign = sort.direction === 'asc' ? 1 : -1;

  return [...documents].sort((a, b) => {
    switch (sort.field) {
      case 'fileName':
        return sign * a.fileName.localeCompare(b.fileName, 'it', { sensitivity: 'base' });
      case 'sizeBytes':
        return sign * (a.sizeBytes - b.sizeBytes);
      case 'versions':
        return sign * (a.versions.length - b.versions.length);
      case 'updatedAt':
        return sign * (toMillis(a.updatedAt) - toMillis(b.updatedAt));
      default:
        return sign * (toMillis(a.createdAt) - toMillis(b.createdAt));
    }
  });
}

export function buildDocumentView(
  documents: CrmDocument[],
  filters: DocumentFilters,
  sort: DocumentSort,
  page: number,
  pageSize: number
): Page<CrmDocument> {
  return paginate(applyDocumentSort(applyDocumentFilters(documents, filters), sort), page, pageSize);
}

/** Tutte le etichette in uso nel progetto, per il filtro e l'autocompletamento. */
export function collectTags(documents: CrmDocument[]): string[] {
  const tags = new Set<string>();
  documents.forEach(document => document.tags.forEach(tag => tags.add(tag)));
  return Array.from(tags).sort((a, b) => a.localeCompare(b, 'it'));
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Quanto spazio occupa il progetto, versioni vecchie comprese. */
export function totalStorageBytes(documents: CrmDocument[]): number {
  return documents.reduce(
    (sum, document) => sum + document.versions.reduce((v, version) => v + (version.sizeBytes || 0), 0),
    0
  );
}
/**
 * Caricamento di un file: Storage prima, Firestore dopo.
 *
 * Il file fisico sta su Firebase Storage, i metadati su `crm_documents`. Sono
 * due sistemi distinti e possono fallire separatamente, quindi l'ordine conta:
 * se la scrittura su Firestore non riesce il file appena caricato viene
 * rimosso, altrimenti resterebbe nel bucket senza che nulla lo nomini — spazio
 * occupato che nessuno saprebbe più ritrovare.
 *
 * Il caso inverso non si pulisce da solo: se è lo Storage a fallire non è
 * ancora stato creato niente, quindi non c'è nulla da annullare.
 */


/** A quale record si attacca il documento. Almeno uno va valorizzato. */
export interface DocumentTarget {
  leadId?: string;
  accountId?: string;
  contactId?: string;
  customerId?: string;
  opportunityId?: string;
  interactionId?: string;
  communicationId?: string;
}

export interface UploadOptions {
  target?: DocumentTarget;
  tags?: string[];
  visibility?: VisibilityLevel;
  retentionUntil?: string;
}

export interface UploadOutcome {
  id: string | null;
  fileName: string;
  error?: string;
}

/**
 * Nome sicuro per lo Storage: niente separatori di percorso, niente accenti,
 * niente spazi. Il nome originale resta nei metadati e nell'interfaccia — è
 * quello che l'utente riconosce — questo serve solo a costruire il percorso.
 */
export function safeFileName(name: string): string {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (cleaned || 'file').slice(0, 120);
}

/** `crm/<progetto>/<anno>/<istante>-<casuale>_<nome>`: il progetto in testa serve alle regole. */
export function buildStoragePath(projectId: string, fileName: string): string {
  const year = new Date().getFullYear();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `crm/${projectId}/${year}/${unique}_${safeFileName(fileName)}`;
}

interface StoredFile {
  storagePath: string;
  downloadUrl: string;
  sizeBytes: number;
}

function putFile(
  ctx: CrmContextRef,
  path: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<StoredFile> {
  return new Promise((resolve, reject) => {
    // `uid` e `projectId` finiscono nei metadati dell'oggetto perché le regole
    // di Storage possano leggerli: senza, «solo chi l'ha caricato può
    // rimuoverlo» non è una regola scrivibile, e la pulizia di un file orfano
    // richiederebbe di aprire la cancellazione a chiunque. Vedi rules/storage.rules.
    const task = uploadBytesResumable(ref(storage, path), file, {
      contentType: file.type,
      customMetadata: { uid: ctx.uid, projectId: ctx.projectId },
    });
    task.on(
      'state_changed',
      snapshot => {
        if (!onProgress || !snapshot.totalBytes) return;
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      error => reject(error),
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref);
          resolve({ storagePath: task.snapshot.ref.fullPath, downloadUrl, sizeBytes: file.size });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/** Rimuove un file rimasto senza metadati. Se anche questo fallisce lo si dice al log, non all'utente. */
async function discard(path: string): Promise<void> {
  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    console.error('Error discarding orphan CRM upload:', path, error);
  }
}

export async function uploadDocument(
  ctx: CrmContextRef,
  file: File,
  options: UploadOptions = {},
  onProgress?: (percent: number) => void
): Promise<UploadOutcome> {
  const validation = validateFile(file);
  if (!validation.ok) return { id: null, fileName: file.name, error: validation.reason };

  let stored: StoredFile;
  try {
    stored = await putFile(ctx, buildStoragePath(ctx.projectId, file.name), file, onProgress);
  } catch (error) {
    console.error('Error uploading CRM document:', error);
    return { id: null, fileName: file.name, error: 'Caricamento non riuscito' };
  }

  const input: CreateDocumentInput = {
    fileName: file.name,
    mimeType: file.type,
    extension: validation.extension || '',
    sizeBytes: stored.sizeBytes,
    storagePath: stored.storagePath,
    downloadUrl: stored.downloadUrl,
    visibility: options.visibility,
    tags: options.tags,
    retentionUntil: options.retentionUntil,
    ...(options.target || {}),
  };

  const id = await createDocument(ctx, input);
  if (!id) {
    await discard(stored.storagePath);
    return { id: null, fileName: file.name, error: 'Metadati non salvati: il file è stato rimosso' };
  }

  await trackWorkspaceStorage(ctx, stored.sizeBytes);

  return { id, fileName: file.name };
}

/**
 * Nuova versione di un documento esistente.
 *
 * Il file precedente NON viene toccato: resta nello Storage e in `versions`.
 * È il «versionamento senza sovrascrittura distruttiva» della specifica, e
 * significa che lo spazio occupato cresce a ogni versione.
 */
export async function uploadDocumentVersion(
  ctx: CrmContextRef,
  document: CrmDocument,
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadOutcome> {
  const validation = validateFile(file);
  if (!validation.ok) return { id: null, fileName: file.name, error: validation.reason };

  // Una versione è lo stesso documento più avanti nel tempo: cambiare formato a
  // metà strada renderebbe la cronologia illeggibile.
  if (file.type !== document.mimeType) {
    return {
      id: null,
      fileName: file.name,
      error: `La nuova versione deve essere dello stesso formato (${document.extension.toUpperCase()})`,
    };
  }

  let stored: StoredFile;
  try {
    stored = await putFile(ctx, buildStoragePath(ctx.projectId, file.name), file, onProgress);
  } catch (error) {
    console.error('Error uploading CRM document version:', error);
    return { id: null, fileName: file.name, error: 'Caricamento non riuscito' };
  }

  try {
    await addDocumentVersion(ctx, document.id, stored);
  } catch (error) {
    console.error('Error recording CRM document version:', error);
    await discard(stored.storagePath);
    return { id: null, fileName: file.name, error: 'Versione non registrata: il file è stato rimosso' };
  }

  await trackWorkspaceStorage(ctx, stored.sizeBytes);

  return { id: document.id, fileName: file.name };
}
