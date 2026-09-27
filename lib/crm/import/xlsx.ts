/**
 * Lettore .xlsx minimo, senza dipendenze.
 *
 * Perché a mano: aggiungere SheetJS al package.json del prodotto significa
 * chiedere al team un `npm install` e una libreria in più da mantenere, mentre
 * la consegna è «cartelle da copiare più due righe di patch». Un .xlsx è uno
 * zip di XML: il browser sa già scompattare (DecompressionStream) e leggere
 * XML (DOMParser), quindi qui serve solo cucire le due cose.
 *
 * Copre quello che serve a un'anagrafica: fogli, stringhe condivise, numeri,
 * date, booleani. NON copre formule (legge il valore memorizzato, non lo
 * ricalcola), file protetti da password, e il vecchio formato .xls binario.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

export class XlsxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XlsxError';
  }
}

interface ZipEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

// ------------------------------------------------------------------- zip

/** Scorre la directory centrale dello zip. Non legge i dati, solo dove stanno. */
function readCentralDirectory(view: DataView): ZipEntry[] {
  // L'end-of-central-directory sta in fondo, dopo un commento di lunghezza
  // variabile: si cerca la firma all'indietro.
  let eocd = -1;
  const from = Math.max(0, view.byteLength - 66_000);
  for (let i = view.byteLength - 22; i >= from; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) { eocd = i; break; }
  }
  if (eocd < 0) throw new XlsxError('Il file non è un .xlsx valido (zip non riconosciuto).');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  if (offset === 0xFFFFFFFF) {
    throw new XlsxError('Il file usa il formato zip64: salvalo di nuovo come .xlsx o esportalo in CSV.');
  }

  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) break;

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    entries.push({
      name: decoder.decode(new Uint8Array(view.buffer, view.byteOffset + offset + 46, nameLength)),
      compressionMethod: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new XlsxError(
      'Questo browser non sa scompattare i file .xlsx. Esporta il foglio in CSV e ricarica.'
    );
  }
  const stream = new Blob([data as unknown as BlobPart]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Estrae un singolo file dallo zip, come testo. */
async function readEntry(buffer: ArrayBuffer, view: DataView, entry: ZipEntry): Promise<string> {
  // L'header locale ripete nome ed extra con lunghezze proprie: i dati
  // cominciano dopo di quelli, non dopo quelli della directory centrale.
  const localNameLength = view.getUint16(entry.localHeaderOffset + 26, true);
  const localExtraLength = view.getUint16(entry.localHeaderOffset + 28, true);
  const start = entry.localHeaderOffset + 30 + localNameLength + localExtraLength;

  const raw = new Uint8Array(buffer, start, entry.compressedSize);

  if (entry.compressionMethod === 0) return new TextDecoder().decode(raw);
  if (entry.compressionMethod === 8) return new TextDecoder().decode(await inflate(raw));
  throw new XlsxError(`Compressione zip non supportata (metodo ${entry.compressionMethod}).`);
}

// ------------------------------------------------------------------- xlsx

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

/** Colonna "BC12" → indice 0-based 54. */
function columnIndex(reference: string): number {
  const letters = reference.replace(/\d+/g, '');
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Seriale Excel → data ISO.
 * L'origine è il 30/12/1899 e non il 1° gennaio 1900 per compensare il famoso
 * 1900 bisestile che Excel continua a considerare valido.
 */
function serialToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return String(serial);
  const iso = date.toISOString();
  // Con parte oraria a zero si restituisce la sola data: è il caso normale
  // di una colonna "scadenza" o "data creazione".
  return serial % 1 === 0 ? iso.slice(0, 10) : iso;
}

/** Formati numerici predefiniti di Excel che rappresentano date oppure orari. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Per ogni stile di cella dice se il numero va letto come data. */
function readDateStyles(stylesXml: string | null): boolean[] {
  if (!stylesXml) return [];
  const doc = parseXml(stylesXml);

  const customDateFormats = new Set<number>();
  Array.from(doc.getElementsByTagName('numFmt')).forEach(node => {
    const id = Number(node.getAttribute('numFmtId'));
    const code = (node.getAttribute('formatCode') || '').replace(/\[[^\]]*\]|"[^"]*"/g, '');
    if (/[ymdhs]/i.test(code)) customDateFormats.add(id);
  });

  const cellXfs = doc.getElementsByTagName('cellXfs')[0];
  if (!cellXfs) return [];

  return Array.from(cellXfs.getElementsByTagName('xf')).map(xf => {
    const id = Number(xf.getAttribute('numFmtId') || 0);
    return BUILTIN_DATE_FORMATS.has(id) || customDateFormats.has(id);
  });
}

function readSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return Array.from(parseXml(xml).getElementsByTagName('si')).map(si =>
    // Il testo di una stringa può essere spezzato in più <t> da formattazioni
    // parziali: vanno riuniti.
    Array.from(si.getElementsByTagName('t')).map(t => t.textContent || '').join('')
  );
}

