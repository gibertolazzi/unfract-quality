const fs = require('fs');
const pathSection = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
const pathTable = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedTable.tsx';

// 1. Add `value` to UnifiedRecord type
let tableContent = fs.readFileSync(pathTable, 'utf8');
tableContent = tableContent.replace(
  '  status: string;\n  raw: any;',
  '  status: string;\n  value?: number;\n  raw: any;'
);

// 2. Add header and column
tableContent = tableContent.replace(
  '<th className={thClass}>Stato / Info</th>',
  '<th className={thClass}>Stato / Info</th>\n            <th className={thClass}>Valore</th>'
);
tableContent = tableContent.replace(
  '<td className={tdClass}>{record.status}</td>',
  '<td className={tdClass}>{record.status}</td>\n                <td className={tdClass}>{record.value ? new Intl.NumberFormat(\'it-IT\', { style: \'currency\', currency: \'EUR\' }).format(record.value) : \'—\'}</td>'
);
tableContent = tableContent.replace(
  '<td colSpan={7}',
  '<td colSpan={8}'
);

fs.writeFileSync(pathTable, tableContent, 'utf8');

// 3. Populate `value` in UnifiedContactsSection
let sectionContent = fs.readFileSync(pathSection, 'utf8');
sectionContent = sectionContent.replace(
  '...props.customers.filter(c => !c.archived).map(c => ({ id: c.id, type: \'customer\' as const, name: indexes.accountNameById.get(c.accountId) || \'\', email: \'\', phone: \'\', companyName: indexes.accountNameById.get(c.accountId) || \'\', status: CUSTOMER_STATUS_LABELS[c.status] || c.status, raw: c })),',
  '...props.customers.filter(c => !c.archived).map(c => ({ id: c.id, type: \'customer\' as const, name: indexes.accountNameById.get(c.accountId) || \'\', email: \'\', phone: \'\', companyName: indexes.accountNameById.get(c.accountId) || \'\', status: CUSTOMER_STATUS_LABELS[c.status] || c.status, value: ((c.monthlyAmount || 0) * 12) + (c.annualAmount || 0) + (c.oneTimeAmount || 0), raw: c })),'
);

fs.writeFileSync(pathSection, sectionContent, 'utf8');
