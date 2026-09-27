/**
 * Calcolare le stime di una scheda e scriverle.
 *
 * Non si fa da sé all'apertura: si chiede. Le stime dipendono da cosa c'è
 * sulla scheda e da quante altre schede ci sono in archivio, e ricalcolarle a
 * ogni sguardo vorrebbe dire che la stessa scheda mostra numeri diversi a due
 * persone che la guardano nello stesso minuto.
 *
 * Costa **zero**: si ricombinano dati già raccolti, senza toccare la rete. Per
 * questo `derived` è una fonte a sé — una stima non aggiunge dati, li rimette
 * insieme, e chi legge deve poter risalire a quando è stata fatta.
 */

import { CrmContextRef } from '../base';
import { CrmCompanyProfile } from '@/types/prospect';
import { nowIso } from './base';
import { getProfiles, updateProfileArea } from './profiles';
import { recordSource } from './sources';
import { buildEstimatedArea } from './estimate/build';
import { CompetitorInput } from './estimate/competitors';

export interface EstimateRun {
  ok: boolean;
  /** Quante schede sono state confrontate per i competitor. */
  consideredCount: number;
  message: string;
}

/** Riduce una scheda al minimo che serve per il confronto fra concorrenti. */
export function toCompetitorInput(profile: CrmCompanyProfile): CompetitorInput {
  return {
    refId: profile.id,
    name: (profile.identity?.legalName?.value as string) || profile.displayName,
    website: (profile.declared?.website?.value as string) || '',
    sectorCode: (profile.estimated?.atecoCode?.value as string) || '',
    province: (profile.identity?.province?.value as string) || '',
    region: '',
  };
}

export async function runEstimates(ctx: CrmContextRef, profileId: string): Promise<EstimateRun> {
  let schede: CrmCompanyProfile[] = [];
  try {
    schede = await getProfiles(ctx.projectId);
  } catch (error) {
    console.error('Schede non lette:', error);
    return { ok: false, consideredCount: 0, message: 'Non è stato possibile leggere le schede in archivio.' };
  }

  const scheda = schede.find(s => s.id === profileId);
  if (!scheda) {
    return { ok: false, consideredCount: 0, message: 'Scheda non trovata.' };
  }

  const altre = schede.filter(s => s.id !== profileId).map(toCompetitorInput);
  const at = nowIso();

  const sourceId = await recordSource(ctx, {
    profileId, searchId: scheda.lastSearchId, kind: 'derived',
    url: '', personalData: false,
    fields: ['estimated.sector', 'estimated.atecoCode', 'estimated.competitors', 'estimated.idealCustomer'],
    snippet: JSON.stringify({ confrontate: altre.length, metodo: 'settore da parole del sito, competitor per settore e provincia' }),
  });

  const area = buildEstimatedArea({
    refId: profileId,
    identity: scheda.identity,
    declared: scheda.declared,
    others: altre,
    sourceId: sourceId || '',
    at,
    sectorOverride: (scheda.overrides?.sectorCode?.value as string) || '',
  });

  // Le lacune della scheda restano quelle della raccolta: le stime non ne
  // risolvono nessuna, e sovrascriverle qui cancellerebbe il motivo per cui
  // un campo è vuoto.
  await updateProfileArea(ctx, profileId, 'estimated', area, scheda.gaps);

  const settore = area.sector.value as string | null;
  const corretto = Boolean(scheda.overrides?.sectorCode?.value);
  return {
    ok: true,
    consideredCount: altre.length,
    message: settore
      ? `${corretto ? 'Settore corretto a mano' : 'Settore stimato'}: ${settore}. Confrontate ${altre.length} schede in archivio.`
      : `Settore non concluso: ${area.sector.note}`,
  };
}
