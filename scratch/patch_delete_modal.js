const fs = require('fs');

let content = fs.readFileSync('components/tasks/DeleteProjectModal.tsx', 'utf-8');

// Add createPortal import
if (!content.includes('createPortal')) {
  content = content.replace(/import React, \{ useState \} from 'react';/, "import React, { useState } from 'react';\nimport { createPortal } from 'react-dom';");
}

// Wrap return with createPortal
content = content.replace(/return \(\n\s*<div className="fixed inset-0/g,
  `if (typeof document === 'undefined') return null;\n\n  return createPortal(\n    <div className="fixed inset-0`);

// Close createPortal
content = content.replace(/    <\/div>\n  \);\n\}/, '    </div>,\n    document.body\n  );\n}');

fs.writeFileSync('components/tasks/DeleteProjectModal.tsx', content);
