'use client';

import { AlertTriangle, RefreshCw, FileText, ArrowRightLeft, ExternalLink } from 'lucide-react';
import { CrmCompanyProfile } from './types';
import { EvidenceField, EvidenceLegend } from './EvidenceField';
import { freshnessLabel, isStale } from '@/lib/crm/prospect/base';
import { buildSupplierView } from '@/lib/crm/prospect/estimate/suppliers';
import { SectorCorrection } from './SectorCorrection';

/**
 * Il dossier di un'azienda, diviso nei tre livelli del piano (§1) e in
 * quell'ordine: **identità**, **quello che dichiara**, **quello che stimiamo
 * noi**.
 *
 * L'ordine non è estetico. Si legge dall'alto, e dall'alto si scende dal più
 * solido al più incerto: chi si ferma a metà si è fermato sulla parte che può
 * ripetere al telefono.
 *
 * Le lacune stanno **in cima**, non in fondo. Se il sito ha rifiutato la
 * connessione, chi guarda deve saperlo prima di concludere che quell'azienda
 * non pubblica i suoi clienti — non dopo aver letto tre riquadri vuoti.
 */

interface CompanyCardProps {
  profile: CrmCompanyProfile;
  onRefreshEstimates: () => void;
  onGenerateReport: () => void;
  onBridge: () => void;
  onCorrectSector?: (sectorCode: string, why: string) => void;
  busy?: string;
}

function Sezione({ titolo, sottotitolo, children }: {
  titolo: string; sottotitolo: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-4">
      <header className="mb-2">
        <h3 className="text-xs font-medium text-white">{titolo}</h3>
        <p className="text-[10px] text-[#585858]">{sottotitolo}</p>
      </header>
      {children}
    </section>
  );
}

