"use client";

import React, { useState, useEffect } from 'react';
import { X, Users, Search, PlusCircle, Trash2, Shield } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { WorkspaceGroup, AccessGrant } from '@/types/workspace';
import { OrgMember } from '@/types/organization';
import { useToast } from '@/contexts/ToastContext';

interface TeamIAMModalProps {
  team: WorkspaceGroup;
  workspaceMembers: OrgMember[];
  onClose: () => void;
}

export function TeamIAMModal({ team, workspaceMembers, onClose }: TeamIAMModalProps) {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const toast = useToast();

  useEffect(() => {
    // Fetch who is in this team (who has a grant for resourceType = 'workspace_group', resourceId = team.id)
    const q = query(
      collection(db, 'access_grants'),
      where('resourceType', '==', 'workspace_group'),
      where('resourceId', '==', team.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: AccessGrant[] = [];
      snapshot.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() } as AccessGrant);
      });
      setGrants(loaded);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [team.id]);

  const handleAddMember = async (member: OrgMember) => {
    // Prevent duplicate
    if (grants.some(g => g.subjectId === member.uid)) {
      toast.error("Utente già presente nella squadra.");
      return;
    }

    try {
      await addDoc(collection(db, 'access_grants'), {
        workspaceId: team.workspaceId,
        subjectType: 'user',
        subjectId: member.uid,
        resourceType: 'workspace_group',
        resourceId: team.id,
        role: 'member',
        createdAt: serverTimestamp()
      });
      toast.success("Membro aggiunto alla squadra!");
    } catch (e) {
      console.error(e);
      toast.error("Errore durante l'aggiunta.");
    }
  };

  const handleRemoveMember = async (grantId: string) => {
    try {
      await deleteDoc(doc(db, 'access_grants', grantId));
      toast.success("Membro rimosso dalla squadra.");
    } catch (e) {
      console.error(e);
      toast.error("Errore durante la rimozione.");
    }
  };

  const filteredWorkspaceMembers = workspaceMembers.filter(m => 
    !grants.some(g => g.subjectId === m.uid) && 
    (m.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-[24px] flex flex-col max-w-2xl w-full h-[80vh] shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#006AFF]/10 flex items-center justify-center text-[#006AFF]">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">{team.name}</h2>
              <p className="text-sm text-[#858585]">Gestisci i membri di questa squadra</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#858585] hover:text-white rounded-full transition-colors hover:bg-white/5">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Membri Attuali */}
          <div className="flex-1 flex flex-col border-r border-white/5 bg-[#080808]">
            <div className="p-4 border-b border-white/5 shrink-0">
              <h3 className="text-sm font-semibold text-white mb-1">Membri della Squadra</h3>
              <p className="text-xs text-[#858585]">{grants.length} persone assegnate</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <p className="text-center text-[#858585] text-sm mt-8">Caricamento...</p>
              ) : grants.length === 0 ? (
                <div className="text-center mt-12">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 mx-auto mb-3">
                    <Shield size={20} />
                  </div>
                  <p className="text-sm text-[#858585]">La squadra è vuota</p>
                </div>
              ) : (
                grants.map(grant => {
                  const userObj = workspaceMembers.find(m => m.uid === grant.subjectId);
                  return (
                    <div key={grant.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex items-center gap-3 truncate">
                        {userObj?.photoURL ? (
                          <img src={userObj.photoURL} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#111] flex items-center justify-center text-xs font-medium text-[#858585]">
                            {userObj?.email?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex flex-col truncate">
                          <span className="text-sm text-white font-medium truncate">{userObj?.email || grant.subjectId}</span>
                          <span className="text-xs text-[#858585]">Membro</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveMember(grant.id!)}
                        className="p-1.5 text-[#858585] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Aggiungi dal Workspace */}
          <div className="w-[300px] flex flex-col shrink-0 bg-[#0E0E0E]">
            <div className="p-4 border-b border-white/5 shrink-0">
              <h3 className="text-sm font-semibold text-white mb-3">Aggiungi Persone</h3>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
                <input 
                  type="text" 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca nel workspace..."
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[#006AFF] transition-colors"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredWorkspaceMembers.length === 0 ? (
                <p className="text-center text-[#858585] text-xs mt-4">Nessun utente trovato da aggiungere.</p>
              ) : (
                filteredWorkspaceMembers.map(member => (
                  <div 
                    key={member.uid} 
                    onClick={() => handleAddMember(member)}
                    className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {member.photoURL ? (
                        <img src={member.photoURL} alt="" className="w-6 h-6 rounded-full shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#222] flex items-center justify-center text-[10px] font-medium text-[#858585] shrink-0">
                          {member.email.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs text-white/80 truncate group-hover:text-white transition-colors">{member.email}</span>
                    </div>
                    <PlusCircle size={14} className="text-[#006AFF] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
