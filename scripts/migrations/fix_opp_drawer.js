const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'onArchive: () => void;\n  onRestore: () => void;\n}',
  'onArchive: () => void;\n  onRestore: () => void;\n  onQuickFollowup?: (days: number) => void;\n}'
);

content = content.replace(
  '  onChangePhase, onArchive, onRestore,\n}: OpportunityDrawerProps) {',
  '  onChangePhase, onArchive, onRestore, onQuickFollowup,\n}: OpportunityDrawerProps) {'
);

const buttonTarget = `<div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">`;
const buttonReplacement = `<div className="flex flex-col gap-6 overflow-y-auto px-5 py-5">
          {onQuickFollowup && !opportunity.archived && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#1A1A1A] bg-[#0F0F0F] px-4 py-3">
              <CalendarClock size={14} className="text-[#00A6FF]" />
              <span className="text-xs text-[#E5E5E5] mr-2">Prossimo follow-up:</span>
              <button type="button" onClick={() => onQuickFollowup(1)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Domani</button>
              <button type="button" onClick={() => onQuickFollowup(3)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 3 giorni</button>
              <button type="button" onClick={() => onQuickFollowup(7)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 settimana</button>
            </div>
          )}`;

content = content.replace(buttonTarget, buttonReplacement);
fs.writeFileSync(path, content, 'utf8');
