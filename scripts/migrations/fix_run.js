const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/crm/import/run.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /    address: values\.address \|\| '',\n    city: values\.city \|\| '',\n    postalCode: values\.postalCode \|\| '',\n    country: values\.country \|\| 'IT',\n    address: values\.address \|\| '',\n    city: values\.city \|\| '',\n    postalCode: values\.postalCode \|\| '',\n    country: values\.country \|\| 'IT',/g,
  `    address: values.address || '',
    city: values.city || '',
    postalCode: values.postalCode || '',
    country: values.country || 'IT',`
);

fs.writeFileSync(path, content, 'utf8');
