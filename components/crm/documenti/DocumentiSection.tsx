'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useMemo, useState } from 'react';
import { Search, X, HardDrive } from 'lucide-react';
import {
  CrmDocument, CrmDocumentVersion, CrmLead, CrmAccount, CrmContact, CrmCustomer, CrmOpportunity,
} from '@/components/crm/types';
import {
  DocumentFilters, DocumentSort, DocumentKind, DocumentLink,
  EMPTY_DOCUMENT_FILTERS, DEFAULT_DOCUMENT_SORT, DOCUMENT_KIND_LABELS, DOCUMENT_LINK_LABELS,
  buildDocumentView, countDocumentFilters, collectTags, documentLink,
  formatBytes, totalStorageBytes, isExpired,
} from '@/lib/crm/documentFilters';
import { UploadOutcome } from '@/lib/crm/documentUpload';
import { inputClass } from '../shared/TableUtils';
import { UploadPanel, UploadRunner } from './UploadPanel';
import { DocumentTable } from './DocumentTable';
import { DocumentDrawer } from './DocumentDrawer';

interface DocumentiSectionProps {
  documents: CrmDocument[];
  leads: CrmLead[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  ownerName: (uid: string) => string;
  loading?: boolean;
  /** Carica un documento non collegato a nessun record: da qui si carica «nel progetto». */
  onUpload: UploadRunner;
  onUploadVersion: (document: CrmDocument) => UploadRunner;
  onUpdate: (document: CrmDocument, updates: Partial<CrmDocument>) => Promise<void> | void;
  onDownload: (document: CrmDocument, version?: CrmDocumentVersion) => void;
  onArchive: (document: CrmDocument) => void;
  onRestore: (document: CrmDocument) => void;
}

const KINDS: DocumentKind[] = ['pdf', 'office', 'image', 'text', 'media', 'other'];
const LINKS: DocumentLink[] = ['lead', 'account', 'contact', 'customer', 'opportunity', 'none'];

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-[#5A5A5A] hover:bg-white/5 hover:text-[#858585]'
      }`}
    >
      {label}
    </button>
  );
}

export function DocumentiSection({
  documents, leads, accounts, contacts, customers, opportunities, ownerName, loading,
  onUpload, onUploadVersion, onUpdate, onDownload, onArchive, onRestore,
}: DocumentiSectionProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<DocumentFilters>({ ...EMPTY_DOCUMENT_FILTERS });
  const [sort, setSort] = useState<DocumentSort>({ ...DEFAULT_DOCUMENT_SORT });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openId, setOpenId] = useState<string | null>(null);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach(l => map.set(`lead:${l.id}`, l.fullName || l.companyName || 'Lead'));
    accounts.forEach(a => map.set(`account:${a.id}`, a.displayName || a.legalName || 'Azienda'));
    contacts.forEach(c => map.set(
      `contact:${c.id}`,
      [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || 'Contatto'
    ));
    // Il cliente non ha un nome suo: lo prende dall'azienda, come nelle altre schede.
    customers.forEach(c => map.set(
      `customer:${c.id}`,
      accounts.find(a => a.id === c.accountId)?.displayName || 'Cliente'
    ));
    opportunities.forEach(o => map.set(`opportunity:${o.id}`, o.title || 'Opportunità'));
    return map;
  }, [leads, accounts, contacts, customers, opportunities]);

  /**
   * Nome del record collegato. Se il record non c'è più (archiviato altrove o
   * mai esistito) si dice che il collegamento è rotto, invece di mostrare un
   * identificativo che non significa niente per chi legge.
   */
  const linkName = (document: CrmDocument) => {
    const link = documentLink(document);
    if (link === 'none') return '';
    const id = link === 'lead' ? document.leadId
      : link === 'account' ? document.accountId
      : link === 'contact' ? document.contactId
      : link === 'customer' ? document.customerId
      : document.opportunityId;
    return names.get(`${link}:${id}`) || 'record non trovato';
  };

  const tags = useMemo(() => collectTags(documents), [documents]);
  const uploaders = useMemo(
    () => Array.from(new Set(documents.map(d => d.createdBy).filter(Boolean))),
    [documents]
  );

  const view = useMemo(
    () => buildDocumentView(documents, filters, sort, page, pageSize),
    [documents, filters, sort, page, pageSize]
  );

  const live = documents.filter(d => !d.archived);
  const expiredCount = live.filter(d => isExpired(d)).length;
  const activeFilters = countDocumentFilters(filters);
  const openDocument = openId ? documents.find(d => d.id === openId) || null : null;

  const patch = (next: Partial<DocumentFilters>) => {
    setFilters(prev => ({ ...prev, ...next }));
    setPage(1);
  };

  const toggle = <K extends 'kinds' | 'links' | 'tags' | 'uploaderUids'>(key: K, value: string) => {
    const current = filters[key] as string[];
    patch({
      [key]: current.includes(value) ? current.filter(v => v !== value) : [...current, value],
    } as Partial<DocumentFilters>);
  };

  const uploadedHint = (outcomes: UploadOutcome[]) => outcomes.filter(o => o.id).length;

  return (
    <div className="flex flex-col gap-4">
      <UploadPanel onUpload={onUpload} onDone={outcomes => { if (uploadedHint(outcomes)) setPage(1); }} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex flex-1 items-center">
          <Search size={13} className="absolute left-3 text-[#5A5A5A]" />
          <input
            value={filters.search}
            onChange={e => patch({ search: e.target.value })}
            placeholder="Cerca per nome file o etichetta"
            className="w-full rounded-full border border-[#1A1A1A] bg-black/30 py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"
          />
        </label>

        <span className="flex items-center gap-1.5 text-[11px] text-[#5A5A5A]">
          <HardDrive size={12} />
          {formatBytes(totalStorageBytes(documents))} occupati
          <span className="text-[#3F3F3F]">· versioni comprese</span>
        </span>

        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => { setFilters({ ...EMPTY_DOCUMENT_FILTERS }); setPage(1); }}
            className="flex items-center gap-1 text-[11px] text-[#858585] transition-colors hover:text-white"
          >
            <X size={11} />
            Azzera {activeFilters} filtri
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {KINDS.map(kind => (
          <Chip
            key={kind}
            label={DOCUMENT_KIND_LABELS[kind]}
            active={filters.kinds.includes(kind)}
            onClick={() => toggle('kinds', kind)}
          />
        ))}
        <span className="mx-1 h-4 w-px bg-[#1A1A1A]" />
        {LINKS.map(link => (
          <Chip
            key={link}
            label={DOCUMENT_LINK_LABELS[link]}
            active={filters.links.includes(link)}
            onClick={() => toggle('links', link)}
          />
        ))}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] uppercase tracking-wide text-[#3F3F3F]">{t.crm.tags}</span>
          {tags.map(tag => (
            <Chip key={tag} label={tag} active={filters.tags.includes(tag)} onClick={() => toggle('tags', tag)} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <label className="flex items-center gap-1.5 text-[#858585]">
          <input
            type="checkbox"
            checked={filters.onlyVersioned}
            onChange={e => patch({ onlyVersioned: e.target.checked })}
            className="accent-white"
          />
          Solo con più versioni
        </label>

        <label className="flex items-center gap-1.5 text-[#858585]">
          <input
            type="checkbox"
            checked={filters.onlyExpired}
            onChange={e => patch({ onlyExpired: e.target.checked })}
            className="accent-white"
          />
          Solo da eliminare
          {expiredCount > 0 && <span className="text-[#F59E0B]">{expiredCount}</span>}
        </label>

        <label className="flex items-center gap-1.5 text-[#858585]">
          <input
            type="checkbox"
            checked={filters.includeArchived}
            onChange={e => patch({ includeArchived: e.target.checked })}
            className="accent-white"
          />
          Mostra archiviati
        </label>

        {uploaders.length > 1 && (
          <select
            value={filters.uploaderUids[0] || ''}
            onChange={e => patch({ uploaderUids: e.target.value ? [e.target.value] : [] })}
            className={inputClass}
          >
            <option value="">Chiunque</option>
            {uploaders.map(uid => <option key={uid} value={uid}>{ownerName(uid)}</option>)}
          </select>
        )}

        <span className="ml-auto text-[#5A5A5A]">
          {view.totalItems} di {documents.length} documenti
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-[#858585]">Caricamento documenti…</p>
      ) : (
        <DocumentTable
          page={view}
          sort={sort}
          linkName={linkName}
          uploaderName={ownerName}
          onSortChange={setSort}
          onPageChange={setPage}
          onPageSizeChange={size => { setPageSize(size); setPage(1); }}
          onOpen={document => setOpenId(document.id)}
          onDownload={document => onDownload(document)}
          onArchive={onArchive}
        />
      )}

      {openDocument && (
        <DocumentDrawer
          document={openDocument}
          linkName={linkName}
          uploaderName={ownerName}
          knownTags={tags}
          onClose={() => setOpenId(null)}
          onUpdate={updates => onUpdate(openDocument, updates)}
          onDownload={version => onDownload(openDocument, version)}
          onArchive={() => onArchive(openDocument)}
          onRestore={() => onRestore(openDocument)}
          onUploadVersion={onUploadVersion(openDocument)}
        />
      )}
    </div>
  );
}
