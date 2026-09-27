/**
 * Da file a tabella: CSV, TSV, TXT delimitato, JSON, XLSX.
 *
 * Funzioni pure, nessun Firebase: il parsing è la parte più facile da
 * sbagliare in silenzio, e così resta verificabile per conto suo.
 */

import { readXlsx, XlsxError } from './xlsx';

export type SourceFormat = 'csv' | 'tsv' | 'txt' | 'json' | 'xlsx';

export interface ParsedSheet {
  name: string;
  /** Righe grezze, intestazione compresa. */
  rows: string[][];
}

export interface ParsedFile {
  fileName: string;
  format: SourceFormat;
  sheets: ParsedSheet[];
  /** Delimitatore riconosciuto, per i formati testuali. */
  delimiter?: string;
  /** Cose che l'utente deve sapere sul file, non errori. */
  notes: string[];
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

// ------------------------------------------------------------------ testo

const DELIMITERS = [',', ';', '\t', '|'];

/**
 * Riconosce il separatore contando le occorrenze fuori dalle virgolette nelle
 * prime righe, e scegliendo quello che dà il numero di colonne più costante.
 * Il punto e virgola conta: è il separatore di Excel in italiano.
 */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 20);
  if (sample.length === 0) return ',';

  let best = ',';
  let bestScore = -1;

  DELIMITERS.forEach(delimiter => {
    const counts = sample.map(line => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes;
        else if (!inQuotes && line[i] === delimiter) count++;
      }
      return count;
    });

    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return;

    // Penalizza i separatori che danno righe di lunghezza diversa.
    const average = total / counts.length;
    const variance = counts.reduce((sum, c) => sum + (c - average) ** 2, 0) / counts.length;
    const score = average - variance;

    if (score > bestScore) { bestScore = score; best = delimiter; }
  });

  return best;
}

/**
 * Parser delimitato con virgolette secondo RFC 4180: campi quotati, virgolette
 * raddoppiate, a capo dentro al campo.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const clean = text.replace(/^﻿/, '');   // BOM di Excel

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') { inQuotes = true; continue; }
    if (char === delimiter) { row.push(field); field = ''; continue; }
    if (char === '\r') continue;
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }

    field += char;
  }

  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  // Le righe vuote restano: si scartano dopo, in toTable, per non sfalsare la
  // numerazione che l'utente vede nel foglio. Si toglie solo la coda.
  while (rows.length > 0 && !rows[rows.length - 1].some(cell => cell.trim() !== '')) rows.pop();
  return rows;
}

// ------------------------------------------------------------------- json

/** Appiattisce gli oggetti annidati: `{ sede: { citta } }` → `sede.citta`. */
function flatten(value: any, prefix = '', output: Record<string, string> = {}): Record<string, string> {
  if (value === null || value === undefined) {
    if (prefix) output[prefix] = '';
    return output;
  }
  if (Array.isArray(value)) {
    // Un array di valori semplici resta una cella sola: "a, b, c".
    output[prefix] = value.map(v => (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v))).join(', ');
    return output;
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, nested]) => {
      flatten(nested, prefix ? `${prefix}.${key}` : key, output);
    });
    return output;
  }
  output[prefix] = String(value);
  return output;
}

/** Trova l'array di record dentro forme comuni di risposta API. */
function extractArray(parsed: any): any[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    for (const key of ['data', 'items', 'records', 'results', 'rows', 'leads', 'contacts', 'clienti']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    // Un solo oggetto è un record solo.
    return [parsed];
  }
  throw new ParseError('Il JSON non contiene un elenco di record.');
}

export function parseJson(text: string): ParsedSheet {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // JSON Lines: un oggetto per riga, esportazione comune.
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    try {
      parsed = lines.map(line => JSON.parse(line));
    } catch {
      throw new ParseError('Il file non è un JSON valido.');
    }
  }

  const records = extractArray(parsed).map(record =>
    typeof record === 'object' && record !== null ? flatten(record) : { valore: String(record) }
  );
  if (records.length === 0) throw new ParseError('Il JSON non contiene record.');

  // L'unione delle chiavi: i record JSON possono avere campi diversi fra loro.
  const columns: string[] = [];
  records.forEach(record => {
    Object.keys(record).forEach(key => { if (!columns.includes(key)) columns.push(key); });
  });

  return {
    name: 'JSON',
    rows: [columns, ...records.map(record => columns.map(column => record[column] ?? ''))],
  };
}

