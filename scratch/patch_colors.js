const fs = require('fs');
const filePath = 'components/ui/folder-components.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Update sizeMap for flapBody rounding
content = content.replace(
  'flapBody: "h-9",',
  'flapBody: "h-9 rounded-b-2xl rounded-tr-2xl",'
);
content = content.replace(
  'flapBody: "h-12",',
  'flapBody: "h-12 rounded-b-[20px] rounded-tr-[20px]",'
);
content = content.replace(
  'flapBody: "h-16",',
  'flapBody: "h-16 rounded-b-[28px] rounded-tr-[28px]",'
);

// Update JSX to remove tabRight, tabBridge and the hardcoded rounded-tr-xl
const oldJSX = `<div className="flex items-end">
          <div className={cn(s.tabLeft, "backdrop-blur-sm", c.flap)} />
          <div className={cn(s.tabRight, "backdrop-blur-sm", c.flap)} />
          <div
            className={cn(
              s.tabBridge,
              "mask-[radial-gradient(200%_200%_at_100%_0%,transparent_50%,black_50%)]",
              c.flap
            )}
          />
        </div>
        <div
          className={cn(s.flapBody, "rounded-tr-xl backdrop-blur-sm", c.flap)}
        />`;

const newJSX = `<div className="flex items-end">
          <div className={cn(s.tabLeft, "backdrop-blur-sm", c.flap)} />
        </div>
        <div
          className={cn(s.flapBody, "backdrop-blur-sm", c.flap)}
        />`;
content = content.replace(oldJSX, newJSX);

// Update blue colors to #00A6FF -> #006AFF
const oldBlue = `blue: {
    folder: "from-blue-400 to-blue-500",
    flap: "bg-blue-300/50",
    paperBack: "bg-blue-100/60",
    paperFront: "bg-blue-50",
    paperLine: "bg-blue-300/40",
    paperBorder: "border-blue-200",
    labelBg: "bg-blue-800/20",
    folderBorder: "border-white/30",
  },`;

const newBlue = `blue: {
    folder: "from-[#00A6FF] to-[#006AFF]",
    flap: "bg-[#006AFF]/40",
    paperBack: "bg-blue-100/60",
    paperFront: "bg-white",
    paperLine: "bg-blue-200",
    paperBorder: "border-blue-100",
    labelBg: "bg-black/20",
    folderBorder: "border-white/20",
  },`;
content = content.replace(oldBlue, newBlue);

fs.writeFileSync(filePath, content);
