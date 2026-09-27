const fs = require('fs');
const path = 'components/crm/CrmKpiBar.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `      {increment !== undefined && (
        <div className="flex items-center gap-1.5 mt-1 z-10">
          <span className={\`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium \${
            neutralValue ? 'bg-white/10 text-white/70' :
            isPositive ? 'bg-green-500/20 text-green-500' :
            isNegative ? 'bg-red-500/20 text-red-500' :
            'bg-white/10 text-white/70'
          }\`}>
            {neutralValue ? '' : isPositive ? '↑' : isNegative ? '↓' : ''} {isZero ? 'NA' : \`\${Math.abs(increment)}%\`}
          </span>
          <span className="text-[10px] text-[#5A5A5A]">from last month</span>
        </div>
      )}`;

const newStr = `      {increment !== undefined ? (
        <div className="flex items-center gap-1.5 mt-1 z-10">
          <span className={\`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium \${
            neutralValue ? 'bg-white/10 text-white/70' :
            isPositive ? 'bg-green-500/20 text-green-500' :
            isNegative ? 'bg-red-500/20 text-red-500' :
            'bg-white/10 text-white/70'
          }\`}>
            {neutralValue ? '' : isPositive ? '↑' : isNegative ? '↓' : ''} {isZero ? 'NA' : \`\${Math.abs(increment)}%\`}
          </span>
          <span className="text-[10px] text-[#5A5A5A]">from last month</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-1 z-10 opacity-0 pointer-events-none select-none">
          <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium">
            0%
          </span>
          <span className="text-[10px]">from last month</span>
        </div>
      )}`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, newStr);
} else {
    console.log("Could not find the target string in CrmKpiBar.tsx");
}

fs.writeFileSync(path, content);
