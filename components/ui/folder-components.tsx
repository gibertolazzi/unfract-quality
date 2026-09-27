"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type FolderColor = "blue" | "black" | "grey" | "yellow" | "orange" | "red";
type FolderSize = "sm" | "md" | "lg";

type FolderProps = {
  color?: FolderColor;
  size?: FolderSize;
  label?: string;
  className?: string;
};

const sizeMap: Record<
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
    tabLeft: "w-9 h-3 rounded-t-lg",
    tabRight: "w-2 h-3 rounded-tr-2xl",
    tabBridge: "w-2 h-2",
    flapBody: "h-9 rounded-b-2xl rounded-tr-2xl",
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
    tabLeft: "w-12 h-4 rounded-t-lg",
    tabRight: "w-2.5 h-4 rounded-tr-[20px]",
    tabBridge: "w-2.5 h-2.5",
    flapBody: "h-12 rounded-b-[20px] rounded-tr-[20px]",
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
    tabLeft: "w-16 h-[22px] rounded-t-xl",
    tabRight: "w-[13px] h-[22px] rounded-tr-[28px]",
    tabBridge: "w-[13px] h-[13px]",
    flapBody: "h-16 rounded-b-[28px] rounded-tr-[28px]",
    papers: "inset-x-8 top-4",
    paperOffset: "top-2",
    paperH: "h-[120px]",
    paperContent: "pt-4 px-4 space-y-1.5",
    label: "bottom-4 left-4 text-xs py-1 px-2 max-w-[calc(100%-32px)]",
    hoverY: -4,
    hoverBackY: -6,
  },
};

const colorMap: Record<
  FolderColor,
  {
    folder: string;
    flap: string;
    paperBack: string;
    paperFront: string;
    paperLine: string;
    paperBorder: string;
    labelBg: string;
    folderBorder: string;
  }
> = {
  blue: {
    folder: "from-[#006AFF] to-[#006AFF]",
    flap: "bg-black/20",
    paperBack: "bg-blue-100/60",
    paperFront: "bg-white",
    paperLine: "bg-blue-200",
    paperBorder: "border-blue-100",
    labelBg: "bg-black/20",
    folderBorder: "border-white/20",
  },
  black: {
    folder: "from-neutral-800 to-neutral-900",
    flap: "bg-neutral-600/50",
    paperBack: "bg-neutral-500/60",
    paperFront: "bg-neutral-100",
    paperLine: "bg-neutral-300",
    paperBorder: "border-neutral-500",
    labelBg: "bg-white/10",
    folderBorder: "border-white/10",
  },
  yellow: {
    folder: "from-yellow-400 to-yellow-500",
    flap: "bg-yellow-200/50",
    paperBack: "bg-yellow-100/60",
    paperFront: "bg-yellow-50",
    paperLine: "bg-yellow-400/40",
    paperBorder: "border-yellow-200",
    labelBg: "bg-yellow-800/20",
    folderBorder: "border-white/30",
  },
  orange: {
    folder: "from-orange-400 to-orange-500",
    flap: "bg-orange-300/50",
    paperBack: "bg-orange-100/60",
    paperFront: "bg-orange-50",
    paperLine: "bg-orange-400/40",
    paperBorder: "border-orange-200",
    labelBg: "bg-orange-900/20",
    folderBorder: "border-white/30",
  },
  red: {
    folder: "from-red-400 to-red-500",
    flap: "bg-red-300/50",
    paperBack: "bg-red-100/60",
    paperFront: "bg-red-50",
    paperLine: "bg-red-400/40",
    paperBorder: "border-red-200",
    labelBg: "bg-red-900/20",
    folderBorder: "border-white/30",
  },
  grey: {
    folder: "from-gray-400 to-gray-500",
    flap: "bg-gray-300/50",
    paperBack: "bg-gray-200/60",
    paperFront: "bg-gray-100",
    paperLine: "bg-gray-400/40",
    paperBorder: "border-gray-300",
    labelBg: "bg-gray-800/20",
    folderBorder: "border-white/40",
  },
};

const spring = { type: "spring", stiffness: 300, damping: 22 } as const;

export const Folder = ({
  color = "blue",
  size = "lg",
  label,
  className,
}: FolderProps) => {
  const c = colorMap[color];
  const s = sizeMap[size];

  return (
    <motion.div
      aria-label="Folder"
      initial="rest"
      whileHover="hover"
      animate="rest"
      variants={{ rest: {}, hover: {} }}
      className={cn(
        "relative cursor-pointer overflow-hidden border-t-2 bg-gradient-to-b",
        s.container,
        c.folder,
        c.folderBorder,
        className
      )}
    >
      {/* Front flap */}
      <div className="absolute right-0 bottom-0 left-0 z-20">
        <div className="flex items-end">
          <div className={cn(s.tabLeft, "backdrop-blur-sm", c.flap)} />
        </div>
        <div
          className={cn(s.flapBody, "backdrop-blur-sm", c.flap)}
        />
      </div>

      {/* Papers */}
      <div className={cn("absolute z-10", s.papers)}>
        {/* Back paper — fans right */}
        <motion.div
          variants={{
            rest: { rotate: 4, y: 0, transition: spring },
            hover: { rotate: 6, y: s.hoverBackY, transition: spring },
          }}
          style={{ originY: 1 }}
          className={cn(
            "absolute inset-x-0 rounded-2xl",
            s.paperOffset,
            s.paperH,
            c.paperBack
          )}
        />
        {/* Back paper — fans left */}
        <motion.div
          variants={{
            rest: { rotate: -4, y: 0, transition: spring },
            hover: { rotate: -6, y: s.hoverBackY, transition: spring },
          }}
          style={{ originY: 1 }}
          className={cn(
            "absolute inset-x-0 rounded-2xl",
            s.paperOffset,
            s.paperH,
            c.paperBack
          )}
        />
        {/* Front paper — lifts straight up */}
        <motion.div
          variants={{
            rest: { y: 0, transition: spring },
            hover: { y: s.hoverY, transition: spring },
          }}
          className={cn(
            "absolute inset-x-0 top-0 rounded-xl border-t",
            s.paperH,
            c.paperFront,
            c.paperBorder
          )}
        >
          <div className={s.paperContent}>
            <div className={cn("h-1 w-3/4 rounded-full", c.paperLine)} />
            <div className={cn("h-1 w-1/2 rounded-full", c.paperLine)} />
            <div className={cn("h-1 w-2/3 rounded-full", c.paperLine)} />
          </div>
        </motion.div>
      </div>

      {/* Label */}
      {label && (
        <div className={cn("absolute z-20 rounded-full flex items-center overflow-hidden", s.label, c.labelBg)}>
          <span className="font-medium text-white truncate block w-full text-left">{label}</span>
        </div>
      )}
    </motion.div>
  );
};

export default Folder;
