/**
 * I report.
 *
 * Un report dice a un commerciale come approcciare un'azienda: da dove entrare,
 * con chi parlare, e **cosa non dire** perché è una stima e non un fatto. Lo
 * scrive l'AI, quindi nasce `DRAFT` e ci resta finché una persona non lo
 * approva — la stessa regola adottata per il modulo gare, per lo stesso motivo:
 * un testo generato che esce senza che nessuno l'abbia letto prima o poi dice
 * una cosa sbagliata a un cliente.
 *
 * Da `APPROVED` non si torna indietro: si scrive una versione nuova, così resta
 * traccia di cosa era stato approvato e da chi.
 */

import { CrmProspectReport, ReportSection } from '@/types/prospect';
import {
  ReportState, REPORT_TRANSITIONS, REPORT_STATE_LABELS,
} from '@/components/crm/ricerca/constants';
import { canTransition } from '@/components/crm/constants';
import {
  CrmContextRef, createRecord, updateRecord, getRecords, subscribeToRecords,
  mapBase, byCreatedAtDesc,
} from '../base';
import { writeAudit } from '../audit';
import { PROSPECT_COLLECTIONS, nowIso } from './base';

const COLLECTION_NAME = PROSPECT_COLLECTIONS.reports;

function mapReport(id: string, data: any): CrmProspectReport {
  return {
    ...mapBase(id, data),
    profileId: data.profileId || '',
    state: data.state || 'DRAFT',
    title: data.title || '',
    sections: Array.isArray(data.sections) ? data.sections : [],
    model: data.model || '',
    promptVersion: data.promptVersion || '',
    approvedBy: data.approvedBy || '',
    approvedAt: data.approvedAt || '',
    caveats: Array.isArray(data.caveats) ? data.caveats : [],
  };
}

export class InvalidReportTransitionError extends Error {
  constructor(from: ReportState, to: ReportState) {
    super(`Da «${REPORT_STATE_LABELS[from]}» non si passa a «${REPORT_STATE_LABELS[to]}»`);
    this.name = 'InvalidReportTransitionError';
  }
}

export interface ReportDraft {
  profileId: string;
  title: string;
  sections: ReportSection[];
  model: string;
  promptVersion: string;
  caveats: string[];
}

/**
 * Crea la bozza. Non esiste una funzione che crei un report già approvato:
 * l'approvazione è un gesto di una persona, e va registrata come tale.
 */
export async function createDraftReport(ctx: CrmContextRef, draft: ReportDraft): Promise<string | null> {
  const id = await createRecord(COLLECTION_NAME, ctx, {
    profileId: draft.profileId,
    state: 'DRAFT' as ReportState,
    title: draft.title || 'Report',
    sections: draft.sections || [],
    model: draft.model || '',
    promptVersion: draft.promptVersion || '',
    approvedBy: '',
    approvedAt: '',
    caveats: draft.caveats || [],
  }, 'ai');

  if (id) {
    await writeAudit(ctx, 'prospect.report_drafted', 'prospect_report', id, null, {
      profileId: draft.profileId, model: draft.model, promptVersion: draft.promptVersion,
    });
  }
  return id;
}

async function getReportById(projectId: string, id: string): Promise<CrmProspectReport | null> {
  const tutti = await getRecords<CrmProspectReport>(COLLECTION_NAME, projectId, mapReport, { includeArchived: true });
  return tutti.find(r => r.id === id) || null;
}

export async function setReportState(ctx: CrmContextRef, id: string, to: ReportState): Promise<void> {
  const report = await getReportById(ctx.projectId, id);
  if (!report) {
    console.error('Report non trovato:', id);
    return;
  }
  if (!canTransition(REPORT_TRANSITIONS, report.state, to)) {
    throw new InvalidReportTransitionError(report.state, to);
  }
  if (report.state === to) return;

  const payload: Record<string, any> = { state: to };
  if (to === 'APPROVED') {
    payload.approvedBy = ctx.uid;
    payload.approvedAt = nowIso();
  }

  await updateRecord(COLLECTION_NAME, id, payload, ctx.uid);
  await writeAudit(ctx, 'prospect.report_state_changed', 'prospect_report', id,
    { state: report.state }, payload);
}

export function subscribeToReports(projectId: string, callback: (r: CrmProspectReport[]) => void) {
  return subscribeToRecords<CrmProspectReport>(COLLECTION_NAME, projectId, mapReport,
    report => callback(report.sort(byCreatedAtDesc)));
}

export async function getReportsForProfile(projectId: string, profileId: string): Promise<CrmProspectReport[]> {
  const tutti = await getRecords<CrmProspectReport>(COLLECTION_NAME, projectId, mapReport);
  return tutti.filter(r => r.profileId === profileId).sort(byCreatedAtDesc);
}

/** Vero se il report si può mandare a qualcuno: cioè se una persona l'ha approvato. */
export function isSendable(report: CrmProspectReport): boolean {
  return report.state === 'APPROVED' && !!report.approvedBy;
}
