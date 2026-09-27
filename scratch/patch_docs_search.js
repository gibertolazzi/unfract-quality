const fs = require('fs');
const path = 'components/crm/documenti/DocumentiSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldSearch = `            placeholder="Cerca per nome file o etichetta"
            className={\`\${inputClass} w-full pl-8\`}
          />`;
const newSearch = `            placeholder="Cerca per nome file o etichetta"
            className="w-full rounded-full border border-[#1A1A1A] bg-black/30 py-1.5 pl-8 pr-4 text-xs text-white placeholder:text-[#5A5A5A] focus:border-[#2A2A2A] focus:outline-none"
          />`;

if (content.includes(oldSearch)) {
    content = content.replace(oldSearch, newSearch);
} else {
    console.log("Could not find search bar in DocumentiSection");
}

fs.writeFileSync(path, content);
