const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("const [tab, setTab] = useState<CrmTab>('lead');")) {
    lines[i] = lines[i].replace("'lead'", "'dashboard'");
  }
  if (lines[i].includes("counts={{")) {
    let j = i + 1;
    while (!lines[j].includes("}}")) {
      if (!lines[j].includes("contact") && !lines[j].includes("opportunity") && !lines[j].includes("dashboard")) {
        lines[j] = "";
      }
      j++;
    }
  }
  if (lines[i].includes("{tab === 'lead' && (")) {
    let j = i;
    while (!lines[j].includes(")}")) {
      lines[j] = "";
      j++;
    }
    lines[j] = "";
  }
  if (lines[i].includes("{tab === 'ricerca' && (")) {
    let j = i;
    while (!lines[j].includes(")}")) {
      lines[j] = "";
      j++;
    }
    lines[j] = "";
  }
  if (lines[i].includes("onUpdateLead={handleEdit}")) {
     lines[i] = "          onUpdateLead={(id, values) => handleEdit({ id, ...values } as any)}";
  }
}

fs.writeFileSync(path, lines.filter(l => l !== "").join('\n'), 'utf8');