export interface XlsxSheet {
  name: string;
  rows: string[][];
}

function readSheet(xml: string, sharedStrings: string[], dateStyles: boolean[]): string[][] {
  const doc = parseXml(xml);
  const rows: string[][] = [];

  Array.from(doc.getElementsByTagName('row')).forEach(rowNode => {
    const cells: string[] = [];
    // Excel dichiara il numero di riga: le righe vuote non compaiono nell'XML,
    // e senza questo la numerazione che l'utente vede si sposterebbe.
    const declared = Number(rowNode.getAttribute('r') || 0);

    Array.from(rowNode.getElementsByTagName('c')).forEach(cell => {
      const reference = cell.getAttribute('r') || '';
      const type = cell.getAttribute('t') || 'n';
      const styleIndex = Number(cell.getAttribute('s') || -1);
      const target = reference ? columnIndex(reference) : cells.length;

      let value = '';
      if (type === 'inlineStr') {
        value = Array.from(cell.getElementsByTagName('t')).map(t => t.textContent || '').join('');
      } else {
        const raw = cell.getElementsByTagName('v')[0]?.textContent || '';
        if (type === 's') {
          value = sharedStrings[Number(raw)] ?? '';
        } else if (type === 'b') {
          value = raw === '1' ? 'true' : 'false';
        } else if (type === 'e') {
          value = '';                       // errore di formula: cella vuota
        } else if (raw && dateStyles[styleIndex] && !Number.isNaN(Number(raw))) {
          value = serialToISO(Number(raw));
        } else {
          value = raw;
        }
      }

      // Le celle vuote non compaiono nell'XML: si riempie il buco.
      while (cells.length < target) cells.push('');
      cells[target] = value;
    });

    if (declared > 0) {
      while (rows.length < declared - 1) rows.push([]);
      rows[declared - 1] = cells;
    } else {
      rows.push(cells);
    }
  });

  return rows;
}

/** Legge tutti i fogli di un .xlsx. */
export async function readXlsx(buffer: ArrayBuffer): Promise<XlsxSheet[]> {
  const view = new DataView(buffer);
  const entries = readCentralDirectory(view);
  const byName = new Map(entries.map(e => [e.name, e]));

  const read = async (name: string) => {
    const entry = byName.get(name);
    return entry ? readEntry(buffer, view, entry) : null;
  };

  const workbookXml = await read('xl/workbook.xml');
  if (!workbookXml) throw new XlsxError('Il file non contiene un foglio di lavoro leggibile.');

  // I fogli si raggiungono passando per le relazioni: l'ordine dei file
  // sheetN.xml non corrisponde necessariamente all'ordine delle schede.
  const relsXml = await read('xl/_rels/workbook.xml.rels');
  const relTargets = new Map<string, string>();
  if (relsXml) {
    Array.from(parseXml(relsXml).getElementsByTagName('Relationship')).forEach(rel => {
      const target = rel.getAttribute('Target') || '';
      relTargets.set(
        rel.getAttribute('Id') || '',
        target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
      );
    });
  }

  const sharedStrings = readSharedStrings(await read('xl/sharedStrings.xml'));
  const dateStyles = readDateStyles(await read('xl/styles.xml'));

  const sheets: XlsxSheet[] = [];
  const sheetNodes = Array.from(parseXml(workbookXml).getElementsByTagName('sheet'));

  for (let i = 0; i < sheetNodes.length; i++) {
    const node = sheetNodes[i];
    const relId = node.getAttribute('r:id') || node.getAttribute('id') || '';
    const path = relTargets.get(relId) || `xl/worksheets/sheet${i + 1}.xml`;
    const xml = await read(path);
    if (!xml) continue;
    sheets.push({
      name: node.getAttribute('name') || `Foglio ${i + 1}`,
      rows: readSheet(xml, sharedStrings, dateStyles),
    });
  }

  if (sheets.length === 0) throw new XlsxError('Nessun foglio leggibile nel file.');
  return sheets;
}
