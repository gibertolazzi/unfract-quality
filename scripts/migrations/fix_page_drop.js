const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `onUploadDocument={documentUploader({})}`;
const replacement = `onUploadDocument={documentUploader({})}
            onDropConvert={(id, sourceType, targetType) => {
              if (sourceType === 'lead' && targetType === 'customer') {
                const lead = leads.find(l => l.id === id);
                if (lead) setConversionTarget(lead);
              } else if (sourceType === 'account' && targetType === 'customer') {
                const account = accounts.find(a => a.id === id);
                if (account) {
                  setCreateModal('customer');
                  // To prefill the customer modal, the app normally relies on internal state 
                  // but we can just let them create it, or we can use the drawer.
                  // For now, if it's an account, just open it in the modal or drawer.
                  // Actually, we don't have a direct way to prefill CreateModal from here 
                  // without adding more state. Let's just fallback to the default behavior.
                }
              }
            }}`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
