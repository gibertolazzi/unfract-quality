/**
 * Le schede azienda.
 *
 * Una scheda per azienda, riconosciuta dalla `lookupKey` (partita IVA, o il
 * dominio quando la partita IVA non c'è). Ricercare due volte la stessa
 * azienda non crea due schede: aggiorna quella che c'è, e questo è anche il
 * motivo per cui le ricerche costano meno di quanto si teme.
 */

import {
  CrmCompanyProfile, CompanyIdentity, CompanyDeclared, CompanyEstimated, CompanyOverrides,
} from '@/types/prospect';
import { FreshnessArea } from '@/components/crm/ricerca/constants';
import {
  CrmContextRef, createRecord, updateRecord, getRecords, subscribeToRecords,
  archiveRecord, mapBase, byUpdatedAtDesc,
} from '../base';
import { writeAudit } from '../audit';
import { PROSPECT_COLLECTIONS, nowIso, missing, isStale, lookupKeyFor } from './base';

const COLLECTION_NAME = PROSPECT_COLLECTIONS.profiles;

/** Identità vuota: tutti i campi dichiarano di non essere stati raccolti. */
function emptyIdentity(): CompanyIdentity {
  const nota = 'Non ancora raccolto.';
  return {
    legalName: missing<string>(nota, 'certain'),
    vatNumber: missing<string>(nota, 'certain'),
    taxCode: missing<string>(nota, 'certain'),
    address: missing<string>(nota, 'certain'),
    city: missing<string>(nota, 'certain'),
    province: missing<string>(nota, 'certain'),
    country: missing<string>(nota, 'certain'),
    vatValid: missing<boolean>(nota, 'certain'),
  };
}

function emptyDeclared(): CompanyDeclared {
  const nota = 'Non ancora raccolto dal sito.';
  return {
    website: missing<string>(nota),
    description: missing<string>(nota),
    aboutText: missing<string>(nota),
    solutions: missing<string[]>(nota),
    targetSectors: missing<string[]>(nota),
    declaredClients: missing<string[]>(nota),
    declaredPartners: missing<string[]>(nota),
    publicContacts: missing<any[]>(nota),
    socialLinks: missing<any[]>(nota),
    techStack: missing<any[]>(nota),
  };
}

function emptyEstimated(): CompanyEstimated {
  const vuota = (nota: string) => ({
    value: null, evidence: 'estimated' as const, confidence: 'low' as const,
    signals: [] as string[], sourceId: '', at: '', note: nota,
  });
  return {
    sector: vuota('Nessun dato su cui stimare il settore.'),
    atecoCode: vuota('Serve una visura, oppure un settore stimato da cui partire.'),
    sizeRange: vuota('Nessun dato sulla dimensione.'),
    competitors: vuota('I competitor si stimano dopo aver stabilito il settore.'),
    idealCustomer: vuota('Serve sapere cosa vendono, prima di dire a chi.'),
  };
}

function emptyOverrides(): CompanyOverrides {
  return { sectorCode: missing<string>('Nessuna correzione a mano.') };
}

function mapProfile(id: string, data: any): CrmCompanyProfile {
  return {
    ...mapBase(id, data),
    lookupKey: data.lookupKey || '',
    displayName: data.displayName || '',
    identity: { ...emptyIdentity(), ...(data.identity || {}) },
    declared: { ...emptyDeclared(), ...(data.declared || {}) },
    estimated: { ...emptyEstimated(), ...(data.estimated || {}) },
    collectedAt: {
      identity: data.collectedAt?.identity || '',
      declared: data.collectedAt?.declared || '',
      estimated: data.collectedAt?.estimated || '',
    },
    gaps: Array.isArray(data.gaps) ? data.gaps : [],
    overrides: { ...emptyOverrides(), ...(data.overrides || {}) },
    linkedAccountId: data.linkedAccountId || '',
    linkedLeadId: data.linkedLeadId || '',
    lastSearchId: data.lastSearchId || '',
  };
}

export async function getProfiles(projectId: string): Promise<CrmCompanyProfile[]> {
  const tutte = await getRecords<CrmCompanyProfile>(COLLECTION_NAME, projectId, mapProfile);
  return tutte.sort(byUpdatedAtDesc);
}

export function subscribeToProfiles(projectId: string, callback: (p: CrmCompanyProfile[]) => void) {
  return subscribeToRecords<CrmCompanyProfile>(COLLECTION_NAME, projectId, mapProfile,
    schede => callback(schede.sort(byUpdatedAtDesc)));
}

/**
 * La scheda già in archivio per questa azienda, se c'è.
 *
 * Il confronto è lato client come ovunque nel CRM: evita un indice composito, e
 * a questi volumi — le aziende cercate da un progetto — non cambia niente.
 */
export async function findProfileByKey(projectId: string, lookupKey: string): Promise<CrmCompanyProfile | null> {
  if (!lookupKey) return null;
  const tutte = await getRecords<CrmCompanyProfile>(COLLECTION_NAME, projectId, mapProfile, { includeArchived: true });
  return tutte.find(p => p.lookupKey === lookupKey) || null;
}

export interface ProfileSeed {
  vatNumber?: string;
  domain?: string;
  displayName: string;
  searchId?: string;
}

