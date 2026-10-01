'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Users, Key, Plus, Check, X, ShieldAlert, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, doc, setDoc, serverTimestamp, onSnapshot, deleteDoc } from 'firebase/firestore';
import { CustomRole, AppModule, PermissionLevel, ProjectMemberAccess, AccessRequest } from '@/types/iam';
import { OrgMember } from '@/types/organization';
import { assignUserRole, resolveAccessRequest } from '@/lib/services/iamService';
import { Project } from '@/contexts/ProjectContext';
import { Organization } from './types';

const MODULES: { id: AppModule; label: string }[] = [
  { id: 'crm', label: 'CRM' },
  { id: 'tasks', label: 'Task' },
  { id: 'documentation', label: 'Documentazione' },
  { id: 'settings', label: 'Impostazioni' }
];

interface ProjectIAMModalProps {
  project: Project;
  organization: Organization; // The org context we are in
  onClose: () => void;
}

export function ProjectIAMModal({ project, organization, onClose }: ProjectIAMModalProps) {
  const [activeTab, setActiveTab] = useState<'roles' | 'members' | 'teams' | 'requests'>('roles');

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [projectMembersAccess, setProjectMembersAccess] = useState<ProjectMemberAccess[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [teams, setTeams] = useState<any[]>([]); // Using any for WorkspaceGroup to avoid import errors if not exported
  
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<Record<AppModule, PermissionLevel>>({
    crm: 'none', tasks: 'none', documentation: 'none', settings: 'none'
  });

  useEffect(() => {
    // Listen to roles
    const unsubRoles = onSnapshot(query(collection(db, 'project_roles'), where('projectId', '==', project.id)), (snap) => {
      setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomRole)));
    });

    // Listen to member access
    const unsubMembers = onSnapshot(query(collection(db, 'project_members'), where('projectId', '==', project.id)), (snap) => {
      setProjectMembersAccess(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectMemberAccess)));
    });

    // Listen to access requests
    const unsubRequests = onSnapshot(query(collection(db, 'access_requests'), where('projectId', '==', project.id), where('status', '==', 'pending')), (snap) => {
      setAccessRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccessRequest)));
    });

    // Listen to workspace teams
    const unsubTeams = onSnapshot(query(collection(db, 'workspace_groups'), where('workspaceId', '==', organization.id)), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubRoles(); unsubMembers(); unsubRequests(); unsubTeams(); };
  }, [project.id, organization.id]);

  const projectUsers = useMemo(() => {
    return organization.members || [];
  }, [organization]);

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    const roleRef = doc(collection(db, 'project_roles'));
    await setDoc(roleRef, {
      projectId: project.id,
      name: newRoleName,
      permissions: newRolePerms,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    setIsCreatingRole(false);
    setNewRoleName('');
    setNewRolePerms({ crm: 'none', tasks: 'none', documentation: 'none', settings: 'none' });
  };

  const deleteRole = async (id: string) => {
    await deleteDoc(doc(db, 'project_roles', id));
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    if (roleId === 'none') {
      await deleteDoc(doc(db, 'project_members', `${project.id}_${userId}`));
    } else {
      await assignUserRole(project.id, userId, roleId);
    }
  };

  const handleRequestResponse = async (reqId: string, status: 'approved' | 'rejected') => {
    await resolveAccessRequest(reqId, status);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-[24px] shadow-2xl relative w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Permessi Progetto: {project.name}</h2>
            <p className="text-[#858585] text-sm">Gestisci ruoli e accessi per questo progetto.</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-[#858585] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[#1A1A1A] p-4 shrink-0 bg-[#0A0A0A]">
          <button 
            onClick={() => setActiveTab('roles')}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 text-[14px] rounded-xl font-medium transition-colors ${activeTab === 'roles' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <ShieldCheck size={16} /> Ruoli Custom
          </button>
          <button 
            onClick={() => setActiveTab('members')}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 text-[14px] rounded-xl font-medium transition-colors ${activeTab === 'members' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Users size={16} /> Assegnazione Membri
          </button>
          
          {organization.structureMode === 'teams' && (
            <button 
              onClick={() => setActiveTab('teams')}
              className={`flex shrink-0 items-center gap-2 px-4 py-2 text-[14px] rounded-xl font-medium transition-colors ${activeTab === 'teams' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
            >
              <Users size={16} /> Squadre (Teams)
            </button>
          )}

          <button 
            onClick={() => setActiveTab('requests')}
            className={`flex shrink-0 items-center gap-2 px-4 py-2 text-[14px] rounded-xl font-medium transition-colors ${activeTab === 'requests' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Key size={16} /> Richieste Accesso {accessRequests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{accessRequests.length}</span>}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#050505]">
          
          {/* Roles Tab */}
          {activeTab === 'roles' && (
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-white">Ruoli del Progetto</h3>
                <button 
                  onClick={() => setIsCreatingRole(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-xl font-medium hover:bg-[#003B80]/80 transition-colors"
                >
                  <Plus size={16} /> Crea Ruolo
                </button>
              </div>

              {isCreatingRole && (
                <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 shadow-lg">
                  <h4 className="text-md font-medium text-white mb-4">Nuovo Ruolo</h4>
                  <input 
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    placeholder="Es. Stagista Marketing"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white mb-6 focus:outline-none focus:border-[#0D6EFD]"
                  />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {MODULES.map(mod => (
                      <div key={mod.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                        <span className="text-white font-medium text-sm">{mod.label}</span>
                        <select 
                          value={newRolePerms[mod.id]}
                          onChange={(e) => setNewRolePerms(prev => ({ ...prev, [mod.id]: e.target.value as PermissionLevel }))}
                          className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#0D6EFD]"
                        >
                          <option value="none">Nessun Accesso</option>
                          <option value="read">Sola Lettura</option>
                          <option value="write">Lettura / Scrittura</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setIsCreatingRole(false)} className="px-4 py-2 rounded-xl text-[#858585] hover:bg-white/5 text-sm">Annulla</button>
                    <button onClick={handleCreateRole} disabled={!newRoleName.trim()} className="px-4 py-2 bg-[#006AFF] text-white rounded-xl font-medium disabled:opacity-50 text-sm">Salva Ruolo</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.map(role => (
                  <div key={role.id} className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-5 relative group">
                    <div className="flex justify-between items-start mb-4">
                      <h5 className="text-md font-semibold text-white">{role.name}</h5>
                      <button onClick={() => deleteRole(role.id)} className="text-[#858585] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MODULES.map(mod => {
                        const perm = role.permissions[mod.id];
                        if (perm === 'none') return null;
                        return (
                          <div key={mod.id} className={`px-2 py-1 rounded-md text-[11px] font-medium border ${perm === 'write' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                            {mod.label}: {perm === 'write' ? 'Write' : 'Read'}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {roles.length === 0 && !isCreatingRole && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                    <ShieldAlert size={48} className="text-[#858585] mb-4 opacity-50" />
                    <p className="text-[#858585]">Nessun ruolo custom creato.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="flex flex-col gap-4">
              {projectUsers.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[#858585]">Nessun membro nell'organizzazione.</p>
                </div>
              )}

              {projectUsers.map(user => {
                const currentAccess = projectMembersAccess.find(a => a.userId === user.uid);
                const isOwner = project.userId === user.uid;
                
                return (
                  <div key={user.uid} className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center text-sm font-semibold text-[#858585]">
                        {user.initials}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{user.displayName} {isOwner && <span className="ml-2 text-[10px] bg-[#FFB800]/20 text-[#FFB800] px-2 py-0.5 rounded-full">Owner</span>}</p>
                        <p className="text-[#858585] text-xs">{user.email}</p>
                      </div>
                    </div>
                    
                    {!isOwner && (
                      <select
                        value={currentAccess?.roleId || 'none'}
                        onChange={(e) => {
                          if (e.target.value === 'CREATE_NEW_ROLE') {
                            setActiveTab('roles');
                            setIsCreatingRole(true);
                          } else {
                            handleAssignRole(user.uid, e.target.value);
                          }
                        }}
                        className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#0D6EFD]"
                      >
                        <option value="none">Nessun Ruolo (Default)</option>
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                        <option value="CREATE_NEW_ROLE" className="font-bold text-[#0D6EFD]">+ Crea nuovo ruolo</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div className="flex flex-col gap-4">
              {teams.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[#858585]">Nessuna squadra presente in questo Workspace.</p>
                </div>
              )}

              {teams.map(team => {
                const currentAccess = projectMembersAccess.find(a => a.userId === team.id); // For teams, userId holds the team.id
                
                return (
                  <div key={team.id} className="flex items-center justify-between p-4 bg-[#0A0A0A] border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#006AFF]/10 flex items-center justify-center text-[#006AFF]">
                        <Users size={20} />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{team.name}</p>
                        <p className="text-[#858585] text-xs">Squadra</p>
                      </div>
                    </div>
                    
                    <select
                      value={currentAccess?.roleId || 'none'}
                      onChange={(e) => {
                        if (e.target.value === 'CREATE_NEW_ROLE') {
                          setActiveTab('roles');
                          setIsCreatingRole(true);
                        } else {
                          handleAssignRole(team.id, e.target.value);
                        }
                      }}
                      className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#0D6EFD]"
                    >
                      <option value="none">Nessun Accesso (Default)</option>
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                      <option value="CREATE_NEW_ROLE" className="font-bold text-[#0D6EFD]">+ Crea nuovo ruolo</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div className="flex flex-col gap-4">
              {accessRequests.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                  <p className="text-[#858585]">Nessuna richiesta di accesso pendente.</p>
                </div>
              )}

              {accessRequests.map(req => {
                const user = projectUsers.find(u => u.uid === req.userId);
                
                return (
                  <div key={req.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-[#0A0A0A] border border-yellow-500/30 rounded-xl gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-white text-sm">
                        <span className="font-semibold">{user ? user.displayName : req.userId}</span> ha richiesto i permessi di <span className="font-semibold text-yellow-500">{req.requestedLevel === 'write' ? 'Scrittura' : 'Lettura'}</span>
                      </p>
                      <p className="text-xs text-[#858585]">
                        Modulo: <span className="text-white capitalize">{req.module}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleRequestResponse(req.id, 'rejected')} className="px-3 py-1.5 rounded-lg text-[#858585] hover:bg-white/5 transition-colors text-sm">
                        Rifiuta
                      </button>
                      <button onClick={() => handleRequestResponse(req.id, 'approved')} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors text-sm">
                        <Check size={14} /> Approva
                      </button>
                    </div>
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
