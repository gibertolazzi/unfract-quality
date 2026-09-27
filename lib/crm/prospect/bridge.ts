/**
 * Il ponte fra la scheda azienda e il CRM.
 *
 * Da una scheda nascono un'azienda, un lead e — solo se c'è davvero una
 * persona — un contatto. Il principio è **nessun automatismo a sorpresa**: si
 * cercano i duplicati, si propone, e chi guarda decide se creare o collegare.
 *
 * Tre cose che questo file fa in un modo preciso, e il perché:
 *
 * 1. **Passa dalle funzioni del CRM** (`createAccount`, `createLead`,
 *    `createContact`) invece di scrivere i documenti a mano. Quelle funzioni
 *    normalizzano email e telefoni, cercano i duplicati e scrivono l'audit:
 *    scrivere i documenti direttamente sembra più efficiente e salta tutte e
 *    tre le cose, producendo record che il resto del CRM non riconosce come i
 *    propri. Si perde la scrittura atomica in blocco — ma senza SDK admin non
 *    c'è comunque modo di avere una transazione qui, e un record normalizzato
 *    a metà è un problema peggiore di un record in meno.
 * 2. **Marca la provenienza subito dopo la creazione.** `origin` vale
 *    `integration` — è uno dei quattro valori ammessi, e questa è
 *    un'integrazione fra due parti del prodotto — con `provider: 'prospect'` e
 *    `sourceRef` che punta alla scheda. Fra sei mesi si saprà ancora da dove è
 *    uscito quel nome.
 * 3. **I consensi restano a `false`.** Trovare un indirizzo pubblico non è
 *    ottenere un consenso, e il CRM ha già i campi per tenerli distinti.
 *
 * Sul contatto c'è una scelta che vale la pena spiegare: **non se ne crea uno
 * dai dati della scheda**. La lettura del sito raccoglie solo caselle
 * aziendali — `info@`, la PEC, il centralino — e sono recapiti dell'azienda,
 * non di una persona. Creare un «contatto» chiamato `info@` riempie la rubrica
 * di persone che non esistono, e fa scattare gli obblighi sui dati personali
 * per un dato che personale non è. Un contatto nasce solo se chi usa il ponte
 * scrive lui un nome.
 */

import { CrmContextRef, updateRecord } from '../base';
import { CrmCompanyProfile } from '@/types/prospect';
import { MatchCandidate, ChoiceMode } from '../conversion';
import { findDuplicates } from '../duplicates';
import { createAccount } from '../accounts';
import { createContact } from '../contacts';
import { createLead } from '../leads';
import { extractDomain } from '../helpers';
import { recordSource } from './sources';
import { linkProfile } from './profiles';
import { checkExcluded, describeExclusion } from './exclusions';
import { writeAudit } from '../audit';

// ------------------------------------------------------------- proposta

export interface BridgeAccountDraft {
  legalName: string;
  displayName: string;
  website: string;
  vatNumber: string;
  industry: string;
  city: string;
  address: string;
}

export interface BridgeContactDraft {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}

export interface BridgeLeadDraft {
  companyName: string;
  companyDomain: string;
  email: string;
  phone: string;
}

export interface BridgeProposal {
  accountMode: ChoiceMode;
  accountId: string;
  accountDraft: BridgeAccountDraft;
  accountCandidates: MatchCandidate[];

  contactMode: ChoiceMode;
  contactId: string;
  contactDraft: BridgeContactDraft;
  contactCandidates: MatchCandidate[];

  leadMode: ChoiceMode;
  leadId: string;
  leadDraft: BridgeLeadDraft;
  leadCandidates: MatchCandidate[];

  /** Cosa chi guarda deve sapere prima di premere. Si mostra, non si tace. */
  notes: string[];
}

const valore = (campo: any): string => (typeof campo?.value === 'string' ? campo.value : '');
const elenco = <T,>(campo: any): T[] => (Array.isArray(campo?.value) ? campo.value : []);

/**
 * Il dominio e la partita IVA della scheda, anche quando i campi non sono
 * stati riempiti: la `lookupKey` li porta comunque, ed è `vat:` oppure
 * `domain:` — i due prefissi che `lookupKeyFor` produce, non altri.
 */
export function chiaviDellaScheda(profile: CrmCompanyProfile): { vatNumber: string; domain: string } {
  const chiave = profile.lookupKey || '';
  return {
    vatNumber: valore(profile.identity?.vatNumber)
      || (chiave.startsWith('vat:') ? chiave.slice('vat:'.length) : ''),
    domain: extractDomain(valore(profile.declared?.website))
      || (chiave.startsWith('domain:') ? chiave.slice('domain:'.length) : ''),
  };
}

/**
 * Propone cosa creare e cosa collegare.
 *
 * `finder` si può sostituire: serve a provare questa funzione senza Firestore,
 * ed è l'unico modo di verificare la parte che conta — cosa si propone, dato
 * quello che si è trovato.
 */
