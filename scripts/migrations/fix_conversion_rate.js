const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/CrmKpiBar.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `function calculateConversionRate(leads: any[], customers: any[]): number {
  if (leads.length === 0) return 0;
  return Number(((customers.length / leads.length) * 100).toFixed(1));
}`;

const replacement1 = `function calculateConversionRate(opportunities: any[]): number {
  if (opportunities.length === 0) return 0;
  const won = opportunities.filter(o => o.phase === 'WON');
  return Number(((won.length / opportunities.length) * 100).toFixed(1));
}`;

content = content.replace(target1, replacement1);

const target2 = `function calculateConversionRateIncrement(leads: any[], customers: any[]): number {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  
  let currentMonthLeads = 0;
  let lastMonthLeads = 0;
  let currentMonthCustomers = 0;
  let lastMonthCustomers = 0;
  
  const getMillis = (t: any) => {
    if (!t) return 0;
    if (typeof t === 'string') return new Date(t).getTime();
    if (t.toMillis) return t.toMillis();
    if (t.seconds) return t.seconds * 1000;
    return 0;
  };

  leads.forEach(l => {
    const time = getMillis(l.createdAt);
    if (time === 0) return;
    if (now - time <= thirtyDays) currentMonthLeads++;
    else if (now - time <= thirtyDays * 2) lastMonthLeads++;
  });

  customers.forEach(c => {
    const time = getMillis(c.createdAt);
    if (time === 0) return;
    if (now - time <= thirtyDays) currentMonthCustomers++;
    else if (now - time <= thirtyDays * 2) lastMonthCustomers++;
  });

  const currentRate = currentMonthLeads === 0 ? 0 : currentMonthCustomers / currentMonthLeads;
  const lastRate = lastMonthLeads === 0 ? 0 : lastMonthCustomers / lastMonthLeads;`;

const replacement2 = `function calculateConversionRateIncrement(opportunities: any[]): number {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  
  let currentMonthOpps = 0;
  let lastMonthOpps = 0;
  let currentMonthWon = 0;
  let lastMonthWon = 0;
  
  const getMillis = (t: any) => {
    if (!t) return 0;
    if (typeof t === 'string') return new Date(t).getTime();
    if (t.toMillis) return t.toMillis();
    if (t.seconds) return t.seconds * 1000;
    return 0;
  };

  opportunities.forEach(o => {
    const time = getMillis(o.createdAt);
    if (time === 0) return;
    const isCurrent = now - time <= thirtyDays;
    const isLast = !isCurrent && now - time <= thirtyDays * 2;
    
    if (isCurrent) {
      currentMonthOpps++;
      if (o.phase === 'WON') currentMonthWon++;
    } else if (isLast) {
      lastMonthOpps++;
      if (o.phase === 'WON') lastMonthWon++;
    }
  });

  const currentRate = currentMonthOpps === 0 ? 0 : currentMonthWon / currentMonthOpps;
  const lastRate = lastMonthOpps === 0 ? 0 : lastMonthWon / lastMonthOpps;`;

content = content.replace(target2, replacement2);

const target3 = `<Metric label="Tasso di Conversione" value={\`\${calculateConversionRate(live(leads), live(customers))}%\`} increment={calculateConversionRateIncrement(live(leads), live(customers))} />`;
const replacement3 = `<Metric label="Tasso di Conversione" value={\`\${calculateConversionRate(live(opportunities))}%\`} increment={calculateConversionRateIncrement(live(opportunities))} />`;

content = content.replace(target3, replacement3);

fs.writeFileSync(path, content, 'utf8');
