'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Folder, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { OrgMember } from '@/types/organization';
import { ProjectMemberAccess, CustomRole } from '@/types/iam';
import { useProject } from '@/contexts/ProjectContext';

interface MemberProfileModalProps {
  member: OrgMember;
  onClose: () => void;
}

export function MemberProfileModal({ member, onClose }: MemberProfileModalProps) {
  const { projects } = useProject();
  const [accesses, setAccesses] = useState<(ProjectMemberAccess & { projectName: string; roleName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch all accesses for this user
    const unsub = onSnapshot(query(collection(db, 'project_members'), where('userId', '==', member.uid)), async (snap) => {
      const accessList: (ProjectMemberAccess & { projectName: string; roleName: string })[] = [];
      
      for (const d of snap.docs) {
        const access = d.data() as ProjectMemberAccess;
        const project = projects.find(p => p.id === access.projectId);
        if (!project) continue; // Skip if project not found or not part of this org (if filtered)
        
        let roleName = 'Ruolo Sconosciuto';
        try {
          const roleSnap = await getDoc(doc(db, 'project_roles', access.roleId));
          if (roleSnap.exists()) {
            roleName = (roleSnap.data() as CustomRole).name;
          }
        } catch (e) {}

        accessList.push({ ...access, id: d.id, projectName: project.name, roleName });
      }
      
      setAccesses(accessList);
      setLoading(false);
    });

    return () => unsub();
  }, [member.uid, projects]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-[24px] shadow-2xl relative w-full max-w-lg flex flex-col overflow-hidden">
        
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-lg font-semibold text-[#858585]">
              {member.initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{member.displayName}</h2>
              <p className="text-[#858585] text-sm">{member.email} • {member.role === 'admin' ? 'Amministratore' : 'Membro'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-[#858585] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 bg-[#050505]">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#0D6EFD]" />
            Ruoli Assegnati nei Progetti
          </h3>
          
          {loading ? (
            <p className="text-[#858585] text-sm">Caricamento permessi...</p>
          ) : accesses.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl">
              <ShieldAlert size={32} className="text-[#858585] mb-2 opacity-50" />
              <p className="text-[#858585] text-sm">Nessun ruolo custom assegnato.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {accesses.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-white/10 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Folder size={16} className="text-[#006AFF]" />
                    <span className="text-white text-sm font-medium">{acc.projectName}</span>
                  </div>
                  <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-[#858585]">
                    {acc.roleName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
