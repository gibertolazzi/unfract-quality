'use client';

import { useEffect, useState } from 'react';
import { X, Archive, ArchiveRestore, Download, Plus, History, Clock } from 'lucide-react';
import { CrmDocument, CrmDocumentVersion } from '@/components/crm/types';
import { VisibilityLevel } from '@/components/crm/constants';
import { formatBytes, isExpired, documentLink, DOCUMENT_LINK_LABELS } from '@/lib/crm/documentFilters';
import { formatDate, inputClass } from '../shared/TableUtils';
import { DocumentPreview } from './DocumentPreview';
import { UploadPanel, UploadRunner } from './UploadPanel';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

interface DocumentDrawerProps {
  document: CrmDocument;
  linkName: (document: CrmDocument) => string;
  uploaderName: (uid: string) => string;
  /** Etichette già in uso nel progetto: si riusano invece di inventarne di nuove. */
  knownTags: string[];
  onClose: () => void;
  onUpdate: (updates: Partial<CrmDocument>) => Promise<void> | void;
  /** Senza versione scarica quella corrente. Passa da qui anche per finire nell'audit. */
  onDownload: (version?: CrmDocumentVersion) => void;
  onArchive: () => void;
  onRestore: () => void;
  onUploadVersion: UploadRunner;
}

const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  team: 'Tutto il team del progetto',
  commercial: 'Solo chi ha ruolo commerciale',
  private: 'Solo chi l’ha caricato',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
      <span className="text-right text-xs text-[#C4C4C4]">{children}</span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">
        {title}{count !== undefined && ` · ${count}`}
      </h3>
      {children}
    </section>
  );
}

