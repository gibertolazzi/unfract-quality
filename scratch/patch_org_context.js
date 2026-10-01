const fs = require('fs');

let content = fs.readFileSync('contexts/OrganizationContext.tsx', 'utf-8');

// Replace the query logic with OrganizationService
content = content.replace(/import \{ collection, query, getDocs, onSnapshot, where \} from 'firebase\/firestore';/,
  "import { OrganizationService } from '@/lib/services/organizationService';");

content = content.replace(/const orgsRef = collection\(db, 'organizations'\);\n\s*const q = query\(orgsRef, where\('memberUids', 'array-contains', user\.uid\)\);\n\n\s*const unsubscribe = onSnapshot\(q, \(snapshot\) => \{\n\s*const fetchedOrgs: Organization\[\] = \[\];\n\s*snapshot\.forEach\(doc => \{\n\s*fetchedOrgs\.push\(\{ id: doc\.id, \.\.\.doc\.data\(\) \} as Organization\);\n\s*\}\);\n\s*setOrganizations\(fetchedOrgs\);\n\s*setLoading\(false\);\n\s*\}, \(error\) => \{\n\s*console\.error\("Error fetching organizations:", error\);\n\s*setLoading\(false\);\n\s*\}\);/,
  `const unsubscribe = OrganizationService.subscribe(user.uid, (fetchedOrgs) => {
      setOrganizations(fetchedOrgs);
      setLoading(false);
    });`);

fs.writeFileSync('contexts/OrganizationContext.tsx', content);
