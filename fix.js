const fs = require('fs');
let content = fs.readFileSync('components/marketing/EmailEditorView.tsx', 'utf-8');
content = content.replace("<DragDropContext onDragEnd={handleDragEnd}>\n          <>", "<DragDropContext onDragEnd={handleDragEnd}>");
fs.writeFileSync('components/marketing/EmailEditorView.tsx', content);
