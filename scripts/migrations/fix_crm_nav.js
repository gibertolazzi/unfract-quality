const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `      <CrmNav
        active={tab}
        onChange={setTab}
        counts={{
          contact: contacts.filter(c => !c.archived).length,
          opportunity: opportunities.filter(o => !o.archived).length,
        }}
      />`;

const replacement = `      <CrmNav
        active={tab}
        onChange={setTab}
        counts={{
          contact: 
            contacts.filter(c => !c.archived).length + 
            leads.filter(l => !l.archived).length + 
            accounts.filter(a => !a.archived).length + 
            customers.filter(c => !c.archived).length,
          opportunity: opportunities.filter(o => !o.archived).length,
        }}
      />`;

content = content.replace(target, replacement);

fs.writeFileSync(path, content, 'utf8');
