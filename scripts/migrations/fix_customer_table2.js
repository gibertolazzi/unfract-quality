const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/CustomerTable.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">`;

const replacement = `                  <td className="px-4 py-3 text-right text-xs text-[#C4C4C4]">
                    {formatEuro(((customer.monthlyAmount || 0) * 12) + (customer.annualAmount || 0) + (customer.oneTimeAmount || 0))}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">`;

content = content.replace(target, replacement);

fs.writeFileSync(path, content, 'utf8');
