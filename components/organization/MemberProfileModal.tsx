'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Folder, ShieldCheck, Loader2, UserMinus, UserCheck, UserX, LogOut, Shield, MessageSquareOff, MessageSquare, BellOff, Bell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDoc, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Organization, OrgMember } from '@/types/organization';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/contexts/DialogContext';
import { useToast } from '@/contexts/ToastContext';
import { authedFetch } from '@/lib/authedFetch';
import { formatMessage } from '@/lib/i18n/formatMessage';
import { ProjectMemberAccess, CustomRole, AppModule, PermissionLevel } from '@/types/iam';
import { useProject } from '@/contexts/ProjectContext';
import { useTranslation } from '@/contexts/TranslationContext';

const MODULES: { id: AppModule; labelKey: 'crm' | 'tasks' | 'documentation' | 'settings' }[] = [
  { id: 'crm', labelKey: 'crm' },
  { id: 'tasks', labelKey: 'tasks' },
  { id: 'documentation', labelKey: 'documentation' },
  { id: 'settings', labelKey: 'settings' }
];

type MemberAction = 'remove' | 'suspend' | 'reactivate' | 'role' | 'mute' | 'unmute';

interface MemberProfileModalProps {
  member: OrgMember;
  organization: Organization;
  /** Membri aggiornati dal server dopo un'azione. */
  onMembersChange: (update: Pick<Organization, 'members' | 'memberCount' | 'mutedUids'> & { memberUids: string[] }) => void;
  onClose: () => void;
}

