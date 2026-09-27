/**
 * Mappatura colonne del file → campi del CRM, e conversione dei valori.
 *
 * Funzioni pure: niente Firebase, niente React.
 */

import { LEAD_STATES, LEAD_STATE_LABELS, LeadState } from '@/components/crm/constants';
import { normalizeEmail, normalizePhone, extractDomain } from '../helpers';

export type ImportEntity = 'lead' | 'account' | 'contact';

export const ENTITY_LABELS: Record<ImportEntity, string> = {
  lead: 'Lead',
  account: 'Aziende',
  contact: 'Contatti',
};

export type FieldType = 'text' | 'longtext' | 'email' | 'phone' | 'number' | 'date' | 'state' | 'boolean' | 'url' | 'list';

export interface TargetField {
  key: string;
  label: string;
  type: FieldType;
  /** Intestazioni che valgono per questo campo, già normalizzate. */
  aliases: string[];
  hint?: string;
}

/**
 * Campi importabili. Volutamente meno di quelli del modello: qui stanno solo
 * quelli che si trovano davvero in un'esportazione, il resto si compila dentro
 * al CRM.
 */
export const TARGET_FIELDS: Record<ImportEntity, TargetField[]> = {
  lead: [
    { key: 'fullName',       label: 'Nominativo',        type: 'text',     aliases: ['nominativo', 'nome', 'nome e cognome', 'nome completo', 'contatto', 'full name', 'name', 'referente', 'cliente'] },
    { key: 'companyName',    label: 'Azienda',           type: 'text',     aliases: ['azienda', 'societa', 'ragione sociale', 'company', 'company name', 'organizzazione', 'ditta', 'account'] },
    { key: 'email',          label: 'Email',             type: 'email',    aliases: ['email', 'e mail', 'mail', 'posta elettronica', 'indirizzo email', 'email address'] },
    { key: 'phone',          label: 'Telefono',          type: 'phone',    aliases: ['telefono', 'tel', 'cellulare', 'cell', 'mobile', 'phone', 'numero', 'recapito'] },
    { key: 'companyDomain',  label: 'Sito / dominio',    type: 'url',      aliases: ['sito', 'sito web', 'website', 'web', 'dominio', 'domain', 'url'] },
        { key: 'address',     label: 'Indirizzo',       type: 'text',     aliases: ['indirizzo', 'address', 'via', 'sede'] },
    { key: 'city',        label: 'Città',           type: 'text',     aliases: ['citta', 'comune', 'city', 'localita'] },
    { key: 'postalCode',  label: 'CAP',             type: 'text',     aliases: ['cap', 'codice postale', 'postal code', 'zip'] },
    { key: 'country',     label: 'Paese',           type: 'text',     aliases: ['paese', 'nazione', 'country', 'stato'] },
    { key: 'source',         label: 'Fonte',             type: 'text',     aliases: ['fonte', 'source', 'provenienza', 'canale', 'campagna', 'origine'] },
    { key: 'state',          label: 'Stato',             type: 'state',    aliases: ['stato', 'state', 'status', 'fase', 'stage'], hint: 'Se assente o non riconosciuto il lead entra come Nuovo' },
    { key: 'estimatedValue', label: 'Valore stimato',    type: 'number',   aliases: ['valore', 'valore stimato', 'importo', 'budget', 'value', 'amount', 'deal value', 'potenziale'] },
    { key: 'notes',          label: 'Note',              type: 'longtext', aliases: ['note', 'notes', 'commenti', 'descrizione', 'osservazioni', 'annotazioni'] },
    { key: 'nextFollowupAt', label: 'Prossima azione',   type: 'date',     aliases: ['prossima azione', 'prossimo contatto', 'follow up', 'followup', 'scadenza', 'richiamare il', 'ricontattare', 'next action', 'due date', 'data richiamo', 'data prossimo contatto'] },
    { key: 'lastContactAt',  label: 'Ultimo contatto',   type: 'date',     aliases: ['ultimo contatto', 'last contact', 'contattato il', 'data contatto'] },
    { key: 'consentEmail',   label: 'Consenso email',    type: 'boolean',  aliases: ['consenso', 'consenso email', 'privacy', 'consenso marketing', 'opt in', 'optin', 'newsletter', 'consent'], hint: 'Serve una prova del consenso: senza colonna resta negato' },
    { key: 'externalId',     label: 'ID di origine',     type: 'text',     aliases: ['id', 'codice', 'id esterno', 'external id', 'codice cliente', 'riferimento'], hint: 'Conservato per ritrovare il record nel sistema di partenza' },
  ],
  account: [
    { key: 'legalName',   label: 'Ragione sociale', type: 'text',     aliases: ['ragione sociale', 'azienda', 'societa', 'denominazione', 'company', 'legal name', 'nome azienda', 'ditta'] },
    { key: 'displayName', label: 'Nome breve',      type: 'text',     aliases: ['nome breve', 'nome', 'display name', 'insegna', 'alias'] },
    { key: 'website',     label: 'Sito web',        type: 'url',      aliases: ['sito', 'sito web', 'website', 'web', 'url', 'dominio', 'domain'] },
    { key: 'vatNumber',   label: 'Partita IVA',     type: 'text',     aliases: ['partita iva', 'p iva', 'piva', 'vat', 'vat number', 'iva'] },
    { key: 'taxCode',     label: 'Codice fiscale',  type: 'text',     aliases: ['codice fiscale', 'cf', 'tax code', 'cod fiscale'] },
    { key: 'industry',    label: 'Settore',         type: 'text',     aliases: ['settore', 'industry', 'categoria', 'ateco', 'attivita', 'mercato'] },
    { key: 'sizeRange',   label: 'Dipendenti',      type: 'text',     aliases: ['dipendenti', 'numero dipendenti', 'size', 'employees', 'dimensione', 'addetti'] },
    { key: 'address',     label: 'Indirizzo',       type: 'text',     aliases: ['indirizzo', 'address', 'via', 'sede', 'sede legale'] },
    { key: 'city',        label: 'Città',           type: 'text',     aliases: ['citta', 'comune', 'city', 'localita'] },
    { key: 'postalCode',  label: 'CAP',             type: 'text',     aliases: ['cap', 'codice postale', 'postal code', 'zip', 'zip code'] },
    { key: 'region',      label: 'Provincia',       type: 'text',     aliases: ['provincia', 'regione', 'region', 'prov', 'stato regione'] },
    { key: 'country',     label: 'Paese',           type: 'text',     aliases: ['paese', 'nazione', 'country', 'stato'] },
    { key: 'linkedinUrl', label: 'LinkedIn',        type: 'url',      aliases: ['linkedin', 'linkedin url', 'profilo linkedin'] },
    { key: 'notes',       label: 'Note',            type: 'longtext', aliases: ['note', 'notes', 'descrizione', 'commenti'] },
    { key: 'externalId',  label: 'ID di origine',   type: 'text',     aliases: ['id', 'codice', 'id esterno', 'external id', 'codice cliente'] },
  ],
  contact: [
    { key: 'firstName',    label: 'Nome',            type: 'text',     aliases: ['nome', 'first name', 'nome di battesimo'] },
    { key: 'lastName',     label: 'Cognome',         type: 'text',     aliases: ['cognome', 'last name', 'surname', 'family name'] },
    { key: 'fullName',     label: 'Nominativo',      type: 'text',     aliases: ['nominativo', 'nome e cognome', 'nome completo', 'full name', 'contatto', 'referente'], hint: 'Se compilato viene diviso in nome e cognome' },
    { key: 'email',        label: 'Email',           type: 'email',    aliases: ['email', 'e mail', 'mail', 'posta elettronica', 'email address'] },
    { key: 'phone',        label: 'Telefono',        type: 'phone',    aliases: ['telefono', 'tel', 'cellulare', 'cell', 'mobile', 'phone', 'numero'] },
        { key: 'address',     label: 'Indirizzo',       type: 'text',     aliases: ['indirizzo', 'address', 'via', 'sede'] },
    { key: 'city',        label: 'Città',           type: 'text',     aliases: ['citta', 'comune', 'city', 'localita'] },
    { key: 'postalCode',  label: 'CAP',             type: 'text',     aliases: ['cap', 'codice postale', 'postal code', 'zip'] },
    { key: 'country',     label: 'Paese',           type: 'text',     aliases: ['paese', 'nazione', 'country', 'stato'] },
    { key: 'role',         label: 'Ruolo',           type: 'text',     aliases: ['ruolo', 'role', 'qualifica', 'posizione', 'title', 'job title', 'mansione'] },
    { key: 'companyName',  label: 'Azienda',         type: 'text',     aliases: ['azienda', 'societa', 'ragione sociale', 'company', 'organizzazione'], hint: 'Collega il contatto all’azienda con questo nome, se esiste' },
    { key: 'linkedinUrl',  label: 'LinkedIn',        type: 'url',      aliases: ['linkedin', 'linkedin url', 'profilo linkedin'] },
    { key: 'notes',        label: 'Note',            type: 'longtext', aliases: ['note', 'notes', 'descrizione', 'commenti'] },
    { key: 'consentEmail', label: 'Consenso email',  type: 'boolean',  aliases: ['consenso', 'consenso email', 'privacy', 'opt in', 'optin', 'newsletter', 'consent'] },
    { key: 'externalId',   label: 'ID di origine',   type: 'text',     aliases: ['id', 'codice', 'id esterno', 'external id'] },
  ],
};

