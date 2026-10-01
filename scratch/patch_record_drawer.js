const fs = require('fs');
const path = 'components/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove the inline UploadPanel
const inlineUploadPanel = `            {uploading && (
              <UploadPanel
                compact
                targetLabel={title || 'questa scheda'}
                onUpload={onUploadDocument(documentTarget)}
                onDone={() => setUploading(false)}
              />
            )}`;
content = content.replace(inlineUploadPanel, '');

// 2. Change the button state in the section header so it doesn't show "Annulla" inside the drawer
const oldSectionHeaderBtn = `              <button
                type="button"
                onClick={() => setUploading(value => !value)}
                className="flex items-center gap-1 text-[10px] text-[#858585] transition-colors hover:text-white"
              >
                {uploading ? <X size={10} /> : <Plus size={10} />}
                {uploading ? 'Annulla' : 'Allega'}
              </button>`;

const newSectionHeaderBtn = `              <button
                type="button"
                onClick={() => setUploading(true)}
                className="flex items-center gap-1 text-[10px] text-[#858585] transition-colors hover:text-white"
              >
                <Plus size={10} /> Allega
              </button>`;
content = content.replace(oldSectionHeaderBtn, newSectionHeaderBtn);

// 3. Remove the !uploading condition from the empty state
content = content.replace(
  '{attachments.length === 0 && !uploading ? (',
  '{attachments.length === 0 ? ('
);

// 4. Add the Modal at the end of the return statement
const modalCode = `
      {uploading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#1A1A1A] px-5 py-4">
              <h2 className="text-[15px] font-medium text-white">Allega File</h2>
              <button
                onClick={() => setUploading(false)}
                className="rounded-lg p-1.5 text-[#858585] transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <UploadPanel
                compact
                targetLabel={title || 'questa scheda'}
                onUpload={onUploadDocument(documentTarget)}
                onDone={() => setUploading(false)}
              />
            </div>
          </div>
        </div>
      )}
`;

// Insert it just before the closing </div> of RecordDrawer's return
const endPattern = `        </div>
      </div>
    </Drawer>
  );
}`;

const newEndPattern = `        </div>
      </div>
${modalCode}
    </Drawer>
  );
}`;

content = content.replace(endPattern, newEndPattern);

fs.writeFileSync(path, content);
