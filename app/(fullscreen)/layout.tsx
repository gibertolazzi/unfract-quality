import React from "react";

export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen bg-[#050505] text-white overflow-hidden m-0 p-0">
      {children}
    </div>
  );
}
