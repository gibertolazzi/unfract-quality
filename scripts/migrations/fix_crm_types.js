const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/types.ts';
let content = fs.readFileSync(path, 'utf8');

// Update CrmLead
content = content.replace(/phoneNormalized: string;\n\n  companyName: string;/, "phoneNormalized: string;\n\n  address?: string;\n  city?: string;\n  postalCode?: string;\n  country?: string;\n\n  companyName: string;");

// Update CrmContact
content = content.replace(/phoneNormalized: string;\n\n  accountId: string;/, "phoneNormalized: string;\n\n  address?: string;\n  city?: string;\n  postalCode?: string;\n  country?: string;\n\n  accountId: string;");

fs.writeFileSync(path, content, 'utf8');
