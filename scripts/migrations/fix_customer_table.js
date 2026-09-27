const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/CustomerTable.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add formatEuro import if missing
if (!content.includes('formatEuro')) {
  content = content.replace(
    'import { SortableHeaders, ColumnDef } from \'../shared/table\';',
    'import { SortableHeaders, ColumnDef, formatEuro } from \'../shared/table\';'
  );
}

// Add Valore column
content = content.replace(
  '<th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">\n                Referenti\n              </th>',
  '<th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">\n                Referenti\n              </th>\n              <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-wide text-[#5A5A5A]">\n                Valore\n              </th>'
);

// Render Valore column
content = content.replace(
  '<td className="px-4 py-3 text-right text-xs text-[#858585]">{customer.contactIds.length}</td>\n                <td className="px-2 py-3">',
  '<td className="px-4 py-3 text-right text-xs text-[#858585]">{customer.contactIds.length}</td>\n                <td className="px-4 py-3 text-right text-xs text-[#C4C4C4]">{formatEuro((customer.monthlyAmount || 0)*12 + (customer.annualAmount || 0) + (customer.oneTimeAmount || 0))}</td>\n                <td className="px-2 py-3">'
);

fs.writeFileSync(path, content, 'utf8');
