const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/CustomerFormModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update CustomerFormValues
content = content.replace(
  "  privateNotes: string;\n}",
  "  privateNotes: string;\n  monthlyAmount: number;\n  annualAmount: number;\n  oneTimeAmount: number;\n}"
);

// Update initial values
content = content.replace(
  "    privateNotes: customer?.privateNotes || '',\n  }));",
  "    privateNotes: customer?.privateNotes || '',\n    monthlyAmount: customer?.monthlyAmount || 0,\n    annualAmount: customer?.annualAmount || 0,\n    oneTimeAmount: customer?.oneTimeAmount || 0,\n  }));"
);

// Add fields to form UI
const insertionPoint = `<label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Note</span>`;
const newFields = `<div className="grid grid-cols-3 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Mensile (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.monthlyAmount || ''}
                onChange={e => set({ monthlyAmount: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Annuale (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.annualAmount || ''}
                onChange={e => set({ annualAmount: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Una tantum (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.oneTimeAmount || ''}
                onChange={e => set({ oneTimeAmount: parseFloat(e.target.value) || 0 })}
                className={inputClass}
                placeholder="0.00"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A]">Note</span>`;

content = content.replace(insertionPoint, newFields);

fs.writeFileSync(path, content, 'utf8');
