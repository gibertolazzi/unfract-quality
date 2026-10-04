'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useEffect, useState } from 'react';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { CrmDocument } from '@/components/crm/types';
import { formatBytes } from '@/lib/crm/documentFilters';

/**
 * Anteprima dentro la scheda, senza scaricare nulla a mano.
 *
 * Quello che si riesce a mostrare dipende dal browser, non da noi:
 *
 * - immagini, PDF, audio e video li rende il browser da solo (`img`, `iframe`,
 *   `audio`, `video`) e funzionano sempre;
 * - il **testo** va invece letto con `fetch`, e questo passa dal CORS del
 *   bucket: se `firebasestorage` non è configurato per accettare l'origine
 *   dell'applicazione la lettura fallisce. Non è un errore da nascondere —
 *   viene detto, con il rimando al file da scaricare;
 * - Word, Excel e PowerPoint non si aprono nel browser senza un convertitore
 *   lato server, che la deroga 2 esclude. Per quelli c'è il download, e basta
 *   dirlo invece di far finta che l'anteprima stia caricando.
 */

const TEXT_PREVIEW_LIMIT = 20000;

export function isPreviewableInline(document: CrmDocument): boolean {
  const mime = document.mimeType || '';
  return mime === 'application/pdf'
    || mime.startsWith('image/')
    || mime.startsWith('audio/')
    || mime.startsWith('video/')
    || mime.startsWith('text/');
}

function Unavailable({ document, reason }: { document: CrmDocument; reason: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#1A1A1A] px-4 py-10 text-center">
      <FileText size={20} className="text-[#3F3F3F]" />
      <p className="text-xs text-[#858585]">{reason}</p>
      <p className="text-[10px] text-[#3F3F3F]">
        {document.extension.toUpperCase()} · {formatBytes(document.sizeBytes)}
      </p>
      <a
        href={document.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-[#1A1A1A] px-3 py-1.5 text-[11px] text-[#C4C4C4] transition-colors hover:border-[#2A2A2A] hover:text-white"
      >
        <Download size={12} />
        Scarica il file
      </a>
    </div>
  );
}

function TextPreview({ document }: { document: CrmDocument }) {
  const [content, setContent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setFailed(false);

    fetch(document.downloadUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(text => { if (!cancelled) setContent(text.slice(0, TEXT_PREVIEW_LIMIT)); })
      .catch(error => {
        console.error('Error reading CRM document preview:', error);
        if (!cancelled) setFailed(true);
      });

    return () => { cancelled = true; };
  }, [document.downloadUrl]);

  if (failed) {
    return (
      <Unavailable
        document={document}
        reason="Anteprima non leggibile dal browser: il bucket non consente la lettura da questa origine."
      />
    );
  }
  if (content === null) return <p className="py-10 text-center text-xs text-[#5A5A5A]">Lettura del file…</p>;

  return (
    <div className="flex flex-col gap-2">
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-[#1A1A1A] bg-black/30 p-3 text-[11px] leading-relaxed text-[#C4C4C4]">
        {content || '(file vuoto)'}
      </pre>
      {content.length >= TEXT_PREVIEW_LIMIT && (
        <p className="text-[10px] text-[#5A5A5A]">
          Mostrati i primi {TEXT_PREVIEW_LIMIT.toLocaleString('it-IT')} caratteri: il resto è nel file.
        </p>
      )}
    </div>
  );
}

export function DocumentPreview({ document }: { document: CrmDocument }) {
  const { t } = useTranslation();
  const mime = document.mimeType || '';

  if (!document.downloadUrl) {
    return <Unavailable document={document} reason="Questo documento non ha un file collegato." />;
  }

  if (mime.startsWith('image/')) {
    return (
      <img
        src={document.downloadUrl}
        alt={document.fileName}
        className="max-h-[420px] w-full rounded-2xl border border-[#1A1A1A] object-contain"
      />
    );
  }

  if (mime === 'application/pdf') {
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={document.downloadUrl}
          title={document.fileName}
          className="h-[420px] w-full rounded-2xl border border-[#1A1A1A] bg-black/30"
        />
        <a
          href={document.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 self-start text-[10px] text-[#5A5A5A] transition-colors hover:text-[#858585]"
        >
          <ExternalLink size={10} />
          Apri a schermo intero
        </a>
      </div>
    );
  }

  if (mime.startsWith('audio/')) {
    return <audio controls src={document.downloadUrl} className="w-full" />;
  }

  if (mime.startsWith('video/')) {
    return (
      <video controls src={document.downloadUrl} className="max-h-[420px] w-full rounded-2xl border border-[#1A1A1A]" />
    );
  }

  if (mime.startsWith('text/')) return <TextPreview document={document} />;

  return (
    <Unavailable
      document={document}
      reason="Questo formato non si apre nel browser: serve l’applicazione con cui è stato creato."
    />
  );
}