export async function buildBridgeProposal(
  projectId: string,
  profile: CrmCompanyProfile,
  finder: typeof findDuplicates = findDuplicates
): Promise<BridgeProposal> {
  const { vatNumber, domain } = chiaviDellaScheda(profile);
  const contatti = elenco<any>(profile.declared?.publicContacts);

  // Recapiti **aziendali**: finiscono sull'azienda e sul lead, non su una
  // persona. La PEC si tiene da parte: è un canale formale, e metterla come
  // email di un lead commerciale la fa usare per quello che non è.
  const email = contatti.find(c => c?.kind === 'email')?.value || '';
  const phone = contatti.find(c => c?.kind === 'phone')?.value || '';

  const duplicati = await finder(projectId, { domain, email, phone });

  const comeCandidato = (d: any): MatchCandidate => ({
    id: d.id, label: d.label, matchedOn: d.matchedOn || [],
  });
  const perCollezione = (nome: string) =>
    duplicati.filter(d => d.collection === nome).map(comeCandidato);

  const aziende = perCollezione('crm_accounts');
  const contattiEsistenti = perCollezione('crm_contacts');
  const lead = perCollezione('crm_leads');

  const ragioneSociale = valore(profile.identity?.legalName) || profile.displayName || '';

  const notes: string[] = [];
  if (aziende.length) notes.push(`Un'azienda con gli stessi riferimenti è già nel CRM: ${aziende[0].label}.`);
  if (lead.length) notes.push(`C'è già un lead con gli stessi riferimenti: ${lead[0].label}.`);
  if (email || phone) {
    notes.push('I recapiti trovati sono aziendali: vanno sull’azienda e sul lead, non su una persona.');
  }
  notes.push('Nessun contatto viene creato da solo: se serve una persona, il nome va scritto a mano.');
  notes.push('I consensi restano a «no»: un recapito pubblico non è un consenso.');

  return {
    accountMode: aziende.length > 0 ? 'link' : 'create',
    accountId: aziende[0]?.id || '',
    accountDraft: {
      legalName: ragioneSociale,
      displayName: profile.displayName || ragioneSociale,
      website: valore(profile.declared?.website) || (domain ? `https://${domain}` : ''),
      vatNumber,
      // Il settore sulla scheda è una **stima**: entra nel CRM come punto di
      // partenza da correggere, non come un dato camerale.
      industry: valore(profile.estimated?.sector),
      city: valore(profile.identity?.city),
      address: valore(profile.identity?.address),
    },
    accountCandidates: aziende,

    // Si parte sempre da «non creare»: vedi il commento in testa al file.
    contactMode: contattiEsistenti.length > 0 ? 'link' : 'skip',
    contactId: contattiEsistenti[0]?.id || '',
    contactDraft: { firstName: '', lastName: '', email: '', phone: '', role: '' },
    contactCandidates: contattiEsistenti,

    leadMode: lead.length > 0 ? 'link' : 'create',
    leadId: lead[0]?.id || '',
    leadDraft: {
      companyName: profile.displayName || ragioneSociale,
      companyDomain: domain,
      email,
      phone,
    },
    leadCandidates: lead,

    notes,
  };
}

// ------------------------------------------------------------ esecuzione

export interface BridgeResult {
  accountId: string;
  contactId: string;
  leadId: string;
  /** Vero se nel CRM è finito il dato di una persona. Cambia gli obblighi. */
  personalData: boolean;
  errors: string[];
}

/** Marca un record col punto da cui è arrivato. */
async function marcaProvenienza(
  ctx: CrmContextRef,
  collezione: string,
  id: string,
  sourceRef: string
): Promise<void> {
  // `origin` non è fra i campi immutabili, quindi si può scrivere dopo la
  // creazione: è una scrittura in più, e il prezzo per non duplicare la logica
  // di `createAccount` e compagne.
  await updateRecord(collezione, id, {
    origin: 'integration',
    provider: 'prospect',
    sourceRef,
  }, ctx.uid);
}

