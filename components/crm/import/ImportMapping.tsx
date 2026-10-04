'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { ArrowRight, CircleSlash } from 'lucide-react';
import { Table } from '@/lib/crm/import/parse';
import {
  ImportEntity, ENTITY_LABELS, TARGET_FIELDS, IDENTIFYING_FIELDS, ColumnMapping,
} from '@/lib/crm/import/mapping';

interface ImportMappingProps {
  table: Table;
  entity: ImportEntity;
  mapping: ColumnMapping;
  onEntityChange: (entity: ImportEntity) => void;
  onMappingChange: (mapping: ColumnMapping) => void;
}

const selectClass =
  'w-full rounded-lg border border-[#1A1A1A] bg-black/30 px-2.5 py-1.5 text-xs text-white focus:border-[#2A2A2A] focus:outline-none';

export function ImportMapping({
  table, entity, mapping, onEntityChange, onMappingChange,
}: ImportMappingProps) {
  const { t } = useTranslation();
  const fields = TARGET_FIELDS[entity];
  const identifying = IDENTIFYING_FIELDS[entity];

  // Un campo mappato due volte è quasi sempre un errore di lettura, non una scelta.
  const usage = new Map<string, number>();
  Object.values(mapping).forEach(key => {
    if (key) usage.set(key, (usage.get(key) || 0) + 1);
  });

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const hasIdentifier = identifying.some(key => usage.has(key));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Cosa contiene il file</span>
          <div className="flex gap-1">
            {(Object.keys(ENTITY_LABELS) as ImportEntity[]).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => onEntityChange(key)}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  entity === key ? 'bg-white/10 font-medium text-white' : 'text-[#858585] hover:bg-white/5 hover:text-white'
                }`}
              >
                {ENTITY_LABELS[key]}
              </button>
            ))}
          </div>
        </label>

        <p className="text-[10px] text-[#5A5A5A]">
          {mappedCount} colonne su {table.columns.length} importate
        </p>
      </div>

      {!hasIdentifier && (
        <p className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-xs text-[#F59E0B]">
          Manca un campo identificativo: assegna almeno{' '}
          {identifying.map(key => fields.find(f => f.key === key)?.label).filter(Boolean).join(', ')}.
        </p>
      )}

      <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-[#1A1A1A]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-[#0B0B0B]">
            <tr className="border-b border-[#1A1A1A] text-left">
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Colonna del file</th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Esempio</th>
              <th className="px-4 py-2.5 text-[10px] uppercase tracking-wide text-[#5A5A5A]">Campo CRM</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map(column => {
              const assigned = mapping[column] || '';
              const field = fields.find(f => f.key === assigned);
              // Primo valore non vuoto: mostra com'è fatto il dato, non la prima cella a caso.
              const sample = table.rows.find(row => (row.values[column] || '').trim())?.values[column] || '';
              const duplicated = assigned && (usage.get(assigned) || 0) > 1;

              return (
                <tr key={column} className="border-b border-[#131313] last:border-0">
                  <td className="px-4 py-2 align-middle">
                    <div className="flex items-center gap-2">
                      {assigned
                        ? <ArrowRight size={12} className="text-[#10B981]" />
                        : <CircleSlash size={12} className="text-[#3F3F3F]" />}
                      <span className={`text-xs ${assigned ? 'text-white' : 'text-[#5A5A5A]'}`}>{column}</span>
                    </div>
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-2 text-xs text-[#858585]" title={sample}>
                    {sample || '—'}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={assigned}
                      onChange={e => onMappingChange({ ...mapping, [column]: e.target.value })}
                      className={`${selectClass} ${duplicated ? 'border-[#F59E0B]/50' : ''}`}
                    >
                      <option value="">Non importare</option>
                      {fields.map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                    {field?.hint && (
                      <p className="mt-1 text-[10px] text-[#3F3F3F]">{field.hint}</p>
                    )}
                    {duplicated && (
                      <p className="mt-1 text-[10px] text-[#F59E0B]">
                        Campo assegnato a più colonne: vince l’ultima con un valore.
                      </p>
                    )}
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
