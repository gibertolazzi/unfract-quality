const fs = require('fs');

let content = fs.readFileSync('components/tasks/CreateProjectModal.tsx', 'utf-8');

// Add createPortal import
if (!content.includes('createPortal')) {
  content = content.replace(/import React, \{ useState \} from 'react';/, "import React, { useState } from 'react';\nimport { createPortal } from 'react-dom';");
}

// Wrap return with createPortal
content = content.replace(/return \(\n\s*<div className="fixed inset-0/g,
  `if (typeof document === 'undefined') return null;\n\n  return createPortal(\n    <div className="fixed inset-0`);

// Close createPortal
content = content.replace(/    <\/div>\n  \);\n\}/, '    </div>,\n    document.body\n  );\n}');

// Improve empty state
content = content.replace(/<span className="text-\[#858585\] text-xs italic p-2">Nessuna organizzazione disponibile\.<\/span>/,
  `<div className="flex items-center justify-center py-4 px-2 text-center">\n                  <span className="text-[#858585] text-xs">Nessuna organizzazione collegata.</span>\n                </div>`);

fs.writeFileSync('components/tasks/CreateProjectModal.tsx', content);
