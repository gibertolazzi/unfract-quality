/**
 * La scheda ridotta a **fatti**, divisi per livello.
 *
 * Serve a due cose che sembrano diverse e sono la stessa: comporre il report, e
 * dare all'AI qualcosa su cui lavorare. In tutti e due i casi la regola è
 * identica — si passa solo ciò che è stato raccolto, **con scritto di che
 * livello è**, e nient'altro.
 *
 * È qui che si decide cosa un modello linguistico può vedere. Un prompt che
 * riceve la scheda intera riceve anche i campi vuoti con dentro il motivo per
 * cui sono vuoti, e quei motivi il modello li legge come informazioni: «il
 * sito ha rifiutato la connessione» diventa una frase nel report. Quindi
 * passano i **valori**, non le note, e i buchi si contano a parte.
 */

import { CrmCompanyProfile, PublicContact, SocialLink, TechSignal, CompetitorGuess, IdealCustomer } from '@/types/prospect';
import { freshnessLabel } from '../base';

export interface FactSheet {
  displayName: string;

  /** Certi: da un registro ufficiale. */
  certain: {
    legalName: string;
    vatNumber: string;
    vatValid: boolean | null;
    city: string;
    province: string;
    address: string;
    checkedAt: string;
  };

  /** Dichiarati: lo dice l'azienda, sul proprio sito. */
  declared: {
    website: string;
    description: string;
    about: string;
    solutions: string[];
    clients: string[];
    partners: string[];
    contacts: PublicContact[];
    socials: SocialLink[];
    tech: TechSignal[];
    collectedAt: string;
  };

  /** Stimati: li abbiamo dedotti noi. */
  estimated: {
    sector: string;
    sectorCode: string;
    sectorSignals: string[];
    competitors: CompetitorGuess[];
    competitorNote: string;
    idealCustomer: IdealCustomer | null;
    idealCustomerNote: string;
    collectedAt: string;
  };

  /** Cosa non si è riusciti a sapere. Non entra nel prompt: entra nel report. */
  gaps: string[];
}

const testo = (campo: any): string => (typeof campo?.value === 'string' ? campo.value : '');
const lista = <T,>(campo: any): T[] => (Array.isArray(campo?.value) ? campo.value : []);

export function factSheet(profile: CrmCompanyProfile): FactSheet {
  const identity = profile.identity || ({} as any);
  const declared = profile.declared || ({} as any);
  const estimated = profile.estimated || ({} as any);

  return {
    displayName: profile.displayName || testo(identity.legalName) || '',

    certain: {
      legalName: testo(identity.legalName),
      vatNumber: testo(identity.vatNumber),
      vatValid: typeof identity.vatValid?.value === 'boolean' ? identity.vatValid.value : null,
      city: testo(identity.city),
      province: testo(identity.province),
      address: testo(identity.address),
      checkedAt: profile.collectedAt?.identity || '',
    },

    declared: {
      website: testo(declared.website),
      description: testo(declared.description),
      // Il racconto dell'azienda si taglia: al modello serve capire cosa fa,
      // non leggere tre pagine di storia aziendale.
      about: testo(declared.aboutText).slice(0, 1200),
      solutions: lista<string>(declared.solutions),
      clients: lista<string>(declared.declaredClients),
      partners: lista<string>(declared.declaredPartners),
      contacts: lista<PublicContact>(declared.publicContacts),
      socials: lista<SocialLink>(declared.socialLinks),
      tech: lista<TechSignal>(declared.techStack),
      collectedAt: profile.collectedAt?.declared || '',
    },

    estimated: {
      sector: testo(estimated.sector),
      sectorCode: testo(estimated.atecoCode),
      sectorSignals: Array.isArray(estimated.sector?.signals) ? estimated.sector.signals : [],
      competitors: lista<CompetitorGuess>(estimated.competitors),
      competitorNote: estimated.competitors?.note || '',
      idealCustomer: (estimated.idealCustomer?.value as IdealCustomer) || null,
      idealCustomerNote: estimated.idealCustomer?.note || '',
      collectedAt: profile.collectedAt?.estimated || '',
    },

    gaps: Array.isArray(profile.gaps) ? profile.gaps : [],
  };
}

/**
 * Se c'è abbastanza per scrivere un report che valga la pena leggere.
 *
 * Un report su un'azienda di cui sappiamo il nome e basta è un foglio con
 * scritto il nome: fa perdere tempo a chi lo apre e fa perdere fiducia allo
 * strumento. Meglio dire cosa manca.
 */
export function isReportable(facts: FactSheet): { ok: boolean; reason: string } {
  const haIdentita = Boolean(facts.certain.legalName || facts.certain.vatNumber);
  const haSostanza = Boolean(facts.declared.description || facts.declared.about || facts.declared.solutions.length);

  if (!haIdentita && !haSostanza) {
    return { ok: false, reason: 'Di questa azienda non sappiamo ancora niente: cerca per partita IVA o leggi il sito, poi rifai il report.' };
  }
  if (!haSostanza) {
    return { ok: false, reason: 'Sappiamo chi è ma non cosa fa: il sito non è stato letto, e senza quello il report direbbe solo la ragione sociale.' };
  }
  return { ok: true, reason: '' };
}

/** «raccolta 3 giorni fa» accanto a ciascuna area, per le fonti del report. */
export function freshness(facts: FactSheet): { identity: string; declared: string; estimated: string } {
  return {
    identity: freshnessLabel(facts.certain.checkedAt),
    declared: freshnessLabel(facts.declared.collectedAt),
    estimated: freshnessLabel(facts.estimated.collectedAt),
  };
}
