const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityFormModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add phase to values
content = content.replace(
  '  ownerUid: string;\n  value: number;\n  probability: number | null;',
  '  ownerUid: string;\n  value: number;\n  probability: number | null;\n  phase: OpportunityPhase;'
);

// 2. Import OpportunityPhase
content = content.replace(
  'import { OPPORTUNITY_PHASE_PROBABILITY } from \'@/components/unfract/crm/constants\';',
  'import { OPPORTUNITY_PHASE_PROBABILITY, OpportunityPhase, OPPORTUNITY_PHASES, OPPORTUNITY_PHASE_LABELS } from \'@/components/unfract/crm/constants\';'
);

// 3. Update initial state
content = content.replace(
  '    probability: opportunity?.probability ?? null,\n    expectedCloseDate: opportunity?.expectedCloseDate || \'\',',
  '    probability: opportunity?.probability ?? null,\n    phase: opportunity?.phase || \'QUALIFICATION\',\n    expectedCloseDate: opportunity?.expectedCloseDate || \'\','
);

// 4. Add UI field
const fieldTarget = `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Valore base (€)" hint="Valore stimato se non ci sono singole voci">`;
const fieldReplacement = `<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fase">
              <select
                value={values.phase}
                onChange={e => set({ phase: e.target.value as OpportunityPhase })}
                className={inputClass}
              >
                {OPPORTUNITY_PHASES.map(phase => (
                  <option key={phase} value={phase}>{OPPORTUNITY_PHASE_LABELS[phase]}</option>
                ))}
              </select>
            </Field>
            <div className="hidden sm:block" />

            <Field label="Valore base (€)" hint="Valore stimato se non ci sono singole voci">`;

content = content.replace(fieldTarget, fieldReplacement);
fs.writeFileSync(path, content, 'utf8');
