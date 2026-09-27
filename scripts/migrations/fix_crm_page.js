const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes("{tab === 'dashboard' && ("));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes("importOpen && ctx && ("));

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `{tab === 'dashboard' && (
        <div className="flex flex-col gap-6">
          <DashboardSection
            leads={leads}
            accounts={accounts}
            customers={customers}
            opportunities={opportunities}
            followups={followups}
            interactions={interactions}
            communications={communications}
            documents={documents}
            ownerName={uid => owners.find(o => o.uid === uid)?.name || (uid ? 'Altro utente' : '—')}
            loading={loading}
            onShowLeads={state => {
              setFilters({ ...EMPTY_FILTERS, states: state ? [state] : [] });
              setPage(1);
              setTab('contact');
            }}
            onShowFollowups={view => { setFollowupView(view); setTab('contact'); }}
            onShowOpportunities={() => setTab('opportunity')}
            onShowCustomers={() => setTab('contact')}
          />
          <DocumentiSection
            documents={documents}
            leads={leads}
            accounts={accounts}
            contacts={contacts}
            customers={customers}
            opportunities={opportunities}
            ownerName={uid => owners.find(o => o.uid === uid)?.name || (uid ? 'Altro utente' : '—')}
            loading={loading}
            onUpload={documentUploader({})}
            onUploadVersion={versionUploader}
            onUpdate={(document, updates) => updateDocument(ctx!, document.id, updates)}
            onDownload={handleDownloadDocument}
            onArchive={document => { archiveDocument(ctx!, document.id); toast.info('Documento archiviato'); }}
            onRestore={document => { restoreDocument(ctx!, document.id); toast.info('Documento ripristinato'); }}
          />
        </div>
      )}

      {tab === 'contact' && (
        <UnifiedContactsSection
          accounts={accounts}
          contacts={contacts}
          customers={customers}
          leads={leads}
          owners={owners}
          history={history}
          sources={sources}
          policyVersion={PRIVACY_POLICY_VERSION}
          optOutAddress={OPT_OUT_ADDRESS}
          senderName={user?.displayName || user?.email || ''}
          loading={loading}
          saving={saving}
          onCreateAccount={handleCreateAccount}
          onUpdateAccount={(id, values) => updateAccount(ctx!, id, values)}
          onArchiveAccount={account => { archiveAccount(ctx!, account.id); toast.info('Azienda archiviata'); }}
          onRestoreAccount={account => { restoreAccount(ctx!, account.id); toast.info('Azienda ripristinata'); }}
          onCreateContact={handleCreateContact}
          onUpdateContact={(id, values) => updateContact(ctx!, id, values)}
          onArchiveContact={contact => { archiveContact(ctx!, contact.id); toast.info('Contatto archiviato'); }}
          onRestoreContact={contact => { restoreContact(ctx!, contact.id); toast.info('Contatto ripristinato'); }}
          onCreateCustomer={handleCreateCustomer}
          onUpdateCustomer={(id, values) => updateCustomer(ctx!, id, values)}
          onArchiveCustomer={customer => { archiveCustomer(ctx!, customer.id); toast.info('Cliente archiviato'); }}
          onRestoreCustomer={customer => { restoreCustomer(ctx!, customer.id); toast.info('Cliente ripristinato'); }}
          onCreateLead={handleCreate}
          onUpdateLead={handleEdit}
          onArchiveLead={handleArchive}
          onRestoreLead={() => {}}
          onChangeLeadState={handleStateChange}
          onAssignLead={handleAssign}
          onUploadDocument={documentUploader}
          onDownloadDocument={handleDownloadDocument}
          onSendEmail={async (contact, email) => {
            const outcome = await sendCrmEmail(ctx!, {
              toEmail: contact.email,
              toContactId: contact.id,
              subject: email.subject,
              text: email.text,
              html: email.html,
              templateId: email.templateId,
              templateVars: email.templateVars,
            });
            if (outcome.sent) toast.success('Email inviata');
            else toast.error(outcome.error || 'Invio non riuscito');
            return outcome;
          }}
        />
      )}

      {tab === 'opportunity' && (
        <OpportunitySection
          opportunities={opportunities}
          customers={customers}
          accounts={accounts}
          leads={leads}
          owners={owners}
          history={history}
          loading={loading}
          onCreate={handleCreateOpportunity}
          onUpdate={(id, values) => updateOpportunity(ctx!, id, values)}
          onChangePhase={handleOpportunityPhase}
          onReorder={orderedIds => reorderOpportunities(ctx!, orderedIds)}
          onRefusedMove={(from, to) => toast.error(
            \`Da \${OPPORTUNITY_PHASE_LABELS[from]} non si passa a \${OPPORTUNITY_PHASE_LABELS[to]}\`
          )}
          onArchive={opportunity => { archiveOpportunity(ctx!, opportunity.id); toast.info('Opportunità archiviata'); }}
          onRestore={opportunity => { restoreOpportunity(ctx!, opportunity.id); toast.info('Opportunità ripristinata'); }}
        />
      )}`;

  const newLines = [
    ...lines.slice(0, startIdx),
    replacement,
    ...lines.slice(endIdx) // keeps the importOpen line
  ];
  fs.writeFileSync(path, newLines.join('\n'), 'utf8');
  console.log('Success!');
} else {
  console.log('Could not find boundaries', startIdx, endIdx);
}
