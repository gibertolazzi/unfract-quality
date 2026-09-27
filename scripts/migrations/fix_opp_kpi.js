const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/CrmKpiBar.tsx';
let content = fs.readFileSync(path, 'utf8');

const calcTarget = `  const openOpportunities = live(opportunities).filter(o => o.phase !== 'WON' && o.phase !== 'LOST');
  const pipelineValue = openOpportunities.reduce((sum, o) => sum + o.value, 0);`;

const calcReplacement = `  const openOpportunities = live(opportunities).filter(o => o.phase !== 'WON' && o.phase !== 'LOST');
  const pipelineValue = openOpportunities.reduce((sum, o) => sum + o.value, 0);

  const allInsertedOpps = live(opportunities).filter(o => o.phase !== 'LOST');
  const allInsertedOppsValue = allInsertedOpps.reduce((sum, o) => sum + o.value, 0);
  const totalOppCount = live(opportunities).length;
`;

content = content.replace(calcTarget, calcReplacement);

const metricTarget = `<Metric label="Opportunità" value={String(openOpportunities.length)} increment={calculateIncrement(openOpportunities)} />`;
const metricReplacement = `<Metric label="Opportunità" value={\`\${formatEuro(allInsertedOppsValue)} (\${totalOppCount})\`} increment={calculateIncrement(live(opportunities))} />`;

content = content.replace(metricTarget, metricReplacement);

fs.writeFileSync(path, content, 'utf8');
