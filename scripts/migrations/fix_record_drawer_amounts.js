const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `<Row label="Cliente dal">{formatDate(customer.customerSince)}</Row>`;
const replacement = `<Row label="Cliente dal">{formatDate(customer.customerSince)}</Row>
                  {(customer.monthlyAmount || 0) > 0 && <Row label="Mensile">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(customer.monthlyAmount!)}</Row>}
                  {(customer.annualAmount || 0) > 0 && <Row label="Annuale">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(customer.annualAmount!)}</Row>}
                  {(customer.oneTimeAmount || 0) > 0 && <Row label="Una tantum">{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(customer.oneTimeAmount!)}</Row>}`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
