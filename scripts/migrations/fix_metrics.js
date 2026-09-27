const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/CrmKpiBar.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  '<Metric label="Contatti" value={String(live(contacts).length)} increment={calculateIncrement(live(contacts))} />',
  `<Metric label="Lead" value={String(live(leads).length)} increment={calculateIncrement(live(leads))} />
          <Metric label="Contatti" value={String(live(contacts).length)} increment={calculateIncrement(live(contacts))} />`
);

fs.writeFileSync(path, content, 'utf8');
