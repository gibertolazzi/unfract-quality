'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, History, Ban, Loader2 } from 'lucide-react';
import { CrmContextRef } from '@/lib/crm/base';
import { CrmCompanyProfile, SearchCandidate } from './types';
import { useProspect } from '@/hooks/useProspect';
import { SearchBar } from './SearchBar';
import { CandidateList } from './CandidateList';
import { CompanyCard } from './CompanyCard';
import { SearchHistory } from './SearchHistory';
import { ExclusionPanel } from './ExclusionPanel';
import { ReportPanel } from './ReportPanel';
import { BridgePanel } from './BridgePanel';

import { runSearch, chooseCandidate, SearchOutcome } from '@/lib/crm/prospect/lookup';
import { runEstimates } from '@/lib/crm/prospect/estimates';
import { setSectorOverride } from '@/lib/crm/prospect/profiles';
import { generateReport } from '@/lib/crm/prospect/report';
import { setReportState } from '@/lib/crm/prospect/reports';
import { buildBridgeProposal, executeBridge, BridgeProposal } from '@/lib/crm/prospect/bridge';
import { webSearchProvider } from '@/lib/crm/prospect/providers/search';
import { addExclusion, liftExclusion } from '@/lib/crm/prospect/exclusions';

/**
 * La sezione «Ricerca aziende», in testa alle altre.
 *
 * È il rovescio del resto del CRM: le altre schede gestiscono chi ti ha già
 * contattato, questa va a cercare chi non ti conosce ancora. Per questo sta
 * prima di «Riepilogo» — è da lì che comincia il lavoro, non da un elenco di
 * cose già successe.
 *
 * Due parti sole: **cerca** e **cronologia**. Tutto il resto — dossier, report,
 * ponte verso il CRM — si apre dalla scheda trovata, perché è lì che si sta
 * guardando quando serve.
 */

interface RicercaSectionProps {
  ctx: CrmContextRef | null;
  ownerName: (uid: string) => string;
  onNotify: (message: string, kind?: 'ok' | 'ko') => void;
  /**
   * Chi può aggiungere o revocare un'esclusione. Il controllo vero non è
   * questo — gira nel browser come tutto il CRM (docs/DEROGHE.md) — ma serve a
   * non offrire un pulsante che poi non ha senso premere.
   */
  canManageExclusions?: boolean;
}

type Vista = 'cerca' | 'cronologia' | 'esclusioni';

