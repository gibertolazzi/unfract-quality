const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityBoard.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `<div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-white">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: OPPORTUNITY_PHASE_COLORS[column.phase] }}
                    />
                    {OPPORTUNITY_PHASE_LABELS[column.phase]}
                  </span>
                  <span className="text-[11px] text-[#5A5A5A]">{column.count}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-[#C4C4C4]">{formatEuro(column.value)}</span>
                  <span className="text-[10px] text-[#3F3F3F]" title="Somma dei valori ponderati">
                    {formatEuro(column.weighted)}
                  </span>
                </div>`;

const replacement = `<div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-white">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: OPPORTUNITY_PHASE_COLORS[column.phase] }}
                    />
                    {OPPORTUNITY_PHASE_LABELS[column.phase]}
                  </span>
                  <span className="text-[11px] font-medium text-[#C4C4C4]">
                    {formatEuro(column.value)} ({column.count})
                  </span>
                </div>`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
