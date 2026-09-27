const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/crm/opportunityFilters.ts';
let content = fs.readFileSync(path, 'utf8');

// Set includeClosed to true by default
content = content.replace(
  '  includeArchived: false,\n  includeClosed: false,\n};',
  '  includeArchived: false,\n  includeClosed: true,\n};'
);

// We should also remove the strict "return false" line just to be safe, but making it true is enough.
content = content.replace(
  'if (!filters.includeClosed && !isOpen(opportunity) && filters.phases.length === 0) return false;',
  'if (!filters.includeClosed && !isOpen(opportunity) && !filters.phases.includes(opportunity.phase)) return false;'
);

fs.writeFileSync(path, content, 'utf8');
