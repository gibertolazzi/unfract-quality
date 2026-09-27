const fs = require('fs');
const path = 'app/(authenticated)/marketing/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
if (!content.includes('CampaignChannelModal')) {
  content = content.replace(
    "import { useState } from 'react';",
    "import { useState } from 'react';\nimport { CampaignChannelModal } from '@/components/marketing/CampaignChannelModal';"
  );
}

// 2. Add state
if (!content.includes('showChannelModal')) {
  content = content.replace(
    "const [isCreating, setIsCreating] = useState(false);",
    "const [isCreating, setIsCreating] = useState(false);\n  const [showChannelModal, setShowChannelModal] = useState(false);"
  );
}

// 3. Change button onClick
const oldButton = `        <button 
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
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm disabled:opacity-50"
        >`;

const newButton = `        <button 
          onClick={() => {
            if (!activeProjectId || isCreating) return;
            setShowChannelModal(true);
          }}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm disabled:opacity-50"
        >`;

content = content.replace(oldButton, newButton);

// 4. Add the modal and the creation function
const oldEnd = `    </div>
  );
}`;

const newEnd = `      <CampaignChannelModal 
        open={showChannelModal}
        onClose={() => setShowChannelModal(false)}
        onConfirm={async (channel) => {
          if (!activeProjectId) return;
          setShowChannelModal(false);
          setIsCreating(true);
          try {
            // For now only email is active, but we can pass channel if needed to backend
            const id = await createCampaign(activeProjectId, 'Nuova Campagna');
            router.push(\`/marketing/campaigns/\${id}\`);
          } catch(e) {
            setIsCreating(false);
          }
        }}
      />
    </div>
  );
}`;

content = content.replace(oldEnd, newEnd);

fs.writeFileSync(path, content);
