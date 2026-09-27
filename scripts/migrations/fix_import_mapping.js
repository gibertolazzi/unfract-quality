const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/crm/import/mapping.ts';
let content = fs.readFileSync(path, 'utf8');

const addressTargetFields = `    { key: 'address',     label: 'Indirizzo',       type: 'text',     aliases: ['indirizzo', 'address', 'via', 'sede'] },
    { key: 'city',        label: 'Città',           type: 'text',     aliases: ['citta', 'comune', 'city', 'localita'] },
    { key: 'postalCode',  label: 'CAP',             type: 'text',     aliases: ['cap', 'codice postale', 'postal code', 'zip'] },
    { key: 'country',     label: 'Paese',           type: 'text',     aliases: ['paese', 'nazione', 'country', 'stato'] },`;

// Insert into lead target fields
content = content.replace(
  '{ key: \'source\',         label: \'Fonte\',',
  addressTargetFields + '\n    { key: \'source\',         label: \'Fonte\','
);

// Insert into contact target fields
content = content.replace(
  '{ key: \'role\',         label: \'Ruolo\',',
  addressTargetFields + '\n    { key: \'role\',         label: \'Ruolo\','
);

fs.writeFileSync(path, content, 'utf8');
