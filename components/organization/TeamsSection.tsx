"use client";

import React, { useState, useEffect } from 'react';
import { Users, PlusCircle, Trash2, X, ShieldAlert } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { WorkspaceGroup, WorkspaceRole, AccessGrant } from '@/types/workspace';
import { OrgMember } from '@/types/organization';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { TeamIAMModal } from './TeamIAMModal';

interface TeamsSectionProps {
  workspaceId: string;
  workspaceMembers: OrgMember[];
}

export function TeamsSection({ workspaceId, workspaceMembers }: TeamsSectionProps) {
  const { t } = useTranslation();
  const [teams, setTeams] = useState<WorkspaceGroup[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<WorkspaceGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const dialog = useDialog();

  useEffect(() => {
    if (!workspaceId) return;
    
    const q = query(
      collection(db, 'workspace_groups'),
      where('workspaceId', '==', workspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: WorkspaceGroup[] = [];
      snapshot.forEach(doc => {
        loaded.push({ id: doc.id, ...doc.data() } as WorkspaceGroup);
      });
      setTeams(loaded);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  const handleCreateTeam = async () => {
    const name = await dialog.prompt({
      title: t.organization.newTeamTitle,
      message: t.organization.enterNewTeamName,
      placeholder: t.organization.teamNamePlaceholder,
      confirmText: t.organization.create
    });
    
    if (!name || !name.trim()) return;

    try {
      await addDoc(collection(db, 'workspace_groups'), {
        workspaceId,
        name: name.trim(),
        createdAt: serverTimestamp()
      });
      toast.success(t.organization.teamCreated);
    } catch (e) {
      console.error(e);
      toast.error(t.organization.teamCreateError);
    }
  };

  const handleDeleteTeam = async (teamId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await dialog.confirm({
      title: t.organization.deleteTeamTitle,
      message: t.organization.deleteTeamMessage,
      isDestructive: true,
      confirmText: t.common.delete
    });

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'workspace_groups', teamId));
      
      // We should also delete all access_grants where subjectId == teamId
      const grantsQ = query(collection(db, 'access_grants'), where('subjectId', '==', teamId));
      const grantsSnap = await getDocs(grantsQ);
      grantsSnap.forEach(g => {
        deleteDoc(g.ref); // Fire and forget for now
      });

      toast.success(t.organization.teamDeleted);
    } catch (err) {
      console.error(err);
      toast.error(t.organization.teamDeleteError);
    }
  };

  if (loading) return null;

  return (
    <section className="px-2 mt-8 mb-16">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white tracking-tight">{t.organization.teams}</h2>
          <div className="bg-[#1A1A1A] border border-white/5 rounded-full px-2.5 py-0.5 text-[#858585] text-[13px] font-medium flex items-center justify-center min-w-[28px]">
            {teams.length}
          </div>
        </div>
        <button 
          onClick={handleCreateTeam}
          className="h-[40px] px-4 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-xl font-medium flex items-center gap-2 transition-colors hover:bg-[#003B80]/80 text-[13px]"
        >
          <PlusCircle size={16} className="text-[#00A6FF]" />
          {t.organization.newTeamTitle}
        </button>
      </div>
      
      {teams.length === 0 ? (
        <div className="text-center p-8 border border-white/5 bg-[#0A0A0A] rounded-2xl">
          <p className="text-[#858585] text-sm">{t.organization.noTeamsInWorkspace}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div 
              key={team.id} 
              className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all cursor-pointer relative group"
              onClick={() => setSelectedTeam(team)}
            >
              <button 
                onClick={(e) => handleDeleteTeam(team.id, e)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-[#858585] hover:text-red-400 hover:bg-white/5 rounded-full transition-all"
              >
                <Trash2 size={16} />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#006AFF]/10 flex items-center justify-center text-[#006AFF]">
                  <Users size={20} />
                </div>
                <h3 className="text-white font-medium text-lg pr-8 truncate">{team.name}</h3>
              </div>
              
              {/* Fake stats for now, will connect to access_grants later */}
              <div className="text-sm text-[#858585] mb-4">{t.organization.manageMembersArrow}</div>
            </div>
          ))}
        </div>
      )}

      {selectedTeam && (
        <TeamIAMModal 
          team={selectedTeam} 
          workspaceMembers={workspaceMembers} 
          onClose={() => setSelectedTeam(null)} 
        />
      )}
    </section>
  );
}
