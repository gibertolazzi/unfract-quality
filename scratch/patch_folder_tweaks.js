const fs = require('fs');
const filePath = 'components/ui/folder-components.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix tabLeft rounding
content = content.replace('tabLeft: "w-9 h-3 rounded-tl-lg",', 'tabLeft: "w-9 h-3 rounded-t-lg",');
content = content.replace('tabLeft: "w-12 h-4 rounded-tl-lg",', 'tabLeft: "w-12 h-4 rounded-t-lg",');
content = content.replace('tabLeft: "w-16 h-[22px] rounded-tl-xl",', 'tabLeft: "w-16 h-[22px] rounded-t-xl",');

// Fix blue color configuration
const oldBlue = `blue: {
    folder: "from-[#00A6FF] to-[#006AFF]",
    flap: "bg-[#006AFF]/40",
    paperBack: "bg-blue-100/60",
    paperFront: "bg-white",
    paperLine: "bg-blue-200",
    paperBorder: "border-blue-100",
    labelBg: "bg-black/20",
    folderBorder: "border-white/20",
  },`;

const newBlue = `blue: {
    folder: "from-[#006AFF] to-[#006AFF]",
    flap: "bg-black/20",
    paperBack: "bg-blue-100/60",
    paperFront: "bg-white",
    paperLine: "bg-blue-200",
    paperBorder: "border-blue-100",
    labelBg: "bg-black/20",
    folderBorder: "border-white/20",
  },`;

content = content.replace(oldBlue, newBlue);

fs.writeFileSync(filePath, content);
