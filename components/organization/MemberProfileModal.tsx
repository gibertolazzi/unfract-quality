'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Folder, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { OrgMember } from '@/types/organization';
import { ProjectMemberAccess, CustomRole, AppModule, PermissionLevel } from '@/types/iam';
import { useProject } from '@/contexts/ProjectContext';
import { useTranslation } from '@/contexts/TranslationContext';

const MODULES: { id: AppModule; labelKey: 'crm' | 'tasks' | 'documentation' | 'settings' }[] = [
  { id: 'crm', labelKey: 'crm' },
  { id: 'tasks', labelKey: 'tasks' },
  { id: 'documentation', labelKey: 'documentation' },
  { id: 'settings', labelKey: 'settings' }
];

interface MemberProfileModalProps {
  member: OrgMember;
  onClose: () => void;
}

export function MemberProfileModal({ member, onClose }: MemberProfileModalProps) {
  const { t } = useTranslation();
  const { projects } = useProject();
  const [accesses, setAccesses] = useState<(ProjectMemberAccess & { projectName: string; roleName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectRoles, setProjectRoles] = useState<CustomRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<Record<AppModule, PermissionLevel>>({
    crm: 'none', tasks: 'none', documentation: 'none', settings: 'none'
  });

  useEffect(() => {
    // 1. Fetch all accesses for this user
    const unsub = onSnapshot(query(collection(db, 'project_members'), where('userId', '==', member.uid)), async (snap) => {
      const accessList: (ProjectMemberAccess & { projectName: string; roleName: string })[] = [];
      
      for (const d of snap.docs) {
        const access = d.data() as ProjectMemberAccess;
        const project = projects.find(p => p.id === access.projectId);
        if (!project) continue; // Skip if project not found or not part of this org (if filtered)
        
        let roleName = t.organization.noRoleDefault;
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
  }, [member.uid, projects, t]);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectRoles([]);
      return;
    }
    const unsub = onSnapshot(query(collection(db, 'project_roles'), where('projectId', '==', selectedProjectId)), (snap) => {
      setProjectRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole)));
    });
    return () => unsub();
  }, [selectedProjectId]);

  const handleAssignAccess = async () => {
    if (!selectedProjectId) return;
    
    let finalRoleId = selectedRoleId;
    
    // Create new role if requested
    if (isCreatingRole && newRoleName.trim()) {
      const roleRef = doc(collection(db, 'project_roles'));
      await setDoc(roleRef, {
        projectId: selectedProjectId,
        name: newRoleName,
        permissions: newRolePerms,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      finalRoleId = roleRef.id;
    }
    
    if (finalRoleId === 'none' || !finalRoleId) return;

    const accessRef = doc(db, 'project_members', `${selectedProjectId}_${member.uid}`);
    await setDoc(accessRef, {
      projectId: selectedProjectId,
      userId: member.uid, // it's a user, not a team
      roleId: finalRoleId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    setIsAssigning(false);
    setSelectedProjectId('');
    setSelectedRoleId('');
    setIsCreatingRole(false);
    setNewRoleName('');
    setNewRolePerms({ crm: 'none', tasks: 'none', documentation: 'none', settings: 'none' });
  };

  const handleRemoveAccess = async (accessId: string) => {
    await deleteDoc(doc(db, 'project_members', accessId));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-[24px] shadow-2xl relative w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center text-lg font-semibold text-[#858585]">
              {member.initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{member.displayName}</h2>
              <p className="text-[#858585] text-sm">{member.email} • {member.role === 'admin' ? t.organization.admin : t.organization.member}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-[#858585] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 bg-[#050505] overflow-y-auto flex-1">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#0D6EFD]" />
            {t.organization.assignedRolesInProjects}
          </h3>
          
          {loading ? (
            <p className="text-[#858585] text-sm">{t.organization.loadingPermissions}</p>
          ) : accesses.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl">
              <ShieldAlert size={32} className="text-[#858585] mb-2 opacity-50" />
              <p className="text-[#858585] text-sm">{t.organization.noCustomRolesAssigned}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {accesses.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-white/10 rounded-xl shrink-0">
                  <div className="flex items-center gap-3">
                    <Folder size={16} className="text-[#006AFF]" />
                    <span className="text-white text-sm font-medium">{acc.projectName}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-[#858585]">
                      {acc.roleName}
                    </span>
                    <button onClick={() => handleRemoveAccess(acc.id)} className="p-1.5 text-[#858585] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors ml-2">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ASSEGNAMENTO RUOLI */}
          <div className="mt-6 border-t border-white/10 pt-6">
            {!isAssigning ? (
              <button 
                onClick={() => setIsAssigning(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-colors text-sm"
              >
                {t.organization.manageRoleBtn}
              </button>
            ) : (
              <div className="bg-[#111] border border-white/10 rounded-xl p-4 flex flex-col gap-4">
                <h4 className="text-white text-sm font-medium">{t.organization.newAssignment}</h4>
                
                <div>
                  <label className="block text-xs font-medium text-[#858585] mb-1.5 uppercase tracking-wider">{t.organization.project}</label>
                  <select 
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0D6EFD]"
                  >
                    <option value="">{t.organization.selectProject}</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {selectedProjectId && (
                  <div>
                    <label className="block text-xs font-medium text-[#858585] mb-1.5 uppercase tracking-wider">{t.organization.role}</label>
                    <select 
                      value={selectedRoleId}
                      onChange={(e) => {
                        setSelectedRoleId(e.target.value);
                        setIsCreatingRole(e.target.value === 'CREATE_NEW');
                      }}
                      className="w-full bg-[#050505] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0D6EFD]"
                    >
                      <option value="">{t.organization.selectRole}</option>
                      {projectRoles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                      <option value="CREATE_NEW" className="font-bold text-[#0D6EFD]">{t.organization.createNewRoleAction}</option>
                    </select>
                  </div>
                )}

                {isCreatingRole && (
                  <div className="mt-2 bg-[#050505] border border-[#0D6EFD]/30 p-4 rounded-xl flex flex-col gap-4">
                    <h5 className="text-white text-sm font-medium text-[#0D6EFD]">{t.organization.createRole}</h5>
                    <div>
                      <label className="block text-xs font-medium text-[#858585] mb-1.5 uppercase tracking-wider">{t.organization.roleName}</label>
                      <input 
                        type="text" 
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder={t.organization.roleNameInputPlaceholder}
                        className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0D6EFD]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#858585] mb-2 uppercase tracking-wider">{t.organization.modulePermissions}</label>
                      <div className="grid grid-cols-2 gap-3">
                        {MODULES.map(mod => (
                          <div key={mod.id} className="flex flex-col gap-1">
                            <span className="text-xs text-white/70">{t.sidebar[mod.labelKey]}</span>
                            <select
                              value={newRolePerms[mod.id]}
                              onChange={(e) => setNewRolePerms(prev => ({ ...prev, [mod.id]: e.target.value as PermissionLevel }))}
                              className="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#0D6EFD]"
                            >
                              <option value="none">{t.organization.noAccess}</option>
                              <option value="read">{t.organization.readOnly}</option>
                              <option value="write">{t.organization.readWrite}</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 mt-2">
                  <button onClick={() => {
                    setIsAssigning(false);
                    setSelectedProjectId('');
                    setSelectedRoleId('');
                    setIsCreatingRole(false);
                  }} className="px-4 py-2 text-sm font-medium text-[#858585] hover:text-white transition-colors rounded-full">
                    {t.common.cancel}
                  </button>
                  <button 
                    onClick={handleAssignAccess}
                    disabled={!selectedProjectId || !selectedRoleId || (isCreatingRole && !newRoleName.trim())}
                    className="px-4 py-2 text-sm font-medium bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full hover:bg-[#003B80]/80 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {t.common.confirm}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