export function MemberProfileModal({ member, organization, onMembersChange, onClose }: MemberProfileModalProps) {
  const { t } = useTranslation();
  const { user, settings, updateSettings } = useAuth();
  const dialog = useDialog();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<MemberAction | null>(null);

  // Stesse regole del server (lib/server/orgMembers.ts): nessuno tocca il
  // proprietario; gli admin gestiscono i membri, solo il proprietario gli
  // admin e i ruoli; ognuno può uscire da solo.
  const me = user?.uid || '';
  const isOwner = organization.ownerId === me;
  const iAmAdmin = isOwner || organization.members?.some(m => m.uid === me && m.role === 'admin' && !m.suspended);
  const isTargetOwner = member.uid === organization.ownerId;
  const isSelf = member.uid === me;
  const canManage = !isSelf && !isTargetOwner && !!iAmAdmin && (member.role !== 'admin' || isOwner);
  const canChangeRole = !isSelf && !isTargetOwner && isOwner;
  const canLeave = isSelf && !isTargetOwner;
  const isMuted = !!organization.mutedUids?.includes(member.uid);
  // Personale: vale solo per chi lo attiva (AuthContext, `settings.mutedUserIds`).
  const hiddenSenders = settings?.mutedUserIds || [];
  const notificationsHidden = hiddenSenders.includes(member.uid);
  const [savingHidden, setSavingHidden] = useState(false);

  const toggleHiddenNotifications = async () => {
    setSavingHidden(true);
    try {
      await updateSettings({
        mutedUserIds: notificationsHidden ? hiddenSenders.filter(uid => uid !== member.uid) : [...hiddenSenders, member.uid],
      });
      toast.success(t.organization.memberUpdated);
    } catch {
      toast.error(t.organization.memberActionError);
    } finally {
      setSavingHidden(false);
    }
  };

  const runAction = async (action: MemberAction, role?: 'admin' | 'member') => {
    const name = action === 'remove' && isSelf ? organization.name : member.displayName;
    const confirm = action === 'remove'
      ? { title: isSelf ? t.organization.leaveConfirmTitle : t.organization.removeConfirmTitle, message: isSelf ? t.organization.leaveConfirm : t.organization.removeConfirm }
      : action === 'suspend'
        ? { title: t.organization.suspendConfirmTitle, message: t.organization.suspendConfirm }
        : null;
    if (confirm) {
      const ok = await dialog.confirm({
        title: formatMessage(confirm.title, { name }),
        message: confirm.message,
        confirmText: action === 'suspend' ? t.organization.suspendMember : isSelf ? t.organization.leaveOrg : t.organization.removeMember,
        isDestructive: true,
      });
      if (!ok) return;
    }

    setBusy(action);
    try {
      const response = await authedFetch('/api/organizations/members', {
        method: 'POST',
        body: JSON.stringify({ orgId: organization.id, uid: member.uid, action, role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t.organization.memberActionError);
      toast.success(t.organization.memberUpdated);
      if (action === 'remove' && isSelf) {
        router.push('/organization');
        return;
      }
      onMembersChange({ members: data.members, memberUids: data.memberUids, memberCount: data.memberCount, mutedUids: data.mutedUids });
      if (action === 'remove') onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.organization.memberActionError);
    } finally {
      setBusy(null);
    }
  };
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
              <p className="text-[#858585] text-sm">
                {member.email} • {isTargetOwner ? t.organization.ownerBadge : member.role === 'admin' ? t.organization.admin : t.organization.member}
                {member.suspended && <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-xs">{t.organization.suspended}</span>}
                {isMuted && <span className="ml-2 px-2 py-0.5 rounded-md bg-white/10 text-[#BBBBBB] text-xs">{t.organization.muted}</span>}
              </p>
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

          {(canManage || canChangeRole || canLeave || !isSelf) && (
            <div className="mt-6 border-t border-white/10 pt-6 flex flex-col gap-2">
              <h3 className="text-white font-medium mb-2">{t.organization.memberSettings}</h3>

              {canChangeRole && !member.suspended && (
                <button
                  onClick={() => runAction('role', member.role === 'admin' ? 'member' : 'admin')}
                  disabled={!!busy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors disabled:opacity-50 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  {busy === 'role' ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} className="text-[#006AFF]" />}
                  {member.role === 'admin' ? t.organization.makeMember : t.organization.makeAdmin}
                </button>
              )}

              {canManage && (member.suspended ? (
                <button
                  onClick={() => runAction('reactivate')}
                  disabled={!!busy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors disabled:opacity-50 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  {busy === 'reactivate' ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} className="text-emerald-400" />}
                  {t.organization.reactivateMember}
                </button>
              ) : (
                <button
                  onClick={() => runAction('suspend')}
                  disabled={!!busy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors disabled:opacity-50 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  {busy === 'suspend' ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} className="text-amber-400" />}
                  <span className="flex flex-col">
                    <span>{t.organization.suspendMember}</span>
                    <span className="text-xs text-[#858585]">{t.organization.suspendMemberDesc}</span>
                  </span>
                </button>
              ))}

              {canManage && !member.suspended && (
                <button
                  onClick={() => runAction(isMuted ? 'unmute' : 'mute')}
                  disabled={!!busy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors disabled:opacity-50 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  {busy === 'mute' || busy === 'unmute'
                    ? <Loader2 size={16} className="animate-spin" />
                    : isMuted ? <MessageSquare size={16} className="text-emerald-400" /> : <MessageSquareOff size={16} className="text-amber-400" />}
                  <span className="flex flex-col">
                    <span>{isMuted ? t.organization.unmuteMember : t.organization.muteMember}</span>
                    <span className="text-xs text-[#858585]">{isMuted ? t.organization.unmuteMemberDesc : t.organization.muteMemberDesc}</span>
                  </span>
                </button>
              )}

              {!isSelf && (
                <button
                  onClick={toggleHiddenNotifications}
                  disabled={savingHidden}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors disabled:opacity-50 bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  {savingHidden
                    ? <Loader2 size={16} className="animate-spin" />
                    : notificationsHidden ? <Bell size={16} className="text-emerald-400" /> : <BellOff size={16} className="text-[#858585]" />}
                  <span className="flex flex-col">
                    <span>{notificationsHidden ? t.organization.showNotifications : t.organization.hideNotifications}</span>
                    <span className="text-xs text-[#858585]">{t.organization.hideNotificationsDesc}</span>
                  </span>
                </button>
              )}

              {(canManage || canLeave) && (
                <button
                  onClick={() => runAction('remove')}
                  disabled={!!busy}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-colors disabled:opacity-50 bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/10"
                >
                  {busy === 'remove' ? <Loader2 size={16} className="animate-spin" /> : canLeave ? <LogOut size={16} /> : <UserX size={16} />}
                  <span className="flex flex-col">
                    <span>{canLeave ? t.organization.leaveOrg : t.organization.removeMember}</span>
                    <span className="text-xs text-[#858585]">{canLeave ? t.organization.leaveOrgDesc : t.organization.removeMemberDesc}</span>
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
