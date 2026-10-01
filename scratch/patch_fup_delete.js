const fs = require('fs');
const path = 'components/crm/followup/FollowupSection.tsx';
let content = fs.readFileSync(path, 'utf8');

// add Trash2
content = content.replace('Archive, CalendarClock', 'Archive, CalendarClock, Trash2');

const oldButton = `                          <button
                            type="button"
                            onClick={() => onArchive(followup)}
                            title="Archivia"
                            className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-[#EF4444] group-hover:opacity-100"
                          >
                            <Archive size={13} />
                          </button>`;

const newButton = `                          <button
                            type="button"
                            onClick={() => onArchive(followup)}
                            title="Elimina"
                            className="rounded p-1 text-[#3F3F3F] opacity-0 transition-opacity hover:text-[#EF4444] group-hover:opacity-100"
                          >
                            <Trash2 size={13} />
                          </button>`;

if (content.includes(oldButton)) {
    content = content.replace(oldButton, newButton);
} else {
    console.log("Could not find archive button");
}

fs.writeFileSync(path, content);
