const fs = require('fs');
const path = 'components/crm/dashboard/RiepilogoSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `<Folders size={18} className="text-[#0D6EFD]" />`;
content = content.replace(target, '');

// also there's a space after, let's just make it clean
const fullTarget = `        <div className="flex items-center gap-2 mb-4">
          
          <h2 className="text-lg font-medium text-white">Documentazione</h2>
        </div>`;
const cleanReplacement = `        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-medium text-white">Documentazione</h2>
        </div>`;

content = content.replace(fullTarget, cleanReplacement);

fs.writeFileSync(path, content);
