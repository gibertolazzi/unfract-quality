"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { LoginScreen } from "@/components/auth/LoginScreen";

import { useState, useRef } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleEdgeHover = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsMobileMenuOpen(true);
    }, 250);
  };

  const handleEdgeLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };
  const { user, loading } = useAuth();
  
  if (loading) return null;
  
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen bg-[#0B0B0B] text-white font-sans overflow-hidden">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      {/* Edge trigger for sidebar reveal on narrow screens */}
      {!isMobileMenuOpen && (
        <div 
          className="fixed inset-y-0 left-0 w-6 z-[100] md:hidden" 
          onMouseEnter={handleEdgeHover}
          onMouseLeave={handleEdgeLeave}
        />
      )}

      {/* Mobile overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[90] md:hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 p-3 md:p-6 pt-0 overflow-hidden">
          <div className="w-full h-full bg-black/20 rounded-[20px] md:rounded-[31px] border border-[#1A1A1A] p-4 md:p-8 overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
