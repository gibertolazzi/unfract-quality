const fs = require('fs');
const path = 'app/(authenticated)/marketing/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const imports = `import { useState } from 'react';
import { CampaignChannelModal } from '@/components/marketing/CampaignChannelModal';
import { MarketingSettingsView } from '@/components/marketing/MarketingSettingsView';
import { Settings } from 'lucide-react';`;

content = content.replace(
  "import { useState } from 'react';\nimport { CampaignChannelModal } from '@/components/marketing/CampaignChannelModal';",
  imports
);

const stateInit = `  const [isCreating, setIsCreating] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'models' | 'stats' | 'settings'>('campaigns');
  const { activeProjectId } = useProject();`;

content = content.replace(
  `  const [isCreating, setIsCreating] = useState(false);\n  const [showChannelModal, setShowChannelModal] = useState(false);\n  const { activeProjectId } = useProject();`,
  stateInit
);

const navBlock = `        <nav className="flex items-center gap-2">
          <button 
            onClick={() => setActiveTab('campaigns')}
            className={\`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium \${activeTab === 'campaigns' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}\`}
          >
            <MegaphoneIcon size={16} />
            Campaigns
          </button>
          <button 
            onClick={() => setActiveTab('models')}
            className={\`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium \${activeTab === 'models' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}\`}
          >
            <Archive size={16} />
            Models
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={\`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium \${activeTab === 'stats' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}\`}
          >
            <TrendingUp size={16} />
            Stats
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={\`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium \${activeTab === 'settings' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}\`}
          >
            <Settings size={16} />
            Impostazioni
          </button>
        </nav>`;

content = content.replace(
  /<nav className="flex items-center gap-2">[\s\S]*?<\/nav>/,
  navBlock
);

const contentBlock = `      {/* Content Area */}
      {activeTab === 'campaigns' && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center pb-24">
          <img 
            src="/unfractvoidbox.png" 
            alt="No campaigns" 
            className="w-72 h-auto mb-6"
          />
          <h2 className="text-[24px] font-semibold text-white mb-2">
            You haven't created any campaign!
          </h2>
          <p className="text-[#858585] text-[15px] text-center max-w-sm leading-relaxed">
            Click on "Create campaign" and start designing your first marketing campaign.
          </p>
        </div>
      )}
      
      {activeTab === 'settings' && (
        <MarketingSettingsView projectId={activeProjectId} />
      )}`;

content = content.replace(
  /<div className="relative z-10 flex-1 flex flex-col items-center justify-center pb-24">[\s\S]*?<\/div>/,
  contentBlock
);

fs.writeFileSync(path, content);
