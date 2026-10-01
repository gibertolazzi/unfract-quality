const fs = require('fs');
const path = 'components/crm/followup/FollowupSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const archiviatiButton = `        <button
          type="button"
          onClick={() => set({ includeArchived: !filters.includeArchived })}
          className={\`rounded-lg border px-3 py-2 text-xs transition-colors \${
            filters.includeArchived ? 'border-white/30 bg-white/10 text-white' : 'border-[#1A1A1A] text-[#858585] hover:text-white'
          }\`}
        >
          Archiviati
        </button>`;

if (content.includes(archiviatiButton)) {
    content = content.replace(archiviatiButton, '');
} else {
    console.log("Could not find Archiviati button");
}

fs.writeFileSync(path, content);
