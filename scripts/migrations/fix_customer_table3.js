const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/CustomerTable.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('formatEuro')) {
  content = content.replace(
    "import { ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate, Pill } from '../shared/table';",
    "import { ColumnDef, SortableHeaders, Pagination, EmptyState, formatDate, Pill, formatEuro } from '../shared/table';"
  );
}

fs.writeFileSync(path, content, 'utf8');
