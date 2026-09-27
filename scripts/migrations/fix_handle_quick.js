const fs = require('fs');

let page = fs.readFileSync('/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx', 'utf8');

const handleQuickFollowupStr = `
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
    
    const timeLabel = days === 30 ? '1 mese' : \`tra \${days} \${days === 1 ? 'giorno' : 'giorni'}\`;
    toast.success(\`Follow-up impostato per \${timeLabel}\`);
  };
`;

if (!page.includes('handleQuickFollowup')) {
  page = page.replace(
    '  // ------------------------------------------------------------ render',
    handleQuickFollowupStr + '\n  // ------------------------------------------------------------ render'
  );
  
  // Inject into UnifiedContactsSection
  page = page.replace(
    'onDownloadDocument={handleDownloadDocument}\n            onDropConvert=',
    'onDownloadDocument={handleDownloadDocument}\n            onCreateQuickFollowup={handleQuickFollowup}\n            onDropConvert='
  );
  
  // Inject into OpportunitySection
  page = page.replace(
    'onArchive={opportunity => { archiveOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità archiviata\'); }}\n            onRestore={opportunity => { restoreOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità ripristinata\'); }}\n          />',
    'onArchive={opportunity => { archiveOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità archiviata\'); }}\n            onRestore={opportunity => { restoreOpportunity(ctx!, opportunity.id); toast.info(\'Opportunità ripristinata\'); }}\n            onCreateQuickFollowup={(id, days) => handleQuickFollowup(id, \'opportunity\', days)}\n          />'
  );
  
  fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx', page, 'utf8');
}
