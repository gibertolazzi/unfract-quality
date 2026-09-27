const fs = require('fs');

const contactsPath = '/Users/giacomobertolazzi/unfractmvp/lib/crm/contacts.ts';
let contacts = fs.readFileSync(contactsPath, 'utf8');

// In CreateContactInput
contacts = contacts.replace(
  'phone?: string;',
  'phone?: string;\n  address?: string;\n  city?: string;\n  postalCode?: string;\n  country?: string;'
);

// In createContact
contacts = contacts.replace(
  'phoneNormalized: normalizePhone(phone),',
  'phoneNormalized: normalizePhone(phone),\n    address: input.address || \'\',\n    city: input.city || \'\',\n    postalCode: input.postalCode || \'\',\n    country: input.country || \'\','
);

// In mapContact
contacts = contacts.replace(
  'phoneNormalized: data.phoneNormalized || \'\',',
  'phoneNormalized: data.phoneNormalized || \'\',\n    address: data.address || \'\',\n    city: data.city || \'\',\n    postalCode: data.postalCode || \'\',\n    country: data.country || \'\','
);

fs.writeFileSync(contactsPath, contacts, 'utf8');

const leadsPath = '/Users/giacomobertolazzi/unfractmvp/lib/crm/leads.ts';
let leads = fs.readFileSync(leadsPath, 'utf8');

// In CreateLeadInput
leads = leads.replace(
  'phone?: string;',
  'phone?: string;\n  address?: string;\n  city?: string;\n  postalCode?: string;\n  country?: string;'
);

// In createLead
leads = leads.replace(
  'phoneNormalized: normalizePhone(phone),',
  'phoneNormalized: normalizePhone(phone),\n    address: input.address || \'\',\n    city: input.city || \'\',\n    postalCode: input.postalCode || \'\',\n    country: input.country || \'\','
);

// In mapLead
leads = leads.replace(
  'phoneNormalized: data.phoneNormalized || \'\',',
  'phoneNormalized: data.phoneNormalized || \'\',\n    address: data.address || \'\',\n    city: data.city || \'\',\n    postalCode: data.postalCode || \'\',\n    country: data.country || \'\','
);

fs.writeFileSync(leadsPath, leads, 'utf8');