export async function executeBridge(
  ctx: CrmContextRef,
  profile: CrmCompanyProfile,
  proposal: BridgeProposal
): Promise<BridgeResult> {
  const result: BridgeResult = { accountId: '', contactId: '', leadId: '', personalData: false, errors: [] };
  const sourceRef = `prospect_profile:${profile.id}`;

  // Chi ha chiesto di non essere cercato non deve finire in un elenco da
  // chiamare. Una scheda raccolta **prima** della richiesta è esattamente il
  // modo in cui ci finirebbe, ed è il motivo per cui il controllo sta qui e
  // non solo sulla ricerca.
  const { vatNumber, domain } = chiaviDellaScheda(profile);
  const email = elenco<any>(profile.declared?.publicContacts).find(c => c?.kind === 'email')?.value || '';
  try {
    const esclusione = await checkExcluded(ctx.projectId, {
      vatNumber, domain, email,
      name: valore(profile.identity?.legalName) || profile.displayName,
    });
    if (esclusione) {
      await writeAudit(ctx, 'prospect.bridge_blocked', 'company_profile', profile.id, null,
        { exclusionId: esclusione.id });
      result.errors.push(describeExclusion(esclusione));
      return result;
    }
  } catch (error: any) {
    result.errors.push(error?.message || 'La lista di esclusione non è leggibile: non si è scritto niente.');
    return result;
  }

  // ----------------------------------------------------------- azienda
  try {
    if (proposal.accountMode === 'link' && proposal.accountId) {
      result.accountId = proposal.accountId;
    } else if (proposal.accountMode === 'create') {
      const { id } = await createAccount(ctx, {
        legalName: proposal.accountDraft.legalName,
        displayName: proposal.accountDraft.displayName,
        website: proposal.accountDraft.website,
        industry: proposal.accountDraft.industry,
        city: proposal.accountDraft.city,
        address: proposal.accountDraft.address,
        vatNumber: proposal.accountDraft.vatNumber,
        sources: ['prospect'],
      });
      if (id) {
        result.accountId = id;
        await marcaProvenienza(ctx, 'crm_accounts', id, sourceRef);
      } else {
        result.errors.push('L’azienda non è stata creata.');
      }
    }
  } catch (error) {
    console.error('Azienda non creata:', error);
    result.errors.push('L’azienda non è stata creata.');
  }

  // ----------------------------------------------------------- contatto
  // Solo se qualcuno ha scritto un nome: dalla scheda non arriva nessuna
  // persona, e inventarne una sarebbe peggio che non averla.
  const nome = `${proposal.contactDraft.firstName} ${proposal.contactDraft.lastName}`.trim();
  try {
    if (proposal.contactMode === 'link' && proposal.contactId) {
      result.contactId = proposal.contactId;
    } else if (proposal.contactMode === 'create' && nome) {
      const { id } = await createContact(ctx, {
        firstName: proposal.contactDraft.firstName,
        lastName: proposal.contactDraft.lastName,
        role: proposal.contactDraft.role,
        email: proposal.contactDraft.email,
        phone: proposal.contactDraft.phone,
        accountId: result.accountId,
      });
      if (id) {
        result.contactId = id;
        result.personalData = true;
        await marcaProvenienza(ctx, 'crm_contacts', id, sourceRef);
      } else {
        result.errors.push('Il contatto non è stato creato.');
      }
    } else if (proposal.contactMode === 'create' && !nome) {
      result.errors.push('Il contatto non è stato creato: manca il nome della persona.');
    }
  } catch (error) {
    console.error('Contatto non creato:', error);
    result.errors.push('Il contatto non è stato creato.');
  }

  // --------------------------------------------------------------- lead
  try {
    if (proposal.leadMode === 'link' && proposal.leadId) {
      result.leadId = proposal.leadId;
    } else if (proposal.leadMode === 'create') {
      const { id } = await createLead(ctx, {
        // Il lead è dell'azienda finché non si sa con chi si parla: il nome
        // della persona si mette solo se c'è davvero.
        fullName: nome,
        companyName: proposal.leadDraft.companyName,
        companyDomain: proposal.leadDraft.companyDomain,
        email: proposal.leadDraft.email,
        phone: proposal.leadDraft.phone,
        source: 'prospect',
      });
      if (id) {
        result.leadId = id;
        if (nome) result.personalData = true;
        await marcaProvenienza(ctx, 'crm_leads', id, sourceRef);
      } else {
        result.errors.push('Il lead non è stato creato.');
      }
    }
  } catch (error) {
    console.error('Lead non creato:', error);
    result.errors.push('Il lead non è stato creato.');
  }

  // --------------------------------------------------- scheda e tracce
  try {
    if (result.accountId || result.leadId) {
      await linkProfile(ctx, profile.id, {
        accountId: result.accountId || undefined,
        leadId: result.leadId || undefined,
      });
    }

    // La riga di provenienza si scrive **solo** se è passato il dato di una
    // persona. Scriverla per un `info@` significherebbe riempire il registro
    // dei dati personali di voci che dati personali non sono, e rendere
    // inutile l'unica lista che serve quando qualcuno chiede conto.
    if (result.personalData) {
      await recordSource(ctx, {
        profileId: profile.id,
        searchId: profile.lastSearchId,
        kind: 'manual',
        url: valore(profile.declared?.website),
        fields: ['crm.contact', 'crm.lead'],
        personalData: true,
        snippet: 'Dati di una persona trasferiti nel CRM da chi usava il ponte.',
      });
    }

    await writeAudit(ctx, 'prospect.bridged_to_crm', 'company_profile', profile.id, null, {
      accountId: result.accountId,
      contactId: result.contactId,
      leadId: result.leadId,
      personalData: result.personalData,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Collegamento della scheda non riuscito:', error);
    result.errors.push('I record sono stati creati ma la scheda non è stata collegata.');
  }

  return result;
}