export function RicercaSection({ ctx, ownerName, onNotify, canManageExclusions = true }: RicercaSectionProps) {
  const [vista, setVista] = useState<Vista>('cerca');
  const { profiles, searches, reports, exclusions, loading } = useProspect(ctx?.projectId, true);

  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState('');
  const [esito, setEsito] = useState<SearchOutcome | null>(null);
  const [profileId, setProfileId] = useState('');
  const [proposta, setProposta] = useState<BridgeProposal | null>(null);

  const scheda: CrmCompanyProfile | null = useMemo(
    () => profiles.find(p => p.id === profileId) || null,
    [profiles, profileId]
  );

  const reportDellaScheda = useMemo(
    () => reports.filter(r => r.profileId === profileId),
    [reports, profileId]
  );

  // La scheda appena trovata diventa quella aperta. Una ricerca che finisce e
  // lascia a schermo la scheda di prima è il modo più rapido di far leggere a
  // qualcuno i dati dell'azienda sbagliata.
  useEffect(() => {
    if (esito?.profileId) setProfileId(esito.profileId);
  }, [esito?.profileId]);

  if (!ctx) {
    return <p className="text-[11px] text-[#585858]">Serve un progetto attivo per cercare aziende.</p>;
  }

  const cerca = async (input: string) => {
    setRunning(true);
    setEsito(null);
    try {
      const risultato = await runSearch(ctx, input);
      setEsito(risultato);
      onNotify(risultato.message, risultato.ok ? 'ok' : 'ko');
    } catch (error) {
      console.error('Ricerca non riuscita:', error);
      onNotify('La ricerca non è riuscita.', 'ko');
    } finally {
      setRunning(false);
    }
  };

  const scegli = async (candidato: SearchCandidate) => {
    if (!esito?.searchId) return;
    setRunning(true);
    try {
      const risultato = await chooseCandidate(ctx, esito.searchId, candidato.refId);
      setEsito(risultato);
      onNotify(risultato.message, risultato.ok ? 'ok' : 'ko');
    } catch (error) {
      console.error('Candidato non risolto:', error);
      onNotify('Non è stato possibile ripartire da questo candidato.', 'ko');
    } finally {
      setRunning(false);
    }
  };

  const ricalcola = async () => {
    if (!scheda) return;
    setBusy('estimates');
    try {
      const risultato = await runEstimates(ctx, scheda.id);
      onNotify(risultato.message, risultato.ok ? 'ok' : 'ko');
    } finally {
      setBusy('');
    }
  };

  const scriviReport = async () => {
    if (!scheda) return;
    setBusy('report');
    try {
      const risultato = await generateReport(ctx, scheda.id);
      onNotify(risultato.message, risultato.ok ? 'ok' : 'ko');
    } finally {
      setBusy('');
    }
  };

  /**
   * Correggere il settore **e ricalcolare subito**: la correzione serve a
   * risistemare competitor e cliente-tipo, che da quello dipendono. Lasciarla
   * senza ricalcolo vorrebbe dire correggere una riga e lasciare sbagliate le
   * due che contano.
   */
  const correggiSettore = async (sectorCode: string, why: string) => {
    if (!scheda) return;
    setBusy('estimates');
    try {
      await setSectorOverride(ctx, scheda.id, sectorCode, why);
      const risultato = await runEstimates(ctx, scheda.id);
      onNotify(
        sectorCode ? risultato.message : 'Correzione annullata: torna la stima automatica.',
        risultato.ok ? 'ok' : 'ko'
      );
    } catch (error) {
      console.error('Correzione non salvata:', error);
      onNotify('La correzione non è stata salvata.', 'ko');
    } finally {
      setBusy('');
    }
  };

  const apriPonte = async () => {
    if (!scheda) return;
    setBusy('bridge');
    try {
      setProposta(await buildBridgeProposal(ctx.projectId, scheda));
    } catch (error) {
      console.error('Proposta non costruita:', error);
      onNotify('Non è stato possibile preparare il passaggio al CRM.', 'ko');
    } finally {
      setBusy('');
    }
  };

  const confermaPonte = async () => {
    if (!scheda || !proposta) return;
    setRunning(true);
    try {
      const risultato = await executeBridge(ctx, scheda, proposta);
      if (risultato.errors.length > 0) {
        onNotify(risultato.errors.join(' '), 'ko');
      } else {
        onNotify('Scheda portata nel CRM.', 'ok');
        setProposta(null);
      }
    } finally {
      setRunning(false);
    }
  };

  const candidati = esito?.candidates || [];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1">
        {([['cerca', 'Cerca', Search], ['cronologia', 'Cronologia', History], ['esclusioni', 'Esclusioni', Ban]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setVista(key)}
            aria-current={vista === key ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
              vista === key ? 'bg-white/10 font-medium text-white' : 'text-[#858585] hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={13} />
            {label}
            {key === 'cronologia' && searches.length > 0 && (
              <span className="text-[#3F3F3F]">{searches.length}</span>
            )}
            {key === 'esclusioni' && exclusions.filter(e => !e.archived).length > 0 && (
              <span className="text-[#3F3F3F]">{exclusions.filter(e => !e.archived).length}</span>
            )}
          </button>
        ))}
      </nav>

      {vista === 'cerca' && (
        <div className="space-y-4">
          <SearchBar onSearch={cerca} running={running} webSearchAvailable={webSearchProvider.configured} />

          {esito && !esito.profileId && candidati.length > 0 && (
            <CandidateList
              candidates={candidati}
              onChoose={scegli}
              limitNote={esito.message}
              busy={running}
            />
          )}

          {esito && !esito.profileId && candidati.length === 0 && (
            <p className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-4 text-[11px] text-[#858585]">
              {esito.message}
            </p>
          )}

          {esito?.warnings && esito.warnings.length > 0 && (
            <ul className="space-y-0.5">
              {esito.warnings.map((avviso, i) => (
                <li key={i} className="text-[11px] text-[#F59E0B]">— {avviso}</li>
              ))}
            </ul>
          )}

          {loading && !scheda && (
            <p className="flex items-center gap-2 text-[11px] text-[#585858]">
              <Loader2 size={12} className="animate-spin" /> Carico le schede già raccolte…
            </p>
          )}

          {scheda && (
            <>
              <CompanyCard
                profile={scheda}
                onRefreshEstimates={ricalcola}
                onGenerateReport={scriviReport}
                onBridge={apriPonte}
                onCorrectSector={correggiSettore}
                busy={busy}
              />
              <section>
                <h3 className="mb-2 text-xs font-medium text-white">Report</h3>
                <ReportPanel
                  reports={reportDellaScheda}
                  companyName={(scheda.identity?.legalName?.value as string) || scheda.displayName}
                  onApprove={async id => {
                    try {
                      await setReportState(ctx, id, 'APPROVED');
                      onNotify('Report approvato.', 'ok');
                    } catch (error: any) {
                      onNotify(error?.message || 'Non è stato possibile approvare il report.', 'ko');
                    }
                  }}
                  onArchive={async id => {
                    try {
                      await setReportState(ctx, id, 'ARCHIVED');
                    } catch (error: any) {
                      onNotify(error?.message || 'Non è stato possibile archiviare il report.', 'ko');
                    }
                  }}
                  ownerName={ownerName}
                  busy={Boolean(busy)}
                />
              </section>
            </>
          )}

          {!scheda && !esito && profiles.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-medium text-white">Schede già raccolte</h3>
              <div className="flex flex-wrap gap-2">
                {profiles.slice(0, 20).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProfileId(p.id)}
                    className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] px-3 py-1.5 text-[11px] text-[#C4C4C4] hover:bg-white/5"
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {vista === 'cronologia' && (
        <SearchHistory
          searches={searches}
          onOpenProfile={id => { setProfileId(id); setEsito(null); setVista('cerca'); }}
          ownerName={ownerName}
        />
      )}

      {vista === 'esclusioni' && (
        <ExclusionPanel
          exclusions={exclusions}
          canManage={canManageExclusions}
          ownerName={ownerName}
          busy={Boolean(busy)}
          onAdd={async input => {
            setBusy('exclusion');
            try {
              const id = await addExclusion(ctx, input);
              onNotify(id ? 'Esclusione registrata: da ora non viene più cercato.' : 'Valore non riconoscibile.', id ? 'ok' : 'ko');
            } finally { setBusy(''); }
          }}
          onLift={async (id, why) => {
            setBusy('exclusion');
            try {
              await liftExclusion(ctx, id, why);
              onNotify('Esclusione revocata. Resta scritta, con chi e quando.', 'ok');
            } finally { setBusy(''); }
          }}
        />
      )}

      {proposta && scheda && (
        <BridgePanel
          proposal={proposta}
          onChange={setProposta}
          onConfirm={confermaPonte}
          onClose={() => setProposta(null)}
          running={running}
        />
      )}
    </div>
  );
}
