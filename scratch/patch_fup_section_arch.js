const fs = require('fs');
const path = 'components/crm/followup/FollowupSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetBtn = `                          <button
                            type="button"
                            onClick={() => onArchive(followup)}
                            title="Elimina"
                            className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-[#EF4444] group-hover:opacity-100"
                          >
                            <Trash2 size={13} />
                          </button>`;
const newBtn = `                          <button
                            type="button"
                            onClick={() => onArchive(followup)}
                            title="Archivia"
                            className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                          >
                            <Archive size={13} />
                          </button>`;

content = content.replace(targetBtn, newBtn);

fs.writeFileSync(path, content);
