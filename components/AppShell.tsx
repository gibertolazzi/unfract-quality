"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/unfract/Sidebar";
import { TopBar } from "@/components/unfract/TopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = pathname?.startsWith('/book');

  if (isPublicRoute) {
    return (
      <div className="flex h-screen bg-[#0B0B0B] text-white font-sans overflow-auto">
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-10">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0B0B0B] text-white font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 pt-0 overflow-hidden">
          <div className="w-full h-full bg-black/20 rounded-[31px] border border-[#1A1A1A] p-8 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
