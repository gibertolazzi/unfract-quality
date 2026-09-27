const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const quickFollowupHandler = `
  const handleQuickFollowup = (targetId: string, kind: string, days: number) => {
    if (!ctx) return;
    const date = new Date();
    date.setDate(date.getDate() + days);
    
    let targetKey = '';
    let name = 'Contatto';
    
    if (kind === 'lead') {
      targetKey = 'leadId';
      const r = leads.find(l => l.id === targetId);
      name = r ? (r.fullName || r.companyName) : name;
    } else if (kind === 'contact') {
      targetKey = 'contactId';
      const r = contacts.find(c => c.id === targetId);
      name = r ? r.fullName : name;
    } else if (kind === 'account') {
      targetKey = 'accountId';
      const r = accounts.find(a => a.id === targetId);
      name = r ? (r.displayName || r.legalName) : name;
    } else if (kind === 'customer') {
      targetKey = 'customerId';
      const r = customers.find(c => c.id === targetId);
      const a = accounts.find(a => a.id === r?.accountId);
      name = a ? (a.displayName || a.legalName) : name;
    } else if (kind === 'opportunity') {
      targetKey = 'opportunityId';
      const r = opportunities.find(o => o.id === targetId);
      name = r ? r.title : name;
    }

    createFollowup(ctx, {
      type: 'call',
      title: \`Ricontattare \${name}\`,
      dueDate: date.toISOString().slice(0, 10),
      assigneeUid: ctx.uid,
      [targetKey]: targetId,
    });
    
    toast.success(\`Follow-up impostato per tra \${days} \${days === 1 ? 'giorno' : 'giorni'}\`);
  };
`;

// Insert the handler before render
content = content.replace(
  '  // ==========================================================================\n  // Render',
  quickFollowupHandler + '\n  // ==========================================================================\n  // Render'
);

// Inject into UnifiedContactsSection
content = content.replace(
  'onDownloadDocument={handleDownloadDocument}\n            onDropConvert=',
  'onDownloadDocument={handleDownloadDocument}\n            onCreateQuickFollowup={handleQuickFollowup}\n            onDropConvert='
);

// Inject into OpportunitySection
content = content.replace(
  'onArchive={opportunity => { archiveOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità archiviata\'); }}\n            onRestore={opportunity => { restoreOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità ripristinata\'); }}\n          />',
  'onArchive={opportunity => { archiveOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità archiviata\'); }}\n            onRestore={opportunity => { restoreOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità ripristinata\'); }}\n            onCreateQuickFollowup={(id, days) => handleQuickFollowup(id, \'opportunity\', days)}\n          />'
);

fs.writeFileSync(path, content, 'utf8');
