const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add Trash2 icon
content = content.replace('ArchiveRestore,', 'ArchiveRestore, Trash2,');

// Add onDelete prop
content = content.replace('onArchive: () => void;', 'onArchive: () => void;\n  onDelete?: () => void;');

// Add Delete button next to Archive
content = content.replace(
  '<button type="button" onClick={onArchive} title="Archivia" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-[#EF4444]">\n                <Archive size={14} />\n              </button>',
  '<button type="button" onClick={onArchive} title="Archivia" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-[#EF4444]">\n                <Archive size={14} />\n              </button>\n              {onDelete && (\n                <button type="button" onClick={onDelete} title="Elimina definitivamente" className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-[#EF4444]">\n                  <Trash2 size={14} />\n                </button>\n              )}'
);

// Do the same inside the destructuring
content = content.replace('onArchive, onRestore,', 'onArchive, onDelete, onRestore,');

fs.writeFileSync(path, content, 'utf8');
