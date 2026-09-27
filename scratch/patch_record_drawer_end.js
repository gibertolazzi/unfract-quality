const fs = require('fs');
const path = 'components/crm/anagrafica/RecordDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

const endPattern = `        </div>
      </aside>
    </div>
  );
}`;

const modalCode = `
      {uploading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
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

const newEndPattern = `        </div>
      </aside>
${modalCode}
    </div>
  );
}`;

content = content.replace(endPattern, newEndPattern);

fs.writeFileSync(path, content);
