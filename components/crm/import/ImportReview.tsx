'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { AlertTriangle, Copy, Check, ShieldAlert } from 'lucide-react';
import { ImportPlan, DuplicatePolicy, PlanCounts, willImport } from '@/lib/crm/import/plan';
import { ImportEntity, TARGET_FIELDS } from '@/lib/crm/import/mapping';
import { OwnerOption } from '../leads/LeadFiltersBar';

interface ImportReviewProps {
  plan: ImportPlan;
  counts: PlanCounts;
  policy: DuplicatePolicy;
  defaultSource: string;
  ownerUid: string;
  owners: OwnerOption[];
  entity: ImportEntity;
  excluded: Set<number>;
  onPolicyChange: (policy: DuplicatePolicy) => void;
  onDefaultSourceChange: (source: string) => void;
  onOwnerChange: (uid: string) => void;
  onToggleRow: (lineNumber: number) => void;
}

const POLICY_LABELS: Record<DuplicatePolicy, { label: string; hint: string }> = {
  skip:   { label: 'Salta',      hint: 'I duplicati non entrano nel CRM' },
  import: { label: 'Importa',    hint: 'Entrano come record nuovi, segnalati come possibili duplicati' },
  update: { label: 'Aggiorna',   hint: 'Aggiorna il record esistente con i campi valorizzati nel file' },
};

const inputClass =
  'rounded-lg border border-[#1A1A1A] bg-black/30 px-2.5 py-1.5 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none';

function Counter({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 first:pl-0">
      <span className="text-base font-semibold leading-none" style={{ color: color || '#FFFFFF' }}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">{label}</span>
    </div>
  );
}

export function ImportReview({
  plan, counts, policy, defaultSource, ownerUid, owners, entity, excluded,
  onPolicyChange, onDefaultSourceChange, onOwnerChange, onToggleRow,
}: ImportReviewProps) {
  const { t } = useTranslation();
  const fields = TARGET_FIELDS[entity];
  // Le colonne dell'anteprima: i campi davvero mappati, non tutto il modello.
  const columns = plan.mappedFields
    .map(key => fields.find(f => f.key === key))
    .filter(Boolean)
    .slice(0, 5) as typeof fields;

  const consentMapped = plan.mappedFields.includes('consentEmail');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center divide-x divide-[#1A1A1A] overflow-x-auto rounded-2xl border border-[#1A1A1A] bg-black/20 px-5 py-3">
        <Counter value={counts.importable} label="Da importare" color="#10B981" />
        <Counter value={counts.duplicatesExisting} label="Già nel CRM" color={counts.duplicatesExisting ? '#F59E0B' : undefined} />
        <Counter value={counts.duplicatesInFile} label="Ripetuti nel file" color={counts.duplicatesInFile ? '#F59E0B' : undefined} />
        <Counter value={counts.withErrors} label="Con errori" color={counts.withErrors ? '#EF4444' : undefined} />
        <Counter value={counts.excluded} label="Escluse a mano" />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Se il record esiste già</span>
          <div className="flex gap-1">
            {(Object.keys(POLICY_LABELS) as DuplicatePolicy[]).map(key => (
              <button
                key={key}
                type="button"
                title={POLICY_LABELS[key].hint}
                onClick={() => onPolicyChange(key)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  policy === key ? 'bg-white/10 font-medium text-white' : 'text-[#858585] hover:bg-white/5 hover:text-white'
                }`}
              >
                {POLICY_LABELS[key].label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Fonte</span>
          <input
            value={defaultSource}
            onChange={e => onDefaultSourceChange(e.target.value)}
            placeholder="es. Fiera Milano 2026"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Assegna a</span>
          <select value={ownerUid} onChange={e => onOwnerChange(e.target.value)} className={inputClass}>
            {owners.map(owner => (
              <option key={owner.uid} value={owner.uid}>{owner.name}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[10px] text-[#5A5A5A]">{POLICY_LABELS[policy].hint}.</p>

      <div className="flex items-start gap-2 rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2.5">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[#858585]" />
        <p className="text-[11px] text-[#858585]">
          {consentMapped
            ? 'Il consenso arriva dalla colonna mappata. Resta a chi importa dimostrare quando e come è stato raccolto: il file non è una prova.'
            : 'Nessuna colonna di consenso: i record entrano senza consenso email e non potranno ricevere comunicazioni finché non lo si raccoglie.'}
        </p>
      </div>

      <div className="max-h-[36vh] overflow-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-[#0B0B0B]">
            <tr className="border-b border-[#1A1A1A] text-left">
              <th className="w-10 px-3 py-2.5"></th>
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Riga</th>
              {columns.map(field => (
                <th key={field.key} className="px-3 py-2.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">
                  {field.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Esito</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map(row => {
              const isExcluded = excluded.has(row.lineNumber);
              const included = willImport({ ...row, excluded: isExcluded }, policy);

              return (
                <tr
                  key={row.lineNumber}
                  className={`border-b border-[#131313] last:border-0 ${included ? '' : 'opacity-50'}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      disabled={row.errors.length > 0}
                      onChange={() => onToggleRow(row.lineNumber)}
                      title={row.errors.length > 0 ? 'Riga con errori: non importabile' : 'Includi o escludi la riga'}
                      className="accent-white disabled:opacity-30"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-[#5A5A5A]">{row.lineNumber}</td>
                  {columns.map(field => (
                    <td key={field.key} className="max-w-[12rem] truncate px-3 py-2 text-xs text-white">
                      {String(row.values[field.key] ?? '') || '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      {row.errors.map(error => (
                        <span key={error} className="flex items-center gap-1.5 text-[11px] text-[#EF4444]">
                          <AlertTriangle size={11} /> {error}
                        </span>
                      ))}
                      {row.duplicate && (
                        <span className="flex items-center gap-1.5 text-[11px] text-[#F59E0B]">
                          <Copy size={11} />
                          {row.duplicate.scope === 'file'
                            ? `Già presente alla ${row.duplicate.label}`
                            : `Già nel CRM: ${row.duplicate.label}`}
                          <span className="text-[#5A5A5A]">({row.duplicate.matchedOn.join(', ')})</span>
                        </span>
                      )}
                      {row.warnings.map(warning => (
                        <span key={warning} className="text-[11px] text-[#858585]">{warning}</span>
                      ))}
                      {row.errors.length === 0 && !row.duplicate && row.warnings.length === 0 && (
                        <span className="flex items-center gap-1.5 text-[11px] text-[#10B981]">
                          <Check size={11} /> Pronta
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
