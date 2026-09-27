const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedTable.tsx';
let content = fs.readFileSync(path, 'utf8');

// Update props
content = content.replace(
  'interface UnifiedTableProps {\n  records: UnifiedRecord[];\n  onOpen: (record: UnifiedRecord) => void;\n}',
  'interface UnifiedTableProps {\n  records: UnifiedRecord[];\n  onOpen: (record: UnifiedRecord) => void;\n  selectedIds: string[];\n  onSelect: (id: string, selected: boolean) => void;\n  onSelectAll: (selected: boolean) => void;\n}'
);

content = content.replace(
  'export function UnifiedTable({ records, onOpen }: UnifiedTableProps) {',
  'export function UnifiedTable({ records, onOpen, selectedIds, onSelect, onSelectAll }: UnifiedTableProps) {\n  const allSelected = records.length > 0 && records.every(r => selectedIds.includes(r.id));'
);

// Add TH for checkbox
content = content.replace(
  '<th className={thClass}>Nome</th>',
  `<th className={thClass} style={{ width: '40px' }}>
              <input 
                type="checkbox" 
                checked={allSelected}
                onChange={e => onSelectAll(e.target.checked)}
                className="accent-white cursor-pointer"
              />
            </th>
            <th className={thClass}>Nome</th>`
);

// Add colSpan adjustment for Empty state
content = content.replace(
  'colSpan={6}',
  'colSpan={7}'
);

// Add TD for checkbox
content = content.replace(
  '<td className={`${tdClass} font-medium text-white`}>{record.name}</td>',
  `<td className={tdClass} onClick={e => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(record.id)}
                    onChange={e => onSelect(record.id, e.target.checked)}
                    className="accent-white cursor-pointer"
                  />
                </td>
                <td className={\`\${tdClass} font-medium text-white\`}>{record.name}</td>`
);

fs.writeFileSync(path, content, 'utf8');
