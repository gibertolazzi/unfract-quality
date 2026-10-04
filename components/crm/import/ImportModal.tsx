'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { useMemo, useState } from 'react';
import { X, ArrowLeft, ArrowRight, Check, Undo2, AlertTriangle } from 'lucide-react';

import { parseFile, toTable, guessHeaderRow, ParsedFile, ParseError, Table } from '@/lib/crm/import/parse';
import { ImportEntity, ENTITY_LABELS, ColumnMapping, autoMap } from '@/lib/crm/import/mapping';
import {
  buildImportPlan, countPlan, ImportPlan, DuplicatePolicy, ExistingRecords,
} from '@/lib/crm/import/plan';
import type { ImportOptions, ImportOutcome, ImportProgress } from '@/lib/crm/import/run';

import { OwnerOption } from '../leads/LeadFiltersBar';
import { ImportDropzone } from './ImportDropzone';
import { ImportMapping } from './ImportMapping';
import { ImportReview } from './ImportReview';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

type Step = 'file' | 'mapping' | 'review' | 'result';

const STEPS: { key: Step; label: string }[] = [
  { key: 'file',    label: 'File' },
  { key: 'mapping', label: 'Colonne' },
  { key: 'review',  label: 'Verifica' },
  { key: 'result',  label: 'Esito' },
];

interface ImportModalProps {
  open: boolean;
  owners: OwnerOption[];
  defaultOwnerUid: string;
  /** Record già presenti nel progetto: servono a riconoscere i duplicati. */
  existing: ExistingRecords;
  /** Versione dell'informativa associata ai consensi dichiarati nel file. */
  policyVersion: string;
  onClose: () => void;
  /** Iniettate dalla pagina: il componente non parla con Firestore. */
  onRun: (
    plan: ImportPlan,
    options: ImportOptions,
    onProgress: (progress: ImportProgress) => void
  ) => Promise<ImportOutcome>;
  onRollback: (entity: ImportEntity, outcome: ImportOutcome) => Promise<number>;
}

/**
 * Importazione massiva in un'unica finestra: file, colonne, verifica, esito.
 * Resta sopra la pagina del CRM invece di aprire una sezione a parte, così la
 * lista sotto è già quella dove i record compaiono.
 */
