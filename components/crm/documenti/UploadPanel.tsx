'use client';

import { useRef, useState } from 'react';
import { Upload, FileUp, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from '@/lib/crm/documents';
import { UploadOutcome } from '@/lib/crm/documentUpload';
import { formatBytes } from '@/lib/crm/documentFilters';

/**
 * Area di caricamento: trascinamento o selezione, più file alla volta.
 *
 * I file si caricano **uno per volta**, non in parallelo. Con una decina di
 * allegati da qualche megabyte il parallelo satura la banda in salita e le
 * percentuali si muovono tutte insieme senza che nessuna arrivi in fondo; in
 * fila invece si vede cosa sta salendo e un errore si attribuisce al file
 * giusto. Chi fallisce non ferma gli altri: l'esito è per riga.
 */

export type UploadRunner = (
  file: File,
  onProgress: (percent: number) => void
) => Promise<UploadOutcome>;

interface UploadPanelProps {
  /** Descrizione del collegamento, mostrata all'utente: il collegamento vero sta nel runner. */
  targetLabel?: string;
  onUpload: UploadRunner;
  onDone?: (uploaded: UploadOutcome[]) => void;
  compact?: boolean;
  /** Un file solo: usato dalle versioni, dove «più file» non vuol dire niente. */
  single?: boolean;
}

interface Row {
  name: string;
  size: number;
  percent: number;
  state: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string;
}

const ACCEPT = Object.keys(ALLOWED_MIME_TYPES).join(',');
const EXTENSIONS = Array.from(new Set(Object.values(ALLOWED_MIME_TYPES))).join(' · ');

export function UploadPanel({ targetLabel, onUpload, onDone, compact, single }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || running) return;

    const list = single ? [files[0]] : Array.from(files);
    setRows(list.map(file => ({ name: file.name, size: file.size, percent: 0, state: 'waiting' })));
    setRunning(true);

    const outcomes: UploadOutcome[] = [];

    for (let index = 0; index < list.length; index++) {
      setRows(prev => prev.map((row, i) => (i === index ? { ...row, state: 'uploading' } : row)));

      const outcome = await onUpload(list[index], percent => {
        setRows(prev => prev.map((row, i) => (i === index ? { ...row, percent } : row)));
      });
      outcomes.push(outcome);

      setRows(prev => prev.map((row, i) => (
        i === index
          ? { ...row, percent: 100, state: outcome.error ? 'error' : 'done', error: outcome.error }
          : row
      )));
    }

    setRunning(false);
    if (inputRef.current) inputRef.current.value = '';
    onDone?.(outcomes);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={event => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => !running && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed transition-colors ${
          compact ? 'py-6' : 'py-10'
        } ${dragging ? 'border-white/40 bg-white/5' : 'border-[#1A1A1A] hover:border-[#2A2A2A]'} ${
          running ? 'cursor-wait opacity-60' : ''
        }`}
      >
        <Upload size={compact ? 16 : 20} className="text-[#5A5A5A]" />
        <p className="text-xs text-[#C4C4C4]">
          {running ? 'Caricamento in corso…' : 'Trascina i file qui, oppure fai clic per sceglierli'}
        </p>
        {targetLabel && (
          <p className="text-[11px] text-center text-[#5A5A5A]">Verranno collegati a {targetLabel}</p>
        )}
        {!compact && (
          <p className="text-[10px] text-[#3F3F3F]">
            {EXTENSIONS} — massimo {Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB per file
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple={!single}
          accept={ACCEPT}
          className="hidden"
          onChange={event => handleFiles(event.target.files)}
        />
      </div>

      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row, index) => (
            <li key={`${row.name}-${index}`} className="flex flex-col gap-1 rounded-xl border border-[#1A1A1A] px-3 py-2">
              <div className="flex items-center gap-2">
                {row.state === 'done' && <CheckCircle2 size={12} className="shrink-0 text-[#10B981]" />}
                {row.state === 'error' && <AlertTriangle size={12} className="shrink-0 text-[#EF4444]" />}
                {(row.state === 'waiting' || row.state === 'uploading') && (
                  <FileUp size={12} className="shrink-0 text-[#5A5A5A]" />
                )}

                <span className="min-w-0 flex-1 truncate text-[11px] text-white">{row.name}</span>
                <span className="shrink-0 text-[10px] text-[#5A5A5A]">{formatBytes(row.size)}</span>
                {row.state === 'uploading' && (
                  <span className="shrink-0 text-[10px] text-[#858585]">{row.percent}%</span>
                )}
              </div>

              {row.state === 'uploading' && (
                <div className="h-0.5 w-full overflow-hidden rounded-full bg-[#1A1A1A]">
                  <div className="h-full bg-white/60 transition-all" style={{ width: `${row.percent}%` }} />
                </div>
              )}

              {row.error && <span className="text-[10px] text-[#EF4444]">{row.error}</span>}
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && !running && (
        <button
          type="button"
          onClick={() => setRows([])}
          className="flex items-center gap-1 self-start text-[10px] text-[#5A5A5A] transition-colors hover:text-[#858585]"
        >
          <X size={10} />
          Nascondi l’esito
        </button>
      )}
    </div>
  );
}
