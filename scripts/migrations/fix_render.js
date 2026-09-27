const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'onDelete={() => {\n            if (confirm(\'Sei sicuro di voler eliminare definitivamente questo elemento?\')) {\n              if (liveDrawer.kind === \'account\') props.onDeleteAccount?.(liveDrawer.record);\n              else if (liveDrawer.kind === \'contact\') props.onDeleteContact?.(liveDrawer.record);\n              else if ((liveDrawer.kind as string) === \'lead\') props.onDeleteLead?.(liveDrawer.record as any);\n              else props.onDeleteCustomer?.(liveDrawer.record);\n              setDrawer(null);\n            }\n          }}',
  'onDelete={() => {\n            const targetRecord = unified.find(u => u.id === liveDrawer.record.id && u.type === liveDrawer.kind);\n            if (targetRecord) setDeleteConfirm({ open: true, targets: [targetRecord] });\n          }}'
);

content = content.replace(
  '</RecordDrawer>\n      )}',
  `</RecordDrawer>
      )}

      <DeleteConfirmModal
        open={deleteConfirm.open}
        targets={deleteConfirm.targets}
        onClose={() => setDeleteConfirm({ open: false, targets: [] })}
        onConfirm={() => {
          deleteConfirm.targets.forEach(t => {
            if (t.type === 'account') props.onDeleteAccount?.(t.raw);
            else if (t.type === 'contact') props.onDeleteContact?.(t.raw);
            else if (t.type === 'lead') props.onDeleteLead?.(t.raw);
            else props.onDeleteCustomer?.(t.raw);
          });
          setDeleteConfirm({ open: false, targets: [] });
          setSelectedIds([]);
          setDrawer(null);
        }}
      />`
);

fs.writeFileSync(path, content, 'utf8');
