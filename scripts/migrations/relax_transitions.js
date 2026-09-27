const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/constants.ts';
let content = fs.readFileSync(path, 'utf8');

const target = `export const OPPORTUNITY_TRANSITIONS: Record<OpportunityPhase, OpportunityPhase[]> = {
  QUALIFICATION: ['DISCOVERY', 'LOST'],
  DISCOVERY:     ['PROPOSAL', 'LOST'],
  PROPOSAL:      ['NEGOTIATION', 'LOST'],
  NEGOTIATION:   ['WON', 'LOST'],
  WON:           [],
  LOST:          [],
};`;

// Let everything transition to everything
const replacement = `export const OPPORTUNITY_TRANSITIONS: Record<OpportunityPhase, OpportunityPhase[]> = {
  QUALIFICATION: ['DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
  DISCOVERY:     ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'],
  PROPOSAL:      ['QUALIFICATION', 'DISCOVERY', 'NEGOTIATION', 'WON', 'LOST'],
  NEGOTIATION:   ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'WON', 'LOST'],
  WON:           ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'LOST'],
  LOST:          ['QUALIFICATION', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON'],
};`;

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');
