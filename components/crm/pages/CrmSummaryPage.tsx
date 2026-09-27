import { useState } from 'react';
import { useCrm } from '@/contexts/CrmContext';
import { useToast } from '@/contexts/ToastContext';
import { RiepilogoSection } from '@/components/crm/dashboard/RiepilogoSection';
import { DocumentiSection } from '@/components/crm/documenti/DocumentiSection';
import { ArrowLeft } from 'lucide-react';
import { CrmLead, CrmAccount, CrmCustomer, CrmOpportunity, CrmContact, CrmDocument } from '@/components/crm/types';
import { OwnerOption } from '@/components/crm/leads/LeadFiltersBar';
import { updateDocument, archiveDocument, restoreDocument, recordDocumentDownload } from '@/lib/crm/documents';
import { uploadDocument, uploadDocumentVersion, DocumentTarget } from '@/lib/crm/documentUpload';

export interface CrmSummaryPageProps {
  leads: CrmLead[];
  accounts: CrmAccount[];
  contacts: CrmContact[];
  customers: CrmCustomer[];
  opportunities: CrmOpportunity[];
  documents: CrmDocument[];
  owners: OwnerOption[];
  loading: boolean;
}

export function CrmSummaryPage({
  leads, accounts, contacts, customers, opportunities, documents, owners, loading,
}: CrmSummaryPageProps) {
  const { ctx } = useCrm();
  const toast = useToast();
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const documentUploader = (target: DocumentTarget) =>
    async (file: File, onProgress: (percent: number) => void) => {
      const outcome = await uploadDocument(ctx!, file, { target }, onProgress);
      if (outcome.error) toast.error(`${outcome.fileName}: ${outcome.error}`);
      return outcome;
    };

  const versionUploader = (document: CrmDocument) =>
    async (file: File, onProgress: (percent: number) => void) => {
      const outcome = await uploadDocumentVersion(ctx!, document, file, onProgress);
      if (outcome.error) toast.error(`${outcome.fileName}: ${outcome.error}`);
      else toast.success('Nuova versione caricata');
      return outcome;
    };

  const handleDownloadDocument = (document: CrmDocument, version?: any) => {
    const url = version?.downloadUrl || document.downloadUrl;
    if (!url) {
      toast.error('Questo documento non ha un file collegato');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    if (ctx) recordDocumentDownload(ctx, document.id);
  };

  return (
    <div className="flex flex-col gap-6">
      {selectedFolderId ? (
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setSelectedFolderId(null)}
            className="flex items-center gap-2 text-sm text-[#858585] hover:text-white transition-colors self-start"
          >
            <ArrowLeft size={16} /> Torna al Riepilogo
          </button>
          <DocumentiSection
            documents={documents.filter(d => d.accountId === selectedFolderId)}
            leads={leads}
            accounts={accounts}
            contacts={contacts}
            customers={customers}
            opportunities={opportunities}
            ownerName={uid => owners.find(o => o.uid === uid)?.name || (uid ? 'Altro utente' : '—')}
            loading={loading}
            onUpload={documentUploader({ accountId: selectedFolderId })}
            onUploadVersion={versionUploader}
            onUpdate={(document, updates) => updateDocument(ctx!, document.id, updates)}
            onDownload={handleDownloadDocument}
            onArchive={document => { archiveDocument(ctx!, document.id); toast.info('Documento archiviato'); }}
            onRestore={document => { restoreDocument(ctx!, document.id); toast.info('Documento ripristinato'); }}
          />
        </div>
      ) : (
        <RiepilogoSection
          leads={leads}
          accounts={accounts}
          opportunities={opportunities}
          documents={documents}
          onFolderClick={setSelectedFolderId}
        />
      )}
    </div>
  );
}
