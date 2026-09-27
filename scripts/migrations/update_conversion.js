const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/lib/crm/conversion.ts';
let content = fs.readFileSync(path, 'utf8');

// Update ConversionProposal
content = content.replace(
  '  existingCustomerId: string;',
  '  existingCustomerId: string;\n\n  monthlyAmount?: number;\n  annualAmount?: number;\n  oneTimeAmount?: number;'
);

// Update buildConversionProposal
content = content.replace(
  '    existingCustomerId: \'\',',
  '    existingCustomerId: \'\',\n    monthlyAmount: 0,\n    annualAmount: 0,\n    oneTimeAmount: 0,'
);

// Update customer creation logic in convertLead
const customerCreation = `      batch.set(ref, {
        accountId: result.accountId,
        contactIds: result.contactId ? [result.contactId] : [],
        ownerUid: ctx.uid,
        status: 'active',
        linkedProjectIds: [], sharedWithProjectFields: [],
        originLeadId: lead.id,
        customerSince: new Date().toISOString(),
        notes: '', privateNotes: '',
        ...buildBasePayload(ctx),
      });`;
      
const newCustomerCreation = `      batch.set(ref, {
        accountId: result.accountId,
        contactIds: result.contactId ? [result.contactId] : [],
        ownerUid: ctx.uid,
        status: 'active',
        linkedProjectIds: [], sharedWithProjectFields: [],
        originLeadId: lead.id,
        customerSince: new Date().toISOString(),
        notes: '', privateNotes: '',
        monthlyAmount: proposal.monthlyAmount || 0,
        annualAmount: proposal.annualAmount || 0,
        oneTimeAmount: proposal.oneTimeAmount || 0,
        ...buildBasePayload(ctx),
      });`;

content = content.replace(customerCreation, newCustomerCreation);
fs.writeFileSync(path, content, 'utf8');