/**
 * Crea una scheda vuota ma **onesta**: ogni campo dice di non essere stato
 * ancora raccolto, invece di essere una stringa vuota che sembra un dato
 * mancante nell'azienda.
 */
export async function createProfile(ctx: CrmContextRef, seed: ProfileSeed): Promise<string | null> {
  const lookupKey = lookupKeyFor(seed.vatNumber || '', seed.domain || '');
  if (!lookupKey) {
    console.error('Impossibile creare la scheda: servono una partita IVA o un dominio');
    return null;
  }

  const id = await createRecord(COLLECTION_NAME, ctx, {
    lookupKey,
    displayName: seed.displayName || '',
    identity: emptyIdentity(),
    declared: emptyDeclared(),
    estimated: emptyEstimated(),
    collectedAt: { identity: '', declared: '', estimated: '' },
    gaps: [],
    overrides: emptyOverrides(),
    linkedAccountId: '',
    linkedLeadId: '',
    lastSearchId: seed.searchId || '',
  }, 'integration');

  if (id) await writeAudit(ctx, 'prospect.profile_created', 'company_profile', id, null, { lookupKey });
  return id;
}

/**
 * Sostituisce un'area della scheda e ne data la raccolta.
 *
 * Si scrive un'area per volta perché le tre invecchiano a ritmi diversi: una
 * ragione sociale resta quella per anni, la pagina «clienti» cambia ogni
 * trimestre. Scrivere tutto insieme farebbe sembrare fresco anche ciò che non
 * è stato riletto.
 */
export async function updateProfileArea(
  ctx: CrmContextRef,
  id: string,
  area: FreshnessArea,
  data: Partial<CompanyIdentity> | Partial<CompanyDeclared> | Partial<CompanyEstimated>,
  gaps: string[] = []
): Promise<void> {
  const chiave = area === 'identity' ? 'identity' : area === 'declared' ? 'declared' : 'estimated';
  await updateRecord(COLLECTION_NAME, id, {
    [chiave]: data,
    [`collectedAt.${area}`]: nowIso(),
    gaps,
  }, ctx.uid);
  await writeAudit(ctx, 'prospect.profile_updated', 'company_profile', id, null, { area, gaps });
}

/**
 * Promuove la chiave di deduplicazione da dominio a partita IVA.
 *
 * Succede quando una scheda nata da un sito arriva alla sua partita IVA: da
 * quel momento la chiave giusta è quella, perché è l'unica che un registro
 * ufficiale conferma. Lasciare la vecchia significherebbe creare una seconda
 * scheda alla prima ricerca fatta per partita IVA.
 */
export async function promoteLookupKey(ctx: CrmContextRef, id: string, lookupKey: string): Promise<void> {
  if (!lookupKey || !lookupKey.startsWith('vat:')) return;
  await updateRecord(COLLECTION_NAME, id, { lookupKey }, ctx.uid);
  await writeAudit(ctx, 'prospect.profile_key_promoted', 'company_profile', id, null, { lookupKey });
}

/** Collega la scheda a un record del CRM: da qui in poi le due cose si parlano. */
export async function linkProfile(
  ctx: CrmContextRef,
  id: string,
  link: { accountId?: string; leadId?: string }
): Promise<void> {
  const payload: Record<string, any> = {};
  if (link.accountId !== undefined) payload.linkedAccountId = link.accountId;
  if (link.leadId !== undefined) payload.linkedLeadId = link.leadId;
  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'prospect.profile_linked', 'company_profile', id, null, payload);
}

export async function archiveProfile(ctx: CrmContextRef, id: string): Promise<void> {
  await archiveRecord(COLLECTION_NAME, id, ctx.uid);
  await writeAudit(ctx, 'prospect.profile_archived', 'company_profile', id, null, null);
}

/**
 * Corregge a mano il settore, o annulla la correzione passando codice vuoto.
 *
 * Non scrive dentro `estimated`: una correzione non è una stima, e mescolarle
 * farebbe sparire la distinzione che tiene in piedi tutta la sezione. Vive
 * accanto, e vince quando c'è — le stime che dipendono dal settore vengono
 * ricalcolate a partire da questa.
 */
export async function setSectorOverride(
  ctx: CrmContextRef,
  id: string,
  sectorCode: string,
  why: string
): Promise<void> {
  const codice = String(sectorCode || '').trim();

  const campo = codice
    ? {
        value: codice,
        // È un dato **dichiarato da una persona**, non dedotto: lo stesso
        // livello di ciò che un'azienda scrive di sé.
        evidence: 'declared' as const,
        sourceId: '',
        at: nowIso(),
        note: why ? `Corretto a mano: ${why}` : 'Corretto a mano.',
      }
    : missing<string>('Nessuna correzione a mano.');

  await updateRecord(COLLECTION_NAME, id, { 'overrides.sectorCode': campo }, ctx.uid);
  await writeAudit(ctx, codice ? 'prospect.sector_corrected' : 'prospect.sector_correction_cleared',
    'company_profile', id, null, { sectorCode: codice, why });
}

/** Le aree da rinfrescare. Lista vuota = la scheda è ancora buona. */
export function staleAreas(profile: CrmCompanyProfile, now: Date = new Date()): FreshnessArea[] {
  const aree: FreshnessArea[] = ['identity', 'declared', 'estimated'];
  return aree.filter(area => isStale(profile.collectedAt[area], area, now));
}
