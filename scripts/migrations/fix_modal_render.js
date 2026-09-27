const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/contatti/UnifiedContactsSection.tsx';
let content = fs.readFileSync(path, 'utf8');

const modalJSX = `
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
      />
    </div>
  );
}`;

content = content.replace(
  '    </div>\n  );\n}\n\nfunction DeleteConfirmModal',
  modalJSX + '\n\nfunction DeleteConfirmModal'
);

fs.writeFileSync(path, content, 'utf8');
