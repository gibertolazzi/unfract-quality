const fs = require('fs');
const filePath = 'components/ui/folder-components.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldSizeMap = `const sizeMap: Record<
  FolderSize,
  {
    container: string;
    tabLeft: string;
    tabRight: string;
    tabBridge: string;
    flapBody: string;
    papers: string;
    paperOffset: string;
    paperH: string;
    paperContent: string;
    label: string;
    hoverY: number;
    hoverBackY: number;
  }
> = {
  sm: {
    container: "size-24 rounded-[24px]",
    tabLeft: "w-9 h-3 rounded-tl-lg",
    tabRight: "w-2 h-3 rounded-tr-[24px]",
    tabBridge: "w-2 h-2",
    flapBody: "h-9",
    papers: "inset-x-5 top-2",
    paperOffset: "top-1",
    paperH: "h-16",
    paperContent: "pt-2.5 px-2.5 space-y-1",
    label: "bottom-2 left-2 text-[9px] py-0.5 px-1.5",
    hoverY: -3,
    hoverBackY: -4,
  },
  md: {
    container: "size-32 rounded-[32px]",
    tabLeft: "w-12 h-4 rounded-tl-lg",
    tabRight: "w-2.5 h-4 rounded-tr-[32px]",
    tabBridge: "w-2.5 h-2.5",
    flapBody: "h-12",
    papers: "inset-x-6 top-3",
    paperOffset: "top-1.5",
    paperH: "h-24",
    paperContent: "pt-3 px-3 space-y-1",
    label: "bottom-3 left-3 text-[10px] py-0.5 px-1.5",
    hoverY: -3,
    hoverBackY: -5,
  },
  lg: {
    container: "size-40 rounded-[40px]",
    tabLeft: "w-16 h-5.5 rounded-tl-xl",
    tabRight: "w-3.25 h-5.5 rounded-tr-[40px]",
    tabBridge: "w-3.25 h-3.25",
    flapBody: "h-16",
    papers: "inset-x-8 top-4",
    paperOffset: "top-2",
    paperH: "h-30",
    paperContent: "pt-4 px-4 space-y-1.5",
    label: "bottom-4 left-4 text-xs py-1 px-2",
    hoverY: -4,
    hoverBackY: -6,
  },
};`;

const newSizeMap = `const sizeMap: Record<
  FolderSize,
  {
    container: string;
    tabLeft: string;
    tabRight: string;
    tabBridge: string;
    flapBody: string;
    papers: string;
    paperOffset: string;
    paperH: string;
    paperContent: string;
    label: string;
    hoverY: number;
    hoverBackY: number;
  }
> = {
  sm: {
    container: "size-24 rounded-2xl",
    tabLeft: "w-9 h-3 rounded-tl-lg",
    tabRight: "w-2 h-3 rounded-tr-2xl",
    tabBridge: "w-2 h-2",
    flapBody: "h-9",
    papers: "inset-x-5 top-2",
    paperOffset: "top-1",
    paperH: "h-16",
    paperContent: "pt-2.5 px-2.5 space-y-1",
    label: "bottom-2 left-2 text-[9px] py-0.5 px-1.5 max-w-[calc(100%-16px)]",
    hoverY: -3,
    hoverBackY: -4,
  },
  md: {
    container: "size-32 rounded-[20px]",
    tabLeft: "w-12 h-4 rounded-tl-lg",
    tabRight: "w-2.5 h-4 rounded-tr-[20px]",
    tabBridge: "w-2.5 h-2.5",
    flapBody: "h-12",
    papers: "inset-x-6 top-3",
    paperOffset: "top-1.5",
    paperH: "h-24",
    paperContent: "pt-3 px-3 space-y-1",
    label: "bottom-3 left-3 text-[10px] py-0.5 px-1.5 max-w-[calc(100%-24px)]",
    hoverY: -3,
    hoverBackY: -5,
  },
  lg: {
    container: "size-40 rounded-[28px]",
    tabLeft: "w-16 h-[22px] rounded-tl-xl",
    tabRight: "w-[13px] h-[22px] rounded-tr-[28px]",
    tabBridge: "w-[13px] h-[13px]",
    flapBody: "h-16",
    papers: "inset-x-8 top-4",
    paperOffset: "top-2",
    paperH: "h-[120px]",
    paperContent: "pt-4 px-4 space-y-1.5",
    label: "bottom-4 left-4 text-xs py-1 px-2 max-w-[calc(100%-32px)]",
    hoverY: -4,
    hoverBackY: -6,
  },
};`;

content = content.replace(oldSizeMap, newSizeMap);

const oldLabel = `{label && (
        <div className={cn("absolute z-20 rounded-full", s.label, c.labelBg)}>
          <span className="font-medium text-white truncate max-w-full block">{label}</span>
        </div>
      )}`;

const newLabel = `{label && (
        <div className={cn("absolute z-20 rounded-full flex items-center overflow-hidden", s.label, c.labelBg)}>
          <span className="font-medium text-white truncate block w-full text-left">{label}</span>
        </div>
      )}`;

content = content.replace(oldLabel, newLabel);

fs.writeFileSync(filePath, content);
