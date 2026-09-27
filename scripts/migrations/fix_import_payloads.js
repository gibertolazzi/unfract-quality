const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/crm/import/run.ts';
let content = fs.readFileSync(path, 'utf8');

const addressValues = `    address: values.address || '',
    city: values.city || '',
    postalCode: values.postalCode || '',
    country: values.country || 'IT',`;

// In leadPayload
content = content.replace(
  'phoneNormalized: normalizePhone(phone),',
  'phoneNormalized: normalizePhone(phone),\n' + addressValues
);

// In contactPayload
content = content.replace(
  'phoneNormalized: normalizePhone(phone),',
  'phoneNormalized: normalizePhone(phone),\n' + addressValues
);

fs.writeFileSync(path, content, 'utf8');
