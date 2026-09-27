const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/types.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "  status: 'active' | 'inactive' | 'suspended';",
  "  status: 'active' | 'inactive' | 'suspended';\n\n  monthlyAmount?: number;\n  annualAmount?: number;\n  oneTimeAmount?: number;\n"
);

fs.writeFileSync(path, content, 'utf8');