/** Campi che da soli bastano a identificare il record: almeno uno è obbligatorio. */
export const IDENTIFYING_FIELDS: Record<ImportEntity, string[]> = {
  lead: ['fullName', 'companyName', 'email'],
  account: ['legalName', 'displayName'],
  contact: ['fullName', 'lastName', 'email'],
};

// -------------------------------------------------------- mappatura auto

/** Toglie accenti, punteggiatura e maiuscole: "P.IVA " e "p iva" combaciano. */
export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** colonna del file → chiave del campo CRM ('' = non importare). */
export type ColumnMapping = Record<string, string>;

/**
 * Propone una mappatura leggendo i titoli delle colonne. Corrispondenza esatta
 * prima, poi per contenimento: "Email aziendale" trova `email`.
 * Resta una proposta: la schermata di mappatura la mostra e la fa correggere.
 */
export function autoMap(columns: string[], entity: ImportEntity): ColumnMapping {
  const fields = TARGET_FIELDS[entity];
  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  const assign = (column: string, key: string) => {
    if (used.has(key)) return false;
    mapping[column] = key;
    used.add(key);
    return true;
  };

  const normalized = columns.map(column => ({ column, header: normalizeHeader(column) }));

  normalized.forEach(({ column, header }) => {
    if (!header) return;
    const exact = fields.find(field => field.aliases.includes(header) || normalizeHeader(field.label) === header);
    if (exact) assign(column, exact.key);
  });

  normalized.forEach(({ column, header }) => {
    if (mapping[column] || !header) return;
    const partial = fields.find(field =>
      field.aliases.some(alias => header.includes(alias) || alias.includes(header))
    );
    if (partial) assign(column, partial.key);
  });

  columns.forEach(column => { if (!mapping[column]) mapping[column] = ''; });
  return mapping;
}