export function DocumentDrawer({
  document, linkName, uploaderName, knownTags,
  onClose, onUpdate, onDownload, onArchive, onRestore, onUploadVersion,
}: DocumentDrawerProps) {
  useCloseOnEscape(onClose);

  const [tagDraft, setTagDraft] = useState('');
  const [newVersion, setNewVersion] = useState(false);

  // Quando arriva una versione nuova il documento cambia sotto i piedi:
  // il riquadro di caricamento si richiude da solo, così si vede l'elenco
  // aggiornato invece dell'area di trascinamento appena usata.
  useEffect(() => { setNewVersion(false); }, [document.versions.length]);

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag || document.tags.includes(tag)) { setTagDraft(''); return; }
    onUpdate({ tags: [...document.tags, tag] });
    setTagDraft('');
  };

  const link = documentLink(document);
  const expired = isExpired(document);
  // In ordine inverso: l'ultima versione è quella che interessa.
  const versions = [...document.versions].sort((a, b) => b.version - a.version);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-black/50" onClick={onClose} />

      <aside className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-start justify-between gap-3 border-b border-[#1A1A1A] px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="truncate text-sm font-medium text-white">{document.fileName || '—'}</h2>
            <p className="text-[11px] text-[#5A5A5A]">
              {document.extension.toUpperCase()} · {formatBytes(document.sizeBytes)} · v{document.versions.length}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => onDownload()} title="Scarica" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
              <Download size={14} />
            </button>
            {document.archived ? (
              <button type="button" onClick={onRestore} title="Ripristina" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
                <ArchiveRestore size={14} />
              </button>
            ) : (
              <button type="button" onClick={onArchive} title="Archivia" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-[#EF4444]">
                <Archive size={14} />
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white">
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {document.archived && (
            <p className="rounded-xl border border-[#1A1A1A] bg-white/[0.02] px-3 py-2 text-[11px] text-[#858585]">
              Documento archiviato. Il file resta nello storage: l’archiviazione nasconde, non cancella.
            </p>
          )}

          {expired && (
            <p className="flex items-center gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-[11px] text-[#F59E0B]">
              <Clock size={12} />
              La data di conservazione è passata ({document.retentionUntil}). L’eliminazione va fatta a mano:
              nessun processo la esegue da solo.
            </p>
          )}

          <DocumentPreview document={document} />

          <Section title="Dati">
            <div className="divide-y divide-[#131313]">
              <Row label="Caricato">
                {formatDate(document.createdAt)} da {uploaderName(document.createdBy)}
              </Row>
              <Row label="Aggiornato">{formatDate(document.updatedAt)}</Row>
              <Row label="Formato">{document.mimeType || '—'}</Row>
              <Row label="Collegato a">
                {link === 'none' ? 'nessun record' : `${linkName(document)} · ${DOCUMENT_LINK_LABELS[link]}`}
              </Row>
              <Row label="Provenienza">{document.origin}</Row>
              <Row label="Controllo antivirus">
                {document.scanStatus === 'skipped' ? 'non eseguito' : document.scanStatus}
              </Row>
            </div>
          </Section>

          <Section title="Etichette" count={document.tags.length}>
            <div className="flex flex-wrap items-center gap-1.5">
              {document.tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  title="Togli l’etichetta"
                  onClick={() => onUpdate({ tags: document.tags.filter(t => t !== tag) })}
                  className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#C4C4C4] hover:bg-white/10"
                >
                  {tag}
                  <X size={9} />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                list="crm-document-tags"
                value={tagDraft}
                onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Aggiungi un’etichetta"
                className={`${inputClass} flex-1`}
              />
              <datalist id="crm-document-tags">
                {knownTags.map(tag => <option key={tag} value={tag} />)}
              </datalist>
              <button
                type="button"
                onClick={addTag}
                className="rounded-lg border border-[#1A1A1A] p-2 text-[#858585] transition-colors hover:text-white"
              >
                <Plus size={13} />
              </button>
            </div>
          </Section>

          <Section title="Visibilità e conservazione">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Chi può vederlo</span>
              <select
                value={document.visibility}
                onChange={e => onUpdate({ visibility: e.target.value as VisibilityLevel })}
                className={inputClass}
              >
                {(Object.keys(VISIBILITY_LABELS) as VisibilityLevel[]).map(level => (
                  <option key={level} value={level}>{VISIBILITY_LABELS[level]}</option>
                ))}
              </select>
              <span className="text-[10px] text-[#5A5A5A]">
                È un’indicazione per l’interfaccia. Finché le regole Firestore non la applicano,
                chi ha accesso al progetto vede comunque il file.
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Conservare fino al</span>
              <input
                type="date"
                value={document.retentionUntil || ''}
                onChange={e => onUpdate({ retentionUntil: e.target.value })}
                className={inputClass}
              />
            </label>
          </Section>

          <Section title="Versioni" count={document.versions.length}>
            <ul className="flex flex-col gap-1">
              {versions.map(version => (
                <li
                  key={version.version}
                  className="flex items-center gap-3 rounded-xl border border-[#1A1A1A] px-3 py-2"
                >
                  <History size={12} className="shrink-0 text-[#5A5A5A]" />
                  <span className="text-[11px] text-white">v{version.version}</span>
                  <span className="text-[10px] text-[#5A5A5A]">
                    {formatDate(version.uploadedAt)} · {uploaderName(version.uploadedBy)} · {formatBytes(version.sizeBytes)}
                  </span>
                  {version.version === document.versions.length && (
                    <span className="text-[9px] text-[#10B981]">corrente</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDownload(version)}
                    title="Scarica questa versione"
                    className="ml-auto rounded-lg p-1 text-[#5A5A5A] transition-colors hover:text-white"
                  >
                    <Download size={12} />
                  </button>
                </li>
              ))}
            </ul>

            {newVersion ? (
              <UploadPanel compact single onUpload={onUploadVersion} targetLabel={`una nuova versione di ${document.fileName}`} />
            ) : (
              <button
                type="button"
                onClick={() => setNewVersion(true)}
                className="flex items-center gap-2 self-start rounded-xl border border-[#1A1A1A] px-3 py-1.5 text-[11px] text-[#C4C4C4] transition-colors hover:border-[#2A2A2A] hover:text-white"
              >
                <Plus size={12} />
                Carica una nuova versione
              </button>
            )}

            <p className="text-[10px] text-[#5A5A5A]">
              Le versioni precedenti restano nello storage e restano scaricabili: non vengono sovrascritte.
            </p>
          </Section>
        </div>
      </aside>
    </div>
  );
}
