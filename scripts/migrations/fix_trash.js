const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  "import { Search, PlusCircle } from 'lucide-react';",
  "import { Search, PlusCircle, Trash2 } from 'lucide-react';"
);

fs.writeFileSync(path, content, 'utf8');
