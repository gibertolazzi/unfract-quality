const fs = require('fs');

const content = fs.readFileSync('components/marketing/EmailEditorView.tsx', 'utf-8');
const lines = content.split('\n');

let openTags = 0;
let closeTags = 0;
// Actually, it's easier to use a formatter to see the issue.