export function CompanyCard({
  profile, onRefreshEstimates, onGenerateReport, onBridge, onCorrectSector, busy,
}: CompanyCardProps) {
  const { identity, declared, estimated } = profile;

  const vecchie = (['identity', 'declared', 'estimated'] as const)
    .filter(area => isStale(profile.collectedAt[area], area));

  const fornitori = buildSupplierView(
    (declared.techStack?.value as any[]) || [],
    (declared.declaredPartners?.value as string[]) || [],
    Boolean(profile.collectedAt.declared)
  );

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium text-white">
            {(identity.legalName?.value as string) || profile.displayName}
          </h2>
          <p className="text-[11px] text-[#585858]">
            Identità {freshnessLabel(profile.collectedAt.identity)} · sito {freshnessLabel(profile.collectedAt.declared)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefreshEstimates}
            disabled={Boolean(busy)}
            title="Ricalcola settore, competitor e cliente-tipo. Non costa niente."
            className="flex items-center gap-1.5 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-[11px] text-[#C4C4C4] hover:bg-white/5 disabled:opacity-40"
          >
            <RefreshCw size={12} className={busy === 'estimates' ? 'animate-spin' : ''} />
            Ricalcola le stime
          </button>
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={Boolean(busy)}
            className="flex items-center gap-1.5 rounded-lg border border-[#1A1A1A] px-3 py-1.5 text-[11px] text-[#C4C4C4] hover:bg-white/5 disabled:opacity-40"
          >
            <FileText size={12} className={busy === 'report' ? 'animate-pulse' : ''} />
            Scrivi il report
          </button>
          <button
            type="button"
            onClick={onBridge}
            disabled={Boolean(busy)}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-black disabled:opacity-40"
          >
            <ArrowRightLeft size={12} />
            Porta nel CRM
          </button>
        </div>
      </header>

      {/* Le lacune in cima: sono il contesto per leggere tutto il resto. */}
      {profile.gaps.length > 0 && (
        <div className="rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#F59E0B]">
            <AlertTriangle size={12} />
            Cosa non si è riusciti a leggere
          </p>
          <ul className="space-y-0.5">
            {profile.gaps.map((lacuna, i) => (
              <li key={i} className="text-[11px] text-[#C4C4C4]">— {lacuna}</li>
            ))}
          </ul>
        </div>
      )}

      {vecchie.length > 0 && (
        <p className="text-[11px] text-[#858585]">
          {vecchie.length === 3
            ? 'Tutta la scheda è da rinfrescare.'
            : `Da rinfrescare: ${vecchie.map(a => a === 'identity' ? 'l’identità' : a === 'declared' ? 'il sito' : 'le stime').join(', ')}.`}
          {' '}Non si aggiorna da sola: una ricerca ripetuta a ogni apertura moltiplicherebbe le chiamate.
        </p>
      )}

      <EvidenceLegend />

      <Sezione titolo="Identità" sottotitolo="Da VIES, il registro della Commissione Europea. È l’unica parte che può essere certa.">
        <EvidenceField label="Ragione sociale" field={identity.legalName} />
        <EvidenceField label="Partita IVA" field={identity.vatNumber} />
        <EvidenceField label="Verifica VIES" field={identity.vatValid} />
        <EvidenceField label="Sede" field={identity.address} />
        <EvidenceField label="Città" field={identity.city} />
        <EvidenceField label="Provincia" field={identity.province} />
      </Sezione>

      <Sezione titolo="Quello che dichiara" sottotitolo="Letto dal suo sito. Sono cose che l’azienda dice di sé: fatti, ma non verificati da un registro.">
        <EvidenceField label="Sito" field={declared.website} />
        <EvidenceField label="Descrizione" field={declared.description} />
        <EvidenceField label="Cosa vende" field={declared.solutions} />
        <EvidenceField label="Clienti citati" field={declared.declaredClients} />
        <EvidenceField label="Partner" field={declared.declaredPartners} />
        <EvidenceField label="Recapiti pubblici" field={declared.publicContacts} />
        <EvidenceField label="Profili social" field={declared.socialLinks} />
        <EvidenceField label="Tecnologie" field={declared.techStack} />
      </Sezione>

      <Sezione titolo="Quello che stimiamo noi" sottotitolo="Dedotto da noi, con il metodo in chiaro. Da non citare come un dato.">
        <EvidenceField label="Settore" field={estimated.sector} />
        <EvidenceField label="Divisione ATECO" field={estimated.atecoCode} />
        <EvidenceField label="Dimensione" field={estimated.sizeRange} />
        <EvidenceField label="Competitor" field={estimated.competitors} />
        <EvidenceField label="Cliente-tipo" field={estimated.idealCustomer} />

        {onCorrectSector && (
          <SectorCorrection
            override={profile.overrides?.sectorCode}
            onSave={(codice, perche) => onCorrectSector(codice, perche)}
            onClear={() => onCorrectSector('', '')}
            busy={Boolean(busy)}
          />
        )}
      </Sezione>

      <Sezione titolo="Fornitori" sottotitolo="Le tecnologie sono fatti letti dal sito. Il resto della catena di fornitura non è pubblico.">
        {fornitori.technology.length > 0 ? (
          <div className="space-y-2">
            {fornitori.technology.map(gruppo => (
              <div key={gruppo.category} className="flex items-start gap-3">
                <span className="w-32 shrink-0 text-[11px] text-[#858585]">{gruppo.category}</span>
                <span className="flex flex-wrap gap-1">
                  {gruppo.items.map(voce => (
                    <span key={voce.name} title={voce.evidence}
                      className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-[#C4C4C4]">
                      {voce.name}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] italic text-[#3F3F3F]">Nessuna tecnologia riconosciuta.</p>
        )}

        {fornitori.hooks.length > 0 && (
          <div className="mt-3 border-t border-[#131313] pt-2">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-[#585858]">Da dove entrare</p>
            <ul className="space-y-1">
              {fornitori.hooks.map((gancio, i) => (
                <li key={i} className="text-[11px] text-[#C4C4C4]">— {gancio}</li>
              ))}
            </ul>
          </div>
        )}

        <ul className="mt-3 space-y-0.5 border-t border-[#131313] pt-2">
          {fornitori.gaps.map((lacuna, i) => (
            <li key={i} className="text-[10px] italic text-[#585858]">{lacuna}</li>
          ))}
        </ul>
      </Sezione>

      {(profile.linkedAccountId || profile.linkedLeadId) && (
        <p className="flex items-center gap-1.5 text-[11px] text-[#10B981]">
          <ExternalLink size={12} />
          Questa scheda è già collegata al CRM.
        </p>
      )}
    </div>
  );
}
