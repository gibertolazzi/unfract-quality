const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('onQuickFollowup?: (days: number) => void;')) {
  content = content.replace(
    '  onDownloadDocument: (document: CrmDocumentType) => void;\n}',
    '  onDownloadDocument: (document: CrmDocumentType) => void;\n  onQuickFollowup?: (days: number) => void;\n}'
  );
}

// In RecordDrawer function signature, I need to check if it's destructured
content = content.replace(/props\.onQuickFollowup/g, 'onQuickFollowup');
if (!content.includes('onQuickFollowup,')) {
  content = content.replace(
    '  onCompose, onUploadDocument, onDownloadDocument,\n}: RecordDrawerProps) {',
    '  onCompose, onUploadDocument, onDownloadDocument, onQuickFollowup,\n}: RecordDrawerProps) {'
  );
  // Also check if it's broken across lines differently
  if (!content.includes('onQuickFollowup,')) {
    content = content.replace(
      'onDownloadDocument,\n}: RecordDrawerProps) {',
      'onDownloadDocument, onQuickFollowup,\n}: RecordDrawerProps) {'
    );
  }
}

fs.writeFileSync(path, content, 'utf8');
