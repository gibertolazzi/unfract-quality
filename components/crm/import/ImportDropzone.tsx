'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileJson, FileText, AlertTriangle } from 'lucide-react';
import { ParsedFile } from '@/lib/crm/import/parse';

interface ImportDropzoneProps {
  parsing: boolean;
  parsed: ParsedFile | null;
  error: string;
  sheetIndex: number;
  headerRow: number;
  onFile: (file: File) => void;
  onSheetChange: (index: number) => void;
  onHeaderRowChange: (index: number) => void;
}

const ACCEPTED = '.csv,.tsv,.txt,.json,.jsonl,.ndjson,.xlsx,.xlsm';

const selectClass =
  'rounded-lg border border-[#1A1A1A] bg-black/30 px-2.5 py-1.5 text-xs text-white focus:border-[#2A2A2A] focus:outline-none';

export function ImportDropzone({
  parsing, parsed, error, sheetIndex, headerRow,
  onFile, onSheetChange, onHeaderRowChange,
}: ImportDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const sheet = parsed?.sheets[sheetIndex];
  // L'intestazione si sceglie fra le prime righe: più in giù non ha senso.
  const headerOptions = sheet ? sheet.rows.slice(0, Math.min(sheet.rows.length, 10)) : [];

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-white/40 bg-white/5' : 'border-[#2A2A2A] hover:border-[#3F3F3F]'
        }`}
      >
        <Upload size={20} className="text-[#858585]" />
        <p className="text-xs text-white">
          {parsing ? 'Lettura del file…' : 'Trascina qui il file, oppure clicca per sceglierlo'}
        </p>
        <p className="text-[10px] text-[#5A5A5A]">Excel (.xlsx), CSV, TSV, JSON, TXT — fino a qualche migliaio di righe</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';      // lo stesso file va ricaricabile dopo una correzione
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#EF4444]" />
          <p className="text-xs text-[#EF4444]">{error}</p>
        </div>
      )}

      {parsed && sheet && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#1A1A1A] bg-black/20 p-4">
          <div className="flex items-center gap-2">
            {parsed.format === 'xlsx' ? <FileSpreadsheet size={14} className="text-[#10B981]" />
              : parsed.format === 'json' ? <FileJson size={14} className="text-[#8B5CF6]" />
              : <FileText size={14} className="text-[#0EA5E9]" />}
            <span className="text-xs text-white">{parsed.fileName}</span>
            <span className="text-[10px] text-[#5A5A5A]">
              {sheet.rows.length} righe lette
              {parsed.delimiter && ` · separatore "${parsed.delimiter === '\t' ? 'tab' : parsed.delimiter}"`}
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            {parsed.sheets.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Foglio</span>
                <select
                  value={sheetIndex}
                  onChange={e => onSheetChange(Number(e.target.value))}
                  className={selectClass}
                >
                  {parsed.sheets.map((s, i) => (
                    <option key={s.name} value={i}>{s.name} ({s.rows.length} righe)</option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Riga di intestazione</span>
              <select
                value={headerRow}
                onChange={e => onHeaderRowChange(Number(e.target.value))}
                className={`${selectClass} max-w-[22rem]`}
              >
                {headerOptions.map((row, i) => (
                  <option key={i} value={i}>
                    Riga {i + 1} — {row.filter(Boolean).slice(0, 4).join(' · ').slice(0, 60) || '(vuota)'}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {parsed.notes.map(note => (
            <p key={note} className="text-[10px] text-[#F59E0B]">{note}</p>
          ))}
        </div>
      )}
    </div>
  );
}
