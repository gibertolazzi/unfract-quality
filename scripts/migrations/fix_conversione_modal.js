const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/conversione/ConversionModal.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `              ) : (
                <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">
                  Verrà creato un cliente nuovo, collegato all’azienda scelta e con questo lead
                  come origine.
                </p>
              )}`;

const replacement = `              ) : (
                <>
                  <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">
                    Verrà creato un cliente nuovo, collegato all’azienda scelta e con questo lead
                    come origine.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-1">
                    <Field label="Mensile (€)">
                      <input type="number" min="0" step="0.01" value={proposal.monthlyAmount || ''} onChange={e => set({ monthlyAmount: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                    </Field>
                    <Field label="Annuale (€)">
                      <input type="number" min="0" step="0.01" value={proposal.annualAmount || ''} onChange={e => set({ annualAmount: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                    </Field>
                    <Field label="Una tantum (€)">
                      <input type="number" min="0" step="0.01" value={proposal.oneTimeAmount || ''} onChange={e => set({ oneTimeAmount: parseFloat(e.target.value) || 0 })} className={inputClass} placeholder="0.00" />
                    </Field>
                  </div>
                </>
              )}`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
