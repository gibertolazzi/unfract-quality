import React, { useState } from 'react';
import { X, UserPlus, Shield, Trash2, Edit2, Save } from 'lucide-react';
import { Chat, ChatPermissions } from '@/lib/chat';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useTranslation } from '@/contexts/TranslationContext';
import { activeMembers } from '@/lib/orgMembers';

interface ChatSettingsModalProps {
  chat: Chat;
  onClose: () => void;
}

export function ChatSettingsModal({ chat, onClose }: ChatSettingsModalProps) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const { organizations } = useOrganization();
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(chat.name || '');

  // Get project members
  const orgIds = activeProject?.organizationIds || [];
  const projectOrgs = organizations.filter(org => orgIds.includes(org.id));
  const allMembers = projectOrgs.flatMap(org => activeMembers(org.members)).reduce((acc, current) => {
    const x = acc.find((item: any) => item.uid === current.uid);
    return !x ? acc.concat([current]) : acc;
  }, [] as any[]);

  const nonMembers = allMembers.filter(m => !chat.members.includes(m.uid));
  const currentMembers = allMembers.filter(m => chat.members.includes(m.uid));

  const isLegacy = !chat.creatorId;
  const myPermissions = chat.permissions?.[user?.uid || ''] || { canWrite: true, canAddMembers: true, canEditChannel: chat.creatorId === user?.uid || isLegacy };
  const canEditChannel = myPermissions.canEditChannel || chat.creatorId === user?.uid || isLegacy;
  const canAddMembers = myPermissions.canAddMembers || canEditChannel;

  const handleUpdateName = async () => {
    if (!canEditChannel || !newName.trim()) return;
    try {
      await updateDoc(doc(db, 'chats', chat.id), { name: newName.trim() });
      setEditingName(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!canAddMembers) return;
    try {
      const newPerms = { ...(chat.permissions || {}) };
      newPerms[userId] = { canWrite: true, canAddMembers: false, canEditChannel: false };
      
      await updateDoc(doc(db, 'chats', chat.id), {
        members: arrayUnion(userId),
        permissions: newPerms
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!canEditChannel) return;
    try {
      const newPerms = { ...(chat.permissions || {}) };
      delete newPerms[userId];

      await updateDoc(doc(db, 'chats', chat.id), {
        members: arrayRemove(userId),
        permissions: newPerms
      });
    } catch (e) {
      console.error(e);
    }
  };

  const togglePermission = async (userId: string, perm: keyof ChatPermissions) => {
    if (!canEditChannel) return;
    try {
      const currentPerms = chat.permissions?.[userId] || { canWrite: true, canAddMembers: false, canEditChannel: false };
      const newPerms = { ...chat.permissions, [userId]: { ...currentPerms, [perm]: !currentPerms[perm] } };
      
      await updateDoc(doc(db, 'chats', chat.id), {
        permissions: newPerms
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
          <h2 className="text-white font-medium">{t.chatUi.settings}</h2>
          <button onClick={onClose} className="text-[#858585] hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1 space-y-6">
          {/* Channel Name */}
          <div>
            <h3 className="text-xs font-semibold text-[#858585] uppercase tracking-wider mb-2">{t.chatUi.channelNameLabel}</h3>
            <div className="flex items-center gap-2">
              {editingName ? (
                <>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:border-[#00FF88] outline-none"
                  />
                  <button onClick={handleUpdateName} className="p-1.5 bg-[#00FF88]/20 text-[#00FF88] rounded hover:bg-[#00FF88]/30">
                    <Save size={16} />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-white text-sm flex-1"># {chat.name}</span>
                  {canEditChannel && (
                    <button onClick={() => setEditingName(true)} className="p-1 text-[#858585] hover:text-white">
                      <Edit2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Members */}
          <div>
            <h3 className="text-xs font-semibold text-[#858585] uppercase tracking-wider mb-2">{t.chatUi.membersPermissions}</h3>
            <div className="space-y-2">
              {currentMembers.map(m => {
                const isCreator = m.uid === chat.creatorId;
                const perms = chat.permissions?.[m.uid] || { canWrite: true, canAddMembers: false, canEditChannel: false };
                return (
                  <div key={m.uid} className="bg-white/5 border border-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={m.photoURL}
                          name={m.displayName}
                          initials={m.initials}
                          className="w-6 h-6 rounded-full bg-[#006AFF] flex items-center justify-center text-[10px] font-bold text-white overflow-hidden"
                          imageClassName="w-full h-full object-cover"
                        />
                        <span className="text-sm text-white/90">{m.displayName} {isCreator && <span className="text-xs text-[#00FF88] ml-1">({t.chatUi.creator})</span>}</span>
                      </div>
                      {canEditChannel && !isCreator && m.uid !== user?.uid && (
                        <button onClick={() => handleRemoveMember(m.uid)} className="text-[#858585] hover:text-[#FF0004]">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    
                    {/* Permissions Toggles */}
                    <div className="flex flex-col gap-1 ml-8">
                      <label className="flex items-center gap-2 text-xs text-[#858585]">
                        <input 
                          type="checkbox" 
                          checked={perms.canWrite}
                          onChange={() => togglePermission(m.uid, 'canWrite')}
                          disabled={!canEditChannel || isCreator}
                          className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {t.chatUi.canWrite}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#858585]">
                        <input 
                          type="checkbox" 
                          checked={perms.canAddMembers}
                          onChange={() => togglePermission(m.uid, 'canAddMembers')}
                          disabled={!canEditChannel || isCreator}
                          className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {t.chatUi.canAddMembers}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#858585]">
                        <input 
                          type="checkbox" 
                          checked={perms.canEditChannel}
                          onChange={() => togglePermission(m.uid, 'canEditChannel')}
                          disabled={!canEditChannel || isCreator}
                          className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')] disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {t.chatUi.canEditChannel}
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Member */}
          {canAddMembers && nonMembers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#858585] uppercase tracking-wider mb-2">{t.chatUi.addMembers}</h3>
              <div className="space-y-1">
                {nonMembers.map(m => (
                  <div key={m.uid} className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80">{m.displayName}</span>
                    <button onClick={() => handleAddMember(m.uid)} className="text-[#006AFF] hover:text-[#0055FF]">
                      <UserPlus size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
