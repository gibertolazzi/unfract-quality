"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useProject } from "@/contexts/ProjectContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePathname } from "next/navigation";
import { getWebLLMEngine } from "@/lib/webllm";
import { useEffect } from "react";

import { useState, useRef } from "react";
import { useTranslation } from "@/contexts/TranslationContext";

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
  const { t } = useTranslation();

  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      const hasNativeAI = 'ai' in window && 'languageModel' in (window as any).ai;
      const hasWebGPU = 'gpu' in navigator && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
      
      if (!hasNativeAI && hasWebGPU) {
        getWebLLMEngine(() => {}).catch(e => console.error("WebLLM Preload Error:", e));
      }
    }
  }, [user]);
  
  const { activeProjectId, loading: projLoading } = useProject();
  const { activeWorkspaceId } = useWorkspace();
  const pathname = usePathname();
  
  if (loading) return null;
  
  if (!user) {
    return <LoginScreen />;
  }

  const isOrgRoute = pathname?.startsWith('/organization');
  const isChatRoute = pathname === '/chat';
  const isLocked = !projLoading && !activeProjectId && !isOrgRoute;

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
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 min-h-0 p-2.5 sm:p-3 md:p-6 pt-0 overflow-hidden relative">
          <div className={`w-full h-full min-h-0 bg-black/20 rounded-[18px] sm:rounded-[20px] md:rounded-[31px] border border-[#1A1A1A] p-3 sm:p-4 md:p-8 ${isChatRoute ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'} ${isLocked ? 'filter blur-sm opacity-50 select-none' : ''}`}>
            {children}
          </div>

          {isLocked && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                <div className="w-16 h-16 bg-[#006AFF]/10 text-[#006AFF] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">{t.appShell.lockedTitle}</h2>
                <p className="text-[#858585] text-sm mb-6">
                  {activeWorkspaceId 
                    ? t.appShell.selectOrCreateProject
                    : t.appShell.noWorkspace}
                </p>
                {!activeWorkspaceId && (
                  <button 
                    onClick={async () => {
                      const name = prompt(t.appShell.createWorkspacePrompt);
                      if (name && name.trim()) {
                        const { createPersonalWorkspace } = await import('@/lib/orgWorkspace');

                        try {
                          await createPersonalWorkspace(user.uid, name.trim());

                          // The onSnapshot in WorkspaceContext will automatically pick it up!
                        } catch (e) {
                          console.error(e);
                          alert(t.appShell.createWorkspaceError);
                          alert("Errore durante la creazione del workspace");
                        }
                      }
                    }}
                    className="w-full bg-[#006AFF] hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                  >
                    Crea Workspace
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
