/**
 * Generare il report di un'azienda.
 *
 * Il percorso, e l'ordine conta:
 *
 * 1. si compone il report **dai soli dati raccolti**, per intero;
 * 2. si chiede al modello di riscrivere due sezioni su sei;
 * 3. si **controlla** quello che ha scritto: se introduce numeri che non sono
 *    nei fatti, si butta e restano le due sezioni composte al punto 1;
 * 4. si salva come **bozza**, sempre.
 *
 * Il punto 1 prima del 2 non è un dettaglio di implementazione: significa che
 * un report esiste sempre, anche quando la chiave non c'è, il modello è giù,
 * risponde una cosa strana o si rifiuta. Il contrario — chiedere prima e
 * comporre come ripiego — produce un pulsante che a volte non fa niente, e
 * nessuno capisce perché.
 *
 * E il punto 4 vale anche quando l'AI non è intervenuta: un documento che
 * qualcuno manderà a un cliente lo approva una persona, che l'abbia scritto un
 * modello o una funzione.
 */

import { auth } from '@/lib/firebase';
import { CrmContextRef } from '../base';
import { CrmCompanyProfile } from '@/types/prospect';
import { getProfiles } from './profiles';
import { createDraftReport } from './reports';
import { recordSource } from './sources';
import { factSheet, isReportable } from './report/facts';
import { composeReport, AI_WRITABLE } from './report/compose';
import { buildPrompt, parseAiSections, validateAiSections, PROMPT_VERSION } from './report/prompt';

const ENDPOINT = '/api/crm/prospect/report';

export interface ReportRun {
  ok: boolean;
  reportId: string;
  /** Vero se le due sezioni discorsive le ha scritte il modello. */
  aiUsed: boolean;
  /** Perché l'AI non è stata usata, quando non lo è stata. */
  aiNote: string;
  message: string;
}

type EsitoAi =
  | { ok: true; text: string; model: string }
  | { ok: false; note: string };

/** Chiama la route. Un «no» non è mai un errore: è un report senza AI. */
async function chiediAlModello(projectId: string, prompt: string): Promise<EsitoAi> {
  let token = '';
  try {
    token = (await auth.currentUser?.getIdToken()) || '';
  } catch (error) {
    console.error('Impossibile ottenere il token:', error);
  }
  if (!token) return { ok: false, note: 'Sessione scaduta: il report è stato composto senza AI.' };

  try {
    const risposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectId, prompt }),
    });
    const dati = await risposta.json().catch(() => ({}));

    if (!risposta.ok || dati?.ok === false) {
      return { ok: false, note: dati?.error || 'Il modello non ha risposto: il report è stato composto senza AI.' };
    }
    return { ok: true, text: String(dati?.text || ''), model: String(dati?.model || '') };
  } catch (error) {
    console.error('Chiamata al report fallita:', error);
    return { ok: false, note: 'Non è stato possibile contattare il server: il report è stato composto senza AI.' };
  }
}

export interface ReportOptions {
  /** Cosa vendiamo noi, in una frase. Cambia la sezione «perché ci interessano». */
  offering?: string;
  /** Per non chiamare il modello quando non lo si vuole: costa. */
  skipAi?: boolean;
}

export async function generateReport(
  ctx: CrmContextRef,
  profileId: string,
  options: ReportOptions = {}
): Promise<ReportRun> {
  let schede: CrmCompanyProfile[] = [];
  try {
    schede = await getProfiles(ctx.projectId);
  } catch (error) {
    console.error('Schede non lette:', error);
    return { ok: false, reportId: '', aiUsed: false, aiNote: '', message: 'Non è stato possibile leggere la scheda.' };
  }

  const scheda = schede.find(s => s.id === profileId);
  if (!scheda) {
    return { ok: false, reportId: '', aiUsed: false, aiNote: '', message: 'Scheda non trovata.' };
  }

  const fatti = factSheet(scheda);
  const abbastanza = isReportable(fatti);
  if (!abbastanza.ok) {
    return { ok: false, reportId: '', aiUsed: false, aiNote: '', message: abbastanza.reason };
  }

  // 1. Il report esiste già qui, completo.
  const composto = composeReport(fatti, { offering: options.offering });
  let sections = composto.sections;
  let aiUsed = false;
  let aiNote = options.skipAi ? 'Report composto senza AI su richiesta.' : '';
  let model = '';

  // 2 e 3. L'AI riscrive due sezioni, se supera il controllo.
  if (!options.skipAi) {
    const esito = await chiediAlModello(ctx.projectId, buildPrompt(fatti, options.offering || ''));

    if (!esito.ok) {
      aiNote = esito.note;
    } else {
      const sezioni = parseAiSections(esito.text);
      if (!sezioni) {
        aiNote = 'Il modello ha risposto in un formato non riconosciuto: restano le sezioni composte dai dati.';
      } else {
        const controllo = validateAiSections(sezioni, fatti);
        if (!controllo.ok) {
          // Si butta tutto, non solo la sezione col problema: se il modello ha
          // inventato un numero in una, non c'è motivo di fidarsi dell'altra.
          console.error('Risposta del modello scartata:', controllo.problems);
          aiNote = `Il testo del modello è stato scartato: ${controllo.problems[0]} Restano le sezioni composte dai dati.`;
        } else {
          sections = sections.map(s =>
            AI_WRITABLE.includes(s.key) ? { ...s, body: (sezioni as any)[s.key] || s.body } : s);
          aiUsed = true;
          model = esito.model;
        }
      }
    }
  }

  const sourceId = await recordSource(ctx, {
    profileId, searchId: scheda.lastSearchId,
    kind: aiUsed ? 'ai' : 'derived',
    url: '', personalData: false,
    fields: ['report.sections'],
    snippet: JSON.stringify({ aiUsed, model, promptVersion: PROMPT_VERSION, note: aiNote }),
  });

  // Le fonti stanno sui campi della scheda; qui si segna solo da dove viene il
  // report nel suo insieme, che è una cosa diversa e va tenuta distinta.
  const conFonte = sections.map(s => ({ ...s, sourceIds: sourceId ? [sourceId] : [] }));

  const reportId = await createDraftReport(ctx, {
    profileId,
    title: `${fatti.displayName} — come approcciarla`,
    sections: conFonte,
    model,
    promptVersion: PROMPT_VERSION,
    caveats: composto.caveats,
  });

  if (!reportId) {
    return { ok: false, reportId: '', aiUsed, aiNote, message: 'Il report è stato composto ma non salvato.' };
  }

  return {
    ok: true,
    reportId,
    aiUsed,
    aiNote,
    message: aiUsed
      ? 'Report in bozza: due sezioni scritte dal modello, le altre dai dati. Va letto e approvato prima di usarlo.'
      : `Report in bozza, composto dai dati raccolti.${aiNote ? ` ${aiNote}` : ''} Va letto e approvato prima di usarlo.`,
  };
}
