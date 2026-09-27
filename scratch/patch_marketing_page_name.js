const fs = require('fs');
const path = 'app/(authenticated)/marketing/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldConfirm = `        onConfirm={async (channel) => {
          if (!activeProjectId) return;
          setShowChannelModal(false);
          setIsCreating(true);
          try {
            // For now only email is active, but we can pass channel if needed to backend
            const id = await createCampaign(activeProjectId, 'Nuova Campagna');`;

const newConfirm = `        onConfirm={async (channel, name) => {
          if (!activeProjectId) return;
          setShowChannelModal(false);
          setIsCreating(true);
          try {
            const id = await createCampaign(activeProjectId, name);`;

content = content.replace(oldConfirm, newConfirm);

fs.writeFileSync(path, content);
