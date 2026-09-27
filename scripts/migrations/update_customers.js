const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/crm/customers.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "    status: data.status || 'active',",
  "    status: data.status || 'active',\n    monthlyAmount: data.monthlyAmount || 0,\n    annualAmount: data.annualAmount || 0,\n    oneTimeAmount: data.oneTimeAmount || 0,"
);

fs.writeFileSync(path, content, 'utf8');
