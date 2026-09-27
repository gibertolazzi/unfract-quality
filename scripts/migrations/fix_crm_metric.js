const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/CrmKpiBar.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacementMetric = `function Metric({ label, value, increment, title }: { label: string; value: string; increment?: number; title?: string }) {
  const isPositive = increment !== undefined && increment > 0;
  const isNegative = increment !== undefined && increment < 0;
  const isZero = increment === 0;
  
  const glowColor = isPositive ? 'rgba(34, 197, 94, 0.15)' : isNegative ? 'rgba(239, 68, 68, 0.15)' : 'transparent';
  
  return (
    <div title={title} className="relative flex min-w-[160px] flex-1 flex-col gap-1.5 px-6 py-5 border-r border-[#1A1A1A] last:border-r-0 overflow-hidden">
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 blur-3xl rounded-full pointer-events-none" 
        style={{ backgroundColor: glowColor }}
      />
      <span className="text-[10px] uppercase tracking-wide text-[#5A5A5A] z-10">{label}</span>
      <span className="text-2xl font-semibold leading-none text-white z-10">{value}</span>
      
      {increment !== undefined && (
        <div className="flex items-center gap-1.5 mt-1 z-10">
          <span className={\`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium \${
            isPositive ? 'bg-green-500/20 text-green-500' :
            isNegative ? 'bg-red-500/20 text-red-500' :
            'bg-white/10 text-white/70'
          }\`}>
            {isPositive ? '↑' : isNegative ? '↓' : ''} {isZero ? 'NA' : \`\${Math.abs(increment)}%\`}
          </span>
          <span className="text-[10px] text-[#5A5A5A]">from last month</span>
        </div>
      )}
    </div>
  );
}`;

content = content.replace(/function Metric\([\s\S]*?\}\s*\}\n/m, replacementMetric + '\n');
fs.writeFileSync(path, content, 'utf8');
