"use client";

import React, { useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { MessageSquarePlus, Menu } from "lucide-react";
import { useTranslation } from '@/contexts/TranslationContext';

export default function ChatPage() {
  const { activeChatId, isLoadingChats } = useChat();
  const { t } = useTranslation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 w-full bg-black text-white relative overflow-hidden">
      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Wrapper */}
      <div className={`
        absolute md:relative z-50 md:z-10 h-full md:h-auto
        transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'}
      `}>
        <ChatSidebar onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col my-4 mx-4 rounded-[32px] border border-white/[0.08] bg-[#090909]/80 backdrop-blur-[40px] overflow-hidden relative z-10">
        {activeChatId ? (
          <ChatWindow chatId={activeChatId} onOpenSidebar={() => setIsMobileSidebarOpen(true)} />
        ) : (
          <div className="flex-1 flex flex-col relative text-[#858585]">
            {/* Mobile Header for empty state */}
            <div className="md:hidden absolute top-4 left-4 z-20">
              <button 
                onClick={() => setIsMobileSidebarOpen(true)}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center backdrop-blur-sm"
              >
                <Menu size={20} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <MessageSquarePlus size={48} className="mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-white/60">{t.chatUi.selectChat}</h2>
              <p className="text-sm">{t.chatUi.startCollaborating}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
