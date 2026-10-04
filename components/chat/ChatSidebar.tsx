"use client";

import React, { useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Hash, Users, Plus, X, Trash2 } from 'lucide-react';
import { createChat } from '@/lib/chat';
import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { UserAvatar } from '@/components/shared/UserAvatar';

export function ChatSidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const { chats, activeChatId, setActiveChatId, isLoadingChats, unreadCounts } = useChat();
  const { user } = useAuth();
  const { activeProject, activeProjectId } = useProject();
  const { organizations } = useOrganization();

  // Get project members
  const orgIds = activeProject?.organizationIds || [];
  const projectOrgs = organizations.filter(org => orgIds.includes(org.id));
  const members = projectOrgs.flatMap(org => org.members || []).reduce((acc, current) => {
    const x = acc.find((item: any) => item.uid === current.uid);
    return !x ? acc.concat([current]) : acc;
  }, [] as any[]);

  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  
  const [isCreatingDM, setIsCreatingDM] = useState(false);
  const [newDMUser, setNewDMUser] = useState('');

  const channels = chats.filter(c => c.type === 'channel');
  const dms = chats.filter(c => c.type === 'direct');

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string, chatName: string) => {
    e.stopPropagation();
    if (window.confirm(`Sei sicuro di voler eliminare la chat "${chatName}"? Questa operazione è irreversibile.`)) {
      try {
        await deleteDoc(doc(db, 'chats', chatId));
        if (activeChatId === chatId) {
          setActiveChatId(null);
        }
      } catch (error) {
        console.error("Errore nell'eliminazione della chat", error);
      }
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim() || !activeProjectId || !user) return;
    try {
      const chatId = await createChat(activeProjectId, 'channel', [user.uid], newChannelName.trim(), user.uid);
      setActiveChatId(chatId);
      setIsCreatingChannel(false);
      setNewChannelName('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateDM = async (targetUserId: string, targetUserName: string) => {
    if (!activeProjectId || !user) return;
    try {
      // Check if DM already exists
      const existingDM = dms.find(dm => dm.members.includes(targetUserId) && dm.members.length === 2);
      if (existingDM) {
        setActiveChatId(existingDM.id);
      } else {
        const chatId = await createChat(activeProjectId, 'direct', [user.uid, targetUserId], targetUserName, user.uid);
        setActiveChatId(chatId);
      }
      setIsCreatingDM(false);
      setNewDMUser('');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="w-[320px] shrink-0 my-4 ml-4 p-5 flex flex-col relative z-10 rounded-[32px] border border-white/[0.08] bg-[#0a0a0a] md:bg-black/40 backdrop-blur-[40px] h-[calc(100%-2rem)]">
      <div className="pb-4 border-b border-white/5 mb-2 flex items-center justify-between">
        <h2 className="font-medium text-white/90 text-[14px] tracking-wide">Team Chat</h2>
        {onCloseMobile && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden text-[#858585] hover:text-white bg-white/5 p-1.5 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pt-2 pr-2">
        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">Canali</span>
            <button onClick={() => setIsCreatingChannel(true)} className="text-[#858585] hover:text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>
          {isCreatingChannel && (
            <form onSubmit={handleCreateChannel} className="px-2 mb-2 relative">
              <input
                autoFocus
                type="text"
                placeholder="nome-canale"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 text-sm text-white outline-none focus:border-[#00FF88]"
              />
              <button type="button" onClick={() => setIsCreatingChannel(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#858585] hover:text-white">
                <X size={12} />
              </button>
            </form>
          )}
          {isLoadingChats ? (
            <div className="animate-pulse px-2 py-1 bg-white/5 rounded-md w-3/4 mx-2"></div>
          ) : channels.length === 0 ? (
            <p className="text-xs text-[#858585] px-2 italic">Nessun canale</p>
          ) : (
            <div className="space-y-1">
              {channels.map(chat => {
                const unread = unreadCounts[chat.id] || 0;
                return (
                  <div key={chat.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => { setActiveChatId(chat.id); if (onCloseMobile) onCloseMobile(); }}
                      className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        activeChatId === chat.id ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Hash size={14} className="shrink-0 opacity-50" />
                        <span className="truncate">{chat.name}</span>
                      </span>
                      {unread > 0 && (
                        <span aria-label={`${unread} messaggi non letti`} className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#006AFF] px-1.5 text-[10px] font-bold leading-none text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Elimina canale ${chat.name || ''}`}
                      onClick={e => handleDeleteChat(e, chat.id, chat.name || 'Chat')}
                      className="shrink-0 rounded p-1 text-[#858585] opacity-0 transition-all hover:bg-[#FF0004]/20 hover:text-[#FF0004] group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-[#858585] uppercase tracking-wider">Messaggi Diretti</span>
            <button onClick={() => setIsCreatingDM(true)} className="text-[#858585] hover:text-white transition-colors">
              <Plus size={14} />
            </button>
          </div>
          {isCreatingDM && (
            <div className="px-2 mb-2 relative">
              <input
                autoFocus
                type="text"
                placeholder="Cerca membro..."
                value={newDMUser}
                onChange={(e) => setNewDMUser(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md py-1 px-2 text-sm text-white outline-none focus:border-blue-500 mb-1"
              />
              <button type="button" onClick={() => setIsCreatingDM(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#858585] hover:text-white">
                <X size={12} />
              </button>
              
              <div className="absolute z-10 w-full left-0 right-0 bg-[#121212] border border-white/10 rounded-lg shadow-xl mt-1 max-h-32 overflow-y-auto">
                {members.filter(m => m.uid !== user?.uid && (m.displayName?.toLowerCase().includes(newDMUser.toLowerCase()) || m.email?.toLowerCase().includes(newDMUser.toLowerCase()))).map(m => (
                  <button
                    key={m.uid}
                    onClick={() => handleCreateDM(m.uid, m.displayName || 'Utente')}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 text-left transition-colors"
                  >
                    <UserAvatar
                      src={m.photoURL}
                      name={m.displayName}
                      initials={m.initials}
                      className="w-5 h-5 rounded-full bg-[#006AFF] flex items-center justify-center text-[8px] font-bold text-white shrink-0 overflow-hidden"
                      imageClassName="w-full h-full object-cover"
                    />
                    <span className="text-sm text-white/90 truncate">{m.displayName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {isLoadingChats ? (
            <div className="animate-pulse px-2 py-1 bg-white/5 rounded-md w-3/4 mx-2"></div>
          ) : dms.length === 0 ? (
            <p className="text-xs text-[#858585] px-2 italic">Nessun DM</p>
          ) : (
            <div className="space-y-1">
              {dms.map(chat => {
                const unread = unreadCounts[chat.id] || 0;
                return (
                  <div key={chat.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => { setActiveChatId(chat.id); if (onCloseMobile) onCloseMobile(); }}
                      className={`flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                        activeChatId === chat.id ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2 overflow-hidden">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                          <Users size={10} className="text-blue-500" />
                        </span>
                        <span className="truncate">{chat.name || 'Nome Utente (Mock)'}</span>
                      </span>
                      {unread > 0 && (
                        <span aria-label={`${unread} messaggi non letti`} className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#006AFF] px-1.5 text-[10px] font-bold leading-none text-white">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Elimina chat ${chat.name || ''}`}
                      onClick={e => handleDeleteChat(e, chat.id, chat.name || 'Utente')}
                      className="shrink-0 rounded p-1 text-[#858585] opacity-0 transition-all hover:bg-[#FF0004]/20 hover:text-[#FF0004] group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
