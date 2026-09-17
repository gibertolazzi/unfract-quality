"use client";

import React, { useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChatSidebar } from '@/components/unfract/chat/ChatSidebar';
import { ChatWindow } from '@/components/unfract/chat/ChatWindow';
import { MessageSquarePlus } from 'lucide-react';

export default function ChatPage() {
  const { activeChatId, isLoadingChats } = useChat();

  return (
    <div className="flex h-full w-full bg-black text-white relative overflow-hidden">
      <ChatSidebar />
      <div className="flex-1 flex flex-col my-4 mx-4 rounded-[32px] border border-white/[0.08] bg-[#090909]/80 backdrop-blur-[40px] overflow-hidden relative z-10 h-[calc(100%-2rem)]">
        {activeChatId ? (
          <ChatWindow chatId={activeChatId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#858585]">
            <MessageSquarePlus size={48} className="mb-4" />
            <h2 className="text-xl font-semibold mb-2 text-white/60">Seleziona una chat</h2>
            <p className="text-sm">Inizia a collaborare col tuo team</p>
          </div>
        )}
      </div>
    </div>
  );
}
