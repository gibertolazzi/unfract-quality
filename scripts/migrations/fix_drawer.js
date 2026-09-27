const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add onQuickFollowup prop
content = content.replace(
  'onUploadDocument: (target: DocumentTarget) => UploadRunner;\n}',
  'onUploadDocument: (target: DocumentTarget) => UploadRunner;\n  onQuickFollowup?: (days: number) => void;\n}'
);

content = content.replace(
  '  onCompose, onUploadDocument,\n}: RecordDrawerProps) {',
  '  onCompose, onUploadDocument, onQuickFollowup,\n}: RecordDrawerProps) {'
);

// Add the Quick Followup buttons under the header inside the scrollable area
const buttonsTarget = `          {record.archived && (
            <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">`;

const buttonsReplacement = `          {onQuickFollowup && !record.archived && (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#1A1A1A] bg-[#0F0F0F] px-4 py-3">
              <CalendarClock size={14} className="text-[#00A6FF]" />
              <span className="text-xs text-[#E5E5E5] mr-2">Prossimo follow-up:</span>
              <button type="button" onClick={() => onQuickFollowup(1)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Domani</button>
              <button type="button" onClick={() => onQuickFollowup(3)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 3 giorni</button>
              <button type="button" onClick={() => onQuickFollowup(7)} className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[11px] text-white transition-colors">Tra 1 settimana</button>
            </div>
          )}

          {record.archived && (
            <p className="rounded-xl border border-[#1A1A1A] bg-black/20 px-3 py-2 text-[11px] text-[#858585]">`;

content = content.replace(buttonsTarget, buttonsReplacement);
fs.writeFileSync(path, content, 'utf8');
