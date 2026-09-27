const fs = require('fs');
const path = require('path');

const dirs = [
  'components/crm',
  'components/crm/leads',
  'components/crm/contatti',
  'components/crm/anagrafica',
  'components/crm/opportunita',
  'components/crm/followup',
  'components/crm/documenti',
  'components/crm/import',
  'components/crm/email',
  'components/crm/conversione',
  'components/crm/ricerca',
  'components/crm/dashboard',
  'components/crm/timeline',
  'components/crm/shared',
  'components/calendar',
  'components/tasks',
  'components/meetings',
  'components/dashboard',
  'components/documentation',
  'components/auth',
  'components/chat',
  'components/layout',
  'components/organization',
  'components/shared'
];

dirs.forEach(dir => {
  const fullDir = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const exportsLines = [];

  files.forEach(file => {
    if (file === 'index.ts') return;
    const content = fs.readFileSync(path.join(fullDir, file), 'utf-8');
    const nameWithoutExt = file.replace(/\.tsx?$/, '');

    // Match each type of export separately
    const valueRegex = /export\s+(?:default\s+)?(?:function|const|class)\s+([a-zA-Z0-9_]+)/g;
    const typeRegex = /export\s+(?:interface|type)\s+([a-zA-Z0-9_]+)/g;
    
    let match;
    const valueNames = [];
    while ((match = valueRegex.exec(content)) !== null) {
      valueNames.push(match[1]);
    }
    const typeNames = [];
    while ((match = typeRegex.exec(content)) !== null) {
      typeNames.push(match[1]);
    }

    if (valueNames.length > 0) {
      const uniqueVals = [...new Set(valueNames)];
      exportsLines.push(`export { ${uniqueVals.join(', ')} } from './${nameWithoutExt}';`);
    }
    if (typeNames.length > 0) {
      const uniqueTypes = [...new Set(typeNames)];
      exportsLines.push(`export type { ${uniqueTypes.join(', ')} } from './${nameWithoutExt}';`);
    }
  });

  if (exportsLines.length > 0) {
    fs.writeFileSync(path.join(fullDir, 'index.ts'), exportsLines.join('\n') + '\n');
    console.log(`Generated index.ts for ${dir}`);
  }
});
