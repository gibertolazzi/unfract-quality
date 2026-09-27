const fs = require('fs');
const path = 'contexts/CrmContext.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'subscribeToFollowups(activeProjectId, setFollowups)',
  'subscribeToFollowups(activeProjectId, setFollowups, true)'
);

fs.writeFileSync(path, content);
