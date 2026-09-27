/**
 * Chi può fare cosa nella sezione «Ricerca aziende».
 *
 * ATTENZIONE, e vale la pena leggerlo prima di fidarsi: questi controlli
 * girano **nel browser**, come tutto il CRM (docs/DEROGHE.md, deroga 2). Sono
 * qui perché l'interfaccia non offra pulsanti che non dovrebbe, non perché
 * fermino qualcuno che sappia scrivere una richiesta a mano.
 *
 * Le uniche due cose che valgono davvero lato server sono nelle regole
 * Firestore: `allow delete: if false` e l'audit in sola aggiunta.
 */

export const PROSPECT_ACTIONS = [
  'search.free',      // cercare per partita IVA o dominio: non costa
  'search.paid',      // cercare per nome: consuma il motore di ricerca
  'profile.read',
  'profile.refresh',  // rifare la raccolta di una scheda già in archivio
  'profile.link',     // collegare la scheda a un lead o a un'azienda del CRM
  'report.generate',  // far scrivere un report all'AI: costa
  'report.approve',   // approvare una bozza: è una firma
  'budget.configure',
  'exclusion.manage', // gestire chi non va più cercato
] as const;
export type ProspectAction = typeof PROSPECT_ACTIONS[number];

export const PROSPECT_ACTION_LABELS: Record<ProspectAction, string> = {
  'search.free':       'Cercare per partita IVA o sito',
  'search.paid':       'Cercare per nome',
  'profile.read':      'Leggere le schede',
  'profile.refresh':   'Aggiornare una scheda',
  'profile.link':      'Collegare una scheda al CRM',
  'report.generate':   'Generare un report',
  'report.approve':    'Approvare un report',
  'budget.configure':  'Configurare il tetto di spesa',
  'exclusion.manage':  'Gestire le esclusioni',
};

/** Chi lavora nel progetto. */
const MEMBER_ACTIONS: ProspectAction[] = [
  'search.free', 'search.paid', 'profile.read', 'profile.refresh',
  'profile.link', 'report.generate',
];

/**
 * Riservate a chi amministra.
 *
 * `report.approve` sta qui per una ragione precisa: approvare un testo scritto
 * dall'AI significa dire «questo si può mandare a un cliente». Se può farlo
 * chiunque, la bozza obbligatoria diventa un clic in più e non un controllo.
 */
const ADMIN_ONLY_ACTIONS: ProspectAction[] = [
  'report.approve', 'budget.configure', 'exclusion.manage',
];

export type ProspectRole = 'admin' | 'member' | 'viewer';

export function can(role: ProspectRole, action: ProspectAction): boolean {
  if (role === 'admin') return true;
  if (role === 'viewer') return action === 'profile.read';
  return MEMBER_ACTIONS.includes(action);
}

/** Perché no, in una frase da mostrare. Vuota quando l'azione è permessa. */
export function denialReason(role: ProspectRole, action: ProspectAction): string {
  if (can(role, action)) return '';
  const cosa = PROSPECT_ACTION_LABELS[action];
  if (role === 'viewer') {
    return `${cosa}: serve essere membro del progetto, non solo in lettura.`;
  }
  if (ADMIN_ONLY_ACTIONS.includes(action)) {
    return `${cosa}: è riservata a chi amministra il progetto.`;
  }
  return `${cosa}: non consentita con il ruolo attuale.`;
}

/** Le azioni che consumano budget: l'interfaccia le segnala prima del clic. */
export const COSTLY_ACTIONS: ProspectAction[] = ['search.paid', 'report.generate'];
