const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/CrmKpiBar.tsx';
let content = fs.readFileSync(path, 'utf8');

const calculateLogic = `function calculateIncrement(items: any[]): number {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  
  let currentMonthCount = 0;
  let lastMonthCount = 0;
  
  items.forEach(item => {
    let time = 0;
    if (item.createdAt) {
      if (typeof item.createdAt === 'string') {
        time = new Date(item.createdAt).getTime();
      } else if (item.createdAt.toMillis) {
        time = item.createdAt.toMillis();
      } else if (item.createdAt.seconds) {
        time = item.createdAt.seconds * 1000;
      }
    }
    if (time === 0) return;
    
    if (now - time <= thirtyDays) {
      currentMonthCount++;
    } else if (now - time <= thirtyDays * 2) {
      lastMonthCount++;
    }
  });

  if (lastMonthCount === 0) {
    if (currentMonthCount === 0) return 0;
    return 100;
  }
  
  return Number((((currentMonthCount - lastMonthCount) / lastMonthCount) * 100).toFixed(1));
}

function calculateConversionRate(leads: any[], customers: any[]): number {
  if (leads.length === 0) return 0;
  return Number(((customers.length / leads.length) * 100).toFixed(1));
}

function calculateConversionRateIncrement(leads: any[], customers: any[]): number {
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
  const lastRate = lastMonthLeads === 0 ? 0 : lastMonthCustomers / lastMonthLeads;

  if (lastRate === 0) {
    if (currentRate === 0) return 0;
    return 100;
  }

  return Number((((currentRate - lastRate) / lastRate) * 100).toFixed(1));
}`;

// Insert helpers before Metric function
content = content.replace(
  'function Metric({',
  calculateLogic + '\n\nfunction Metric({'
);

// Update metrics usage
content = content.replace(
  '<Metric label="Contatti" value={String(live(contacts).length)} increment={4.9} />\n          <Metric label="Aziende" value={String(live(accounts).length)} increment={0} />\n          <Metric label="Clienti" value={String(live(customers).length)} increment={-0.9} />\n          <Metric label="Opportunità" value={String(openOpportunities.length)} increment={4.9} />\n          <Metric label="Tasso di Conversione" value="0%" increment={4.9} />',
  `<Metric label="Contatti" value={String(live(contacts).length)} increment={calculateIncrement(live(contacts))} />
          <Metric label="Aziende" value={String(live(accounts).length)} increment={calculateIncrement(live(accounts))} />
          <Metric label="Clienti" value={String(live(customers).length)} increment={calculateIncrement(live(customers))} />
          <Metric label="Opportunità" value={String(openOpportunities.length)} increment={calculateIncrement(openOpportunities)} />
          <Metric label="Tasso di Conversione" value={\`\${calculateConversionRate(live(leads), live(customers))}%\`} increment={calculateConversionRateIncrement(live(leads), live(customers))} />`
);

fs.writeFileSync(path, content, 'utf8');
