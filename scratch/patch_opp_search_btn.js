const fs = require('fs');
const path = 'components/crm/opportunita/OpportunitySection.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace search bar input class
const oldSearch = `            placeholder="Cerca per titolo, controparte, voce…"
            className={\`\${inputClass} w-full pl-8\`}
          />`;
const newSearch = `            placeholder="Cerca per titolo, controparte, voce…"
            className="w-full rounded-full border border-[#1A1A1A] bg-black/30 py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"
          />`;

if (content.includes(oldSearch)) {
    content = content.replace(oldSearch, newSearch);
} else {
    console.log("Could not find search bar in OpportunitySection");
}

// Remove new opportunity button
const oldButton = `        <button
          type="button"
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-medium text-black transition-opacity hover:opacity-90"
        >
          <Plus size={14} />
          Nuova opportunità
        </button>`;

if (content.includes(oldButton)) {
    content = content.replace(oldButton, '');
} else {
    console.log("Could not find button in OpportunitySection");
}

fs.writeFileSync(path, content);
