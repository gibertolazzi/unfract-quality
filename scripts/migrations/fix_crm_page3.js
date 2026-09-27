const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/app/crm/page.tsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("onNotify={(message, kind)")) {
     lines[i] = "";
  }
  if (lines[i].trim() === "/>" && lines[i+1] && lines[i+1].trim() === ")}") {
     if (lines[i-1].includes("onToggleState={toggleState}")) {
        // keep CrmKpiBar closing tag but remove the hanging one
        // Wait, CrmKpiBar was closed on line 386.
     }
  }
}
fs.writeFileSync(path, lines.join('\n'), 'utf8');
