'use client';

import {
  Archive, Download, FileText, FileSpreadsheet, FileImage, FileAudio, FileVideo, File, Clock,
} from 'lucide-react';
import { CrmDocument } from '@/components/crm/types';
import { Page } from '@/lib/crm/leadFilters';
import {
  DocumentSort, DocumentSortField, DocumentKind, documentKind, documentLink,
  DOCUMENT_LINK_LABELS, formatBytes, isExpired,
} from '@/lib/crm/documentFilters';
import { ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate } from '../shared/TableUtils';

interface DocumentTableProps {
  page: Page<CrmDocument>;
  sort: DocumentSort;
  /** Nome leggibile del record collegato: lo conosce solo la sezione. */
  linkName: (document: CrmDocument) => string;
  uploaderName: (uid: string) => string;
  onSortChange: (sort: DocumentSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpen: (document: CrmDocument) => void;
  onDownload: (document: CrmDocument) => void;
  onArchive: (document: CrmDocument) => void;
}

const COLUMNS: ColumnDef<DocumentSortField>[] = [
  { field: 'fileName',  label: 'Documento' },
  { field: 'versions',  label: 'Versioni', align: 'right', initial: 'desc' },
  { field: 'sizeBytes', label: 'Dimensione', align: 'right', initial: 'desc' },
  { field: 'createdAt', label: 'Caricato', initial: 'desc' },
];

const KIND_ICONS: Record<DocumentKind, any> = {
  pdf: FileText,
  office: FileSpreadsheet,
  image: FileImage,
  text: FileText,
  media: FileAudio,
  other: File,
};

export function DocumentTable({
  page, sort, linkName, uploaderName,
  onSortChange, onPageChange, onPageSizeChange, onOpen, onDownload, onArchive,
}: DocumentTableProps) {
  if (page.totalItems === 0) {
    return (
      <EmptyState
        title="Nessun documento corrisponde ai filtri"
        hint="Carica un file trascinandolo qui sopra, oppure azzera la ricerca"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#1A1A1A] bg-black/30">
              <SortableHeaders columns={COLUMNS} sort={sort} onSortChange={onSortChange} />
              <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">
                Collegato a
              </th>
              <th className="w-20" />
            </tr>
          </thead>

          <tbody>
            {page.items.map(document => {
              const kind = documentKind(document);
              const Icon = document.mimeType.startsWith('video/') ? FileVideo : KIND_ICONS[kind];
              const link = documentLink(document);
              const expired = isExpired(document);

              return (
                <tr
                  key={document.id}
                  className={`group border-b border-[#131313] transition-colors last:border-0 hover:bg-white/[0.03] ${
                    document.archived ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(document)}
                      className="flex items-start gap-2 text-left"
                    >
                      <Icon size={14} className="mt-0.5 shrink-0 text-[#5A5A5A]" />
                      <span className="flex flex-col">
                        <span className="text-xs font-medium text-white group-hover:underline">
                          {document.fileName || '—'}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] uppercase text-[#5A5A5A]">
                            {document.extension || '?'}
                          </span>
                          {document.tags.map(tag => (
                            <span key={tag} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-[#858585]">
                              {tag}
                            </span>
                          ))}
                          {expired && (
                            <span
                              title="Data di conservazione superata"
                              className="flex items-center gap-1 rounded-full bg-[#F59E0B]/15 px-1.5 py-0.5 text-[9px] text-[#F59E0B]"
                            >
                              <Clock size={9} /> da eliminare
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs ${document.versions.length > 1 ? 'text-white' : 'text-[#5A5A5A]'}`}>
                      v{document.versions.length}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-[#C4C4C4]">{formatBytes(document.sizeBytes)}</span>
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-xs text-[#C4C4C4]">{formatDate(document.createdAt)}</span>
                    <span className="block text-[11px] text-[#5A5A5A]">{uploaderName(document.createdBy)}</span>
                  </td>

                  <td className="px-4 py-3">
                    {link === 'none' ? (
                      <span className="text-[11px] text-[#3F3F3F]">nessuno</span>
                    ) : (
                      <span className="flex flex-col">
                        <span className="text-xs text-[#C4C4C4]">{linkName(document)}</span>
                        <span className="text-[11px] text-[#5A5A5A]">{DOCUMENT_LINK_LABELS[link]}</span>
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        title="Scarica"
                        onClick={() => onDownload(document)}
                        className="rounded-lg p-1.5 text-[#5A5A5A] transition-colors hover:bg-white/5 hover:text-white"
                      >
                        <Download size={13} />
                      </button>
                      {!document.archived && (
                        <button
                          type="button"
                          title="Archivia"
                          onClick={() => onArchive(document)}
                          className="rounded-lg p-1.5 text-[#5A5A5A] transition-colors hover:bg-white/5 hover:text-white"
                        >
                          <Archive size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
    </div>
  );
}
