import React from "react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0B0B0B] text-white font-sans overflow-auto">
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-10">
        {children}
      </main>
    </div>
  );
}
