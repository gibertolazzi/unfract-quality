const fs = require('fs');
const filePath = 'app/(authenticated)/marketing/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const importRegex = /import \{ Archive, TrendingUp, PlusCircle \} from 'lucide-react';/;
content = content.replace(importRegex, `import { Archive, TrendingUp, PlusCircle } from 'lucide-react';\nimport { createCampaign } from '@/lib/services/marketingService';\nimport { useRouter } from 'next/navigation';\nimport { useState } from 'react';`);

const componentRegex = /export default function MarketingPage\(\) \{/;
content = content.replace(componentRegex, `export default function MarketingPage() {\n  const router = useRouter();\n  const [isCreating, setIsCreating] = useState(false);`);

const btnRegex = /<button className="h-\[46px\] px-5 bg-\[#002451\] border border-\[#003B80\] text-\[#00A6FF\] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-\[#003B80\]\/80 text-\[14px\]">\n\s*<PlusCircle size=\{18\} className="text-\[#00A6FF\]" \/>\n\s*New Campaign\n\s*<\/button>/;
const newBtn = `<button 
          onClick={async () => {
            if (!activeProjectId || isCreating) return;
            setIsCreating(true);
            try {
              const id = await createCampaign(activeProjectId, 'Nuova Campagna');
              router.push(\`/marketing/campaigns/\${id}\`);
            } catch(e) {
              setIsCreating(false);
            }
          }}
          disabled={isCreating}
          className="h-[46px] px-5 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-[#003B80]/80 text-[14px] disabled:opacity-50"
        >
          <PlusCircle size={18} className="text-[#00A6FF]" />
          {isCreating ? 'Creazione...' : 'New Campaign'}
        </button>`;
content = content.replace(btnRegex, newBtn);

fs.writeFileSync(filePath, content);