// ------------------------------------------------------------------ entry

function formatOf(fileName: string): SourceFormat {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  if (extension === 'csv') return 'csv';
  if (extension === 'tsv') return 'tsv';
  if (extension === 'json' || extension === 'jsonl' || extension === 'ndjson') return 'json';
  if (extension === 'xlsx' || extension === 'xlsm') return 'xlsx';
  if (extension === 'xls') {
    throw new ParseError(
      'Il formato .xls (Excel 97-2003) non è leggibile: apri il file e salvalo come .xlsx o .csv.'
    );
  }
  return 'txt';
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const format = formatOf(file.name);
  const notes: string[] = [];

  if (format === 'xlsx') {
    let sheets;
    try {
      sheets = await readXlsx(await file.arrayBuffer());
    } catch (error) {
      throw new ParseError(
        error instanceof XlsxError ? error.message : 'Il file .xlsx non è leggibile.'
      );
    }
    const populated = sheets.filter(s => s.rows.length > 0);
    if (populated.length === 0) throw new ParseError('Il file non contiene righe.');
    if (populated.length < sheets.length) notes.push('Alcuni fogli sono vuoti e non compaiono.');
    return { fileName: file.name, format, sheets: populated, notes };
  }

  const text = await file.text();
  if (!text.trim()) throw new ParseError('Il file è vuoto.');

  if (format === 'json') {
    return { fileName: file.name, format, sheets: [parseJson(text)], notes };
  }

  const delimiter = format === 'tsv' ? '\t' : detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) throw new ParseError('Il file non contiene righe.');

  if (format === 'txt' && rows.every(r => r.length === 1)) {
    notes.push('Nessun separatore riconosciuto: il file è letto come una colonna sola.');
  }

  return {
    fileName: file.name,
    format,
    sheets: [{ name: file.name, rows }],
    delimiter,
    notes,
  };
}

// ----------------------------------------------------------- intestazione

/**
 * Indovina quale riga è l'intestazione: le esportazioni gestionali mettono
 * spesso titolo e data sopra la tabella vera.
 */
export function guessHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 10);
  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] || []).map(c => c.trim());
    const filled = cells.filter(Boolean).length;
    if (filled < 2) continue;

    // Un'intestazione ha celle piene, testuali, tutte diverse.
    const textual = cells.filter(c => c && Number.isNaN(Number(c))).length;
    const unique = new Set(cells.filter(Boolean)).size;
    const score = filled + textual + unique - i;   // le righe più in alto vincono a parità

    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

export interface TableRow {
  /** Numero di riga nel foglio, 1-based: è quello che l'utente legge in Excel. */
  line: number;
  /** colonna → valore, già ripulito degli spazi. */
  values: Record<string, string>;
}

export interface Table {
  columns: string[];
  rows: TableRow[];
  /** Righe scartate perché completamente vuote. */
  skippedEmpty: number;
}

/** Trasforma le righe grezze in tabella, data la riga di intestazione. */
export function toTable(sheet: ParsedSheet, headerRowIndex: number): Table {
  const header = sheet.rows[headerRowIndex] || [];
  const width = Math.max(header.length, ...sheet.rows.map(r => r.length), 0);

  const columns: string[] = [];
  for (let i = 0; i < width; i++) {
    const name = (header[i] || '').trim();
    let candidate = name || `Colonna ${i + 1}`;
    // Due colonne con lo stesso titolo capitano: si distinguono, non si perdono.
    let suffix = 2;
    while (columns.includes(candidate)) candidate = `${name || `Colonna ${i + 1}`} (${suffix++})`;
    columns.push(candidate);
  }

  let skippedEmpty = 0;
  const rows: TableRow[] = [];

  sheet.rows.slice(headerRowIndex + 1).forEach((raw, offset) => {
    if (!raw.some(cell => (cell || '').trim() !== '')) { skippedEmpty++; return; }
    const values: Record<string, string> = {};
    columns.forEach((column, i) => { values[column] = (raw[i] || '').trim(); });
    rows.push({ line: headerRowIndex + offset + 2, values });
  });

  return { columns, rows, skippedEmpty };
}
