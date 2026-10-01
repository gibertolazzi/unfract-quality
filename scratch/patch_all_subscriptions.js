const fs = require('fs');
const path = 'contexts/CrmContext.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `      subscribeToLeads(activeProjectId, setLeads),
      subscribeToAccounts(activeProjectId, setAccounts),
      subscribeToContacts(activeProjectId, setContacts),
      subscribeToCustomers(activeProjectId, setCustomers),
      subscribeToOpportunities(activeProjectId, setOpportunities),
      subscribeToFollowups(activeProjectId, setFollowups, true),`;

const replacement = `      subscribeToLeads(activeProjectId, setLeads, true),
      subscribeToAccounts(activeProjectId, setAccounts, true),
      subscribeToContacts(activeProjectId, setContacts, true),
      subscribeToCustomers(activeProjectId, setCustomers, true),
      subscribeToOpportunities(activeProjectId, setOpportunities, true),
      subscribeToFollowups(activeProjectId, setFollowups, true),`;

content = content.replace(target, replacement);

fs.writeFileSync(path, content);