// --------------------------------------------------------- conversione

export interface CoercedValue {
  value: any;
  /** Il valore c'era ma non è utilizzabile: la riga va corretta o esclusa. */
  error?: string;
  /** Il valore è stato interpretato: va detto, non blocca. */
  warning?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const TRUE_WORDS = new Set(['si', 'sì', 'yes', 'y', 'true', 'vero', 'x', '1', 'ok', 'accettato', 'granted']);
const FALSE_WORDS = new Set(['no', 'n', 'false', 'falso', '0', '', 'negato', 'rifiutato']);

/** "1.234,50 €" e "1,234.50" danno lo stesso numero. */
export interface ParsedNumber {
  value: number | null;
  /** Il separatore era interpretabile in due modi: "45.000" vale 45 o 45000? */
  ambiguous: boolean;
}

/** Variante che dice anche se l'interpretazione era ambigua. */
export function parseNumberDetailed(raw: string): ParsedNumber {
  const cleaned = raw.replace(/[^\d,.\-]/g, '').trim();
  if (!cleaned) return { value: null, ambiguous: false };

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  let ambiguous = false;

  if (lastComma > -1 && lastDot > -1) {
    // Con entrambi i segni non c'è dubbio: l'ultimo è il decimale, l'altro
    // divide le migliaia.
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (lastComma > -1) {
    // Un segno solo che stacca esattamente tre cifre finali è quasi sempre il
    // separatore delle migliaia: "45.000" sono quarantacinquemila, non 45.
    // Resta ambiguo, e va detto invece di correggere in silenzio.
    if (/,\d{3}$/.test(cleaned) && /\d/.test(cleaned.slice(0, lastComma))) {
      normalized = cleaned.replace(/,/g, '');
      ambiguous = true;
    } else {
      normalized = cleaned.replace(',', '.');
    }
  } else if (lastDot > -1) {
    if (/\.\d{3}$/.test(cleaned) && /\d/.test(cleaned.slice(0, lastDot))) {
      normalized = cleaned.replace(/\./g, '');
      ambiguous = true;
    }
  }

  const value = Number(normalized);
  return { value: Number.isFinite(value) ? value : null, ambiguous };
}

/** "1.234,50 €" e "1,234.50" danno lo stesso numero. */
export function parseNumber(raw: string): number | null {
  return parseNumberDetailed(raw).value;
}

/**
 * Costruisce la data solo se esiste davvero: il 31 febbraio è un errore di
 * battitura, non una data da correggere in silenzio al 3 marzo.
 */
function buildDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Riconosce ISO, gg/mm/aaaa, gg-mm-aaaa e gg.mm.aaaa. Restituisce ISO. */
export function parseDate(raw: string): { iso: string | null; ambiguous: boolean } {
  const value = raw.trim();
  if (!value) return { iso: null, ambiguous: false };

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const built = buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return { iso: built, ambiguous: false };
  }

  const parts = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (parts) {
    const day = Number(parts[1]);
    const month = Number(parts[2]);
    const year = Number(parts[3].length === 2 ? `20${parts[3]}` : parts[3]);
    const built = buildDate(year, month, day);
    if (!built) return { iso: null, ambiguous: false };
    return {
      iso: built,
      // Con giorno e mese entrambi ≤ 12 non si può sapere se è gg/mm o mm/gg:
      // si assume il formato italiano e lo si dichiara.
      ambiguous: day <= 12 && month <= 12 && day !== month,
    };
  }

  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return { iso: new Date(parsed).toISOString().slice(0, 10), ambiguous: true };

  return { iso: null, ambiguous: false };
}

/** Riconosce lo stato dal codice o dall'etichetta italiana. */
export function parseLeadState(raw: string): LeadState | null {
  const value = normalizeHeader(raw);
  if (!value) return null;

  const byCode = LEAD_STATES.find(state => normalizeHeader(state) === value);
  if (byCode) return byCode;

  const byLabel = LEAD_STATES.find(state => normalizeHeader(LEAD_STATE_LABELS[state]) === value);
  if (byLabel) return byLabel;

  // Sinonimi che ricorrono nelle esportazioni.
  const synonyms: Record<string, LeadState> = {
    'nuovo lead': 'NEW', 'aperto': 'NEW', 'da lavorare': 'TO_CONTACT', 'da chiamare': 'TO_CONTACT',
    'in lavorazione': 'CONTACTED', 'in corso': 'CONTACTED', 'richiamare': 'FOLLOWUP',
    'preventivo inviato': 'PROPOSAL_SENT', 'offerta inviata': 'PROPOSAL_SENT', 'preventivo': 'PROPOSAL_SENT',
    'trattativa': 'NEGOTIATION', 'in trattativa': 'NEGOTIATION',
    'vinto': 'CONVERTED', 'chiuso vinto': 'CONVERTED', 'cliente': 'CONVERTED', 'acquisito': 'CONVERTED',
    'chiuso perso': 'LOST', 'perduto': 'LOST', 'ko': 'LOST',
    'non interessa': 'NOT_INTERESTED', 'rifiutato': 'NOT_INTERESTED',
  };
  return synonyms[value] || null;
}

export function coerce(field: TargetField, raw: string): CoercedValue {
  const value = (raw || '').trim();
  if (!value) return { value: field.type === 'boolean' ? false : field.type === 'number' ? 0 : '' };

  switch (field.type) {
    case 'email': {
      const email = value.split(/[;,]/)[0].trim();   // più email in una cella: si prende la prima
      if (!EMAIL_PATTERN.test(email)) return { value: '', error: `Email non valida: "${value}"` };
      return {
        value: email,
        warning: email !== value ? 'La cella conteneva più email: importata la prima' : undefined,
      };
    }
    case 'phone': {
      const phone = normalizePhone(value);
      if (phone.replace(/\D/g, '').length < 6) return { value: '', error: `Telefono non valido: "${value}"` };
      return { value };
    }
    case 'number': {
      const { value: parsed, ambiguous } = parseNumberDetailed(value);
      if (parsed === null) return { value: 0, error: `Numero non valido: "${value}"` };
      return {
        value: parsed,
        warning: ambiguous
          ? `"${value}" letto come ${new Intl.NumberFormat('it-IT').format(parsed)}`
          : undefined,
      };
    }
    case 'date': {
      const { iso, ambiguous } = parseDate(value);
      if (!iso) return { value: '', error: `Data non riconosciuta: "${value}"` };
      return { value: iso, warning: ambiguous ? `"${value}" letto come giorno/mese` : undefined };
    }
    case 'state': {
      const state = parseLeadState(value);
      if (!state) return { value: 'NEW', warning: `Stato "${value}" non riconosciuto: importato come Nuovo` };
      return { value: state };
    }
    case 'boolean': {
      const word = value.toLowerCase();
      if (TRUE_WORDS.has(word)) return { value: true };
      if (FALSE_WORDS.has(word)) return { value: false };
      return { value: false, warning: `"${value}" non è un sì/no: consenso registrato come negato` };
    }
    case 'url': {
      const domain = extractDomain(value);
      return { value: domain || value };
    }
    default:
      return { value };
  }
}

/** "Mario Rossi" → nome e cognome; l'ultima parola è il cognome. */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export { normalizeEmail, normalizePhone, extractDomain };