export function ImportModal({
  open, owners, defaultOwnerUid, existing, policyVersion, onClose, onRun, onRollback,
}: ImportModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('file');

  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseErrorText, setParseErrorText] = useState('');
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);

  const [entity, setEntity] = useState<ImportEntity>('lead');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [touchedMapping, setTouchedMapping] = useState(false);

  const [policy, setPolicy] = useState<DuplicatePolicy>('skip');
  const [defaultSource, setDefaultSource] = useState('');
  const [ownerUid, setOwnerUid] = useState(defaultOwnerUid);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const [running, setRunning] = useState(false);

  useCloseOnEscape(onClose, !running);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [rolledBack, setRolledBack] = useState<number | null>(null);

  // --------------------------------------------------------------- dati

  const table: Table | null = useMemo(() => {
    const sheet = parsed?.sheets[sheetIndex];
    return sheet ? toTable(sheet, headerRow) : null;
  }, [parsed, sheetIndex, headerRow]);

  // La mappatura automatica si rifà a ogni cambio di file, foglio o entità,
  // ma non cancella le correzioni fatte a mano sulla stessa tabella.
  const effectiveMapping = useMemo(() => {
    if (!table) return {};
    if (touchedMapping && Object.keys(mapping).every(c => table.columns.includes(c))) return mapping;
    return autoMap(table.columns, entity);
  }, [table, entity, mapping, touchedMapping]);

  const plan: ImportPlan | null = useMemo(() => {
    if (!table) return null;
    const built = buildImportPlan({
      entity,
      rows: table.rows,
      mapping: effectiveMapping,
      existing,
    });
    return {
      ...built,
      rows: built.rows.map(row => ({ ...row, excluded: excluded.has(row.lineNumber) })),
    };
  }, [table, entity, effectiveMapping, existing, excluded]);

  const counts = useMemo(() => (plan ? countPlan(plan, policy) : null), [plan, policy]);

  // ------------------------------------------------------------- azioni

  const handleFile = async (file: File) => {
    setParsing(true);
    setParseErrorText('');
    try {
      const result = await parseFile(file);
      setParsed(result);
      setSheetIndex(0);
      setHeaderRow(guessHeaderRow(result.sheets[0].rows));
      setTouchedMapping(false);
      setExcluded(new Set());
      setOutcome(null);
    } catch (error) {
      setParsed(null);
      setParseErrorText(
        error instanceof ParseError ? error.message : 'Il file non è leggibile.'
      );
    } finally {
      setParsing(false);
    }
  };

  const handleRun = async () => {
    if (!plan || !parsed) return;
    setRunning(true);
    setProgress({ written: 0, total: counts?.importable || 0 });
    try {
      const result = await onRun(
        plan,
        { policy, defaultSource, ownerUid, policyVersion, fileName: parsed.fileName },
        setProgress
      );
      setOutcome(result);
      setStep('result');
    } finally {
      setRunning(false);
    }
  };

  const handleRollback = async () => {
    if (!outcome) return;
    setRunning(true);
    try {
      setRolledBack(await onRollback(entity, outcome));
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

  const canAdvance =
    step === 'file' ? !!table && table.rows.length > 0
    : step === 'mapping' ? Object.values(effectiveMapping).some(Boolean)
    : step === 'review' ? (counts?.importable || 0) > 0
    : false;

  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#1A1A1A] bg-[#0B0B0B]">
        <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-medium text-white">Importa da file</h2>
            <div className="hidden items-center gap-1.5 sm:flex">
              {STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                    i === stepIndex ? 'bg-white/10 text-white'
                    : i < stepIndex ? 'text-[#10B981]'
                    : 'text-[#3F3F3F]'
                  }`}
                >
                  {i + 1}. {s.label}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          {step === 'file' && (
            <ImportDropzone
              parsing={parsing}
              parsed={parsed}
              error={parseErrorText}
              sheetIndex={sheetIndex}
              headerRow={headerRow}
              onFile={handleFile}
              onSheetChange={index => {
                setSheetIndex(index);
                setHeaderRow(guessHeaderRow(parsed?.sheets[index].rows || []));
                setTouchedMapping(false);
              }}
              onHeaderRowChange={index => { setHeaderRow(index); setTouchedMapping(false); }}
            />
          )}

          {step === 'mapping' && table && (
            <ImportMapping
              table={table}
              entity={entity}
              mapping={effectiveMapping}
              onEntityChange={next => { setEntity(next); setTouchedMapping(false); }}
              onMappingChange={next => { setMapping(next); setTouchedMapping(true); }}
            />
          )}

          {step === 'review' && plan && counts && (
            <ImportReview
              plan={plan}
              counts={counts}
              policy={policy}
              defaultSource={defaultSource}
              ownerUid={ownerUid}
              owners={owners}
              entity={entity}
              excluded={excluded}
              onPolicyChange={setPolicy}
              onDefaultSourceChange={setDefaultSource}
              onOwnerChange={setOwnerUid}
              onToggleRow={lineNumber => {
                setExcluded(prev => {
                  const next = new Set(prev);
                  if (next.has(lineNumber)) next.delete(lineNumber);
                  else next.add(lineNumber);
                  return next;
                });
              }}
            />
          )}

          {step === 'result' && outcome && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Check size={18} className="text-[#10B981]" />
                <p className="text-sm text-white">
                  {outcome.created.length} {ENTITY_LABELS[entity].toLowerCase()} creati
                  {outcome.updated.length > 0 && `, ${outcome.updated.length} aggiornati`}
                  {outcome.skipped > 0 && `, ${outcome.skipped} saltati`}
                </p>
              </div>

              {outcome.failed.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2.5">
                  <p className="flex items-center gap-2 text-xs text-[#EF4444]">
                    <AlertTriangle size={13} /> {outcome.failed.length} righe non scritte
                  </p>
                  {Array.from(new Set(outcome.failed.map(f => f.reason))).slice(0, 3).map(reason => (
                    <p key={reason} className="text-[11px] text-[#EF4444]/80">{reason}</p>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5 rounded-xl border border-[#1A1A1A] bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Identificativo dell’importazione</p>
                <p className="font-mono text-xs text-white">{outcome.batchId}</p>
                <p className="text-[10px] text-[#5A5A5A]">
                  Scritto su ogni record importato: serve a ritrovarli tutti in seguito.
                  I record entrano come «da approvare», con origine «import».
                </p>
              </div>

              {rolledBack === null ? (
                outcome.created.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRollback}
                    disabled={running}
                    className="flex w-fit items-center gap-2 rounded-lg border border-[#1A1A1A] px-3 py-2 text-xs text-[#858585] transition-colors hover:border-[#EF4444]/40 hover:text-[#EF4444] disabled:opacity-50"
                  >
                    <Undo2 size={13} />
                    Annulla importazione
                  </button>
                )
              ) : (
                <p className="text-xs text-[#858585]">
                  {rolledBack} record archiviati.
                  {outcome.updated.length > 0 &&
                    ` I ${outcome.updated.length} record aggiornati restano com’erano dopo l’importazione: i valori precedenti non erano conservati.`}
                </p>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[#1A1A1A] px-6 py-4">
          <div className="text-[10px] text-[#5A5A5A]">
            {step === 'review' && counts && `${counts.importable} righe su ${counts.total} verranno scritte`}
            {step === 'file' && table && `${table.rows.length} righe di dati`}
            {running && progress && ` · scritte ${progress.written} di ${progress.total}`}
          </div>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && step !== 'result' && (
              <button
                type="button"
                onClick={() => setStep(STEPS[stepIndex - 1].key)}
                disabled={running}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-[#858585] hover:text-white disabled:opacity-50"
              >
                <ArrowLeft size={13} /> Indietro
              </button>
            )}

            {step === 'result' ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90"
              >
                Chiudi
              </button>
            ) : step === 'review' ? (
              <button
                type="button"
                onClick={handleRun}
                disabled={!canAdvance || running}
                className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {running ? 'Importazione…' : `Importa ${counts?.importable || 0} record`}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep(STEPS[stepIndex + 1].key)}
                disabled={!canAdvance}
                className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Avanti <ArrowRight size={13} />
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
