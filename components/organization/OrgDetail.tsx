"use client";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, UserPlus, Link2, MoreHorizontal, MoreVertical, Pencil, PlusCircle, ImagePlus, Loader2, Copy, X, Users, Lock, Trash2 } from 'lucide-react';
import { Organization } from './types';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove, collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { authedFetch } from '@/lib/authedFetch';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { trackUpload, uploadErrorMessage } from '@/lib/usage';
import { ensureOwnedOrgWorkspace } from '@/lib/orgWorkspace';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { AssignProjectModal } from './AssignProjectModal';
import { ProjectIAMModal } from './ProjectIAMModal';
import { MemberProfileModal } from './MemberProfileModal';
import { MemberChip } from './MemberChip';
import { OrgMember } from '@/types/organization';
import { Project } from '@/contexts/ProjectContext';
import { Folder } from 'lucide-react';
import { TeamsSection } from './TeamsSection';

export function OrgDetail({ initialOrg }: { initialOrg: Organization }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projects } = useProject();
  const { activeWorkspaceId } = useWorkspace();
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [org, setOrg] = useState(initialOrg);
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        // Progetti del workspace dell'organizzazione assegnati a lei. Le regole
        // di Firestore lasciano cercare i progetti solo per workspace: per
        // `organizationIds` da solo la ricerca verrebbe rifiutata.
        const q = query(
          collection(db, 'projects'),
          where('workspaceId', '==', org.id)
        );
        const unsubscribe = onSnapshot(q, (snapshot: any) => {
          const projs: Project[] = [];
          snapshot.forEach((doc: any) => {
            const data = doc.data();
            if (Array.isArray(data.organizationIds) && data.organizationIds.includes(org.id)) {
              projs.push({ id: doc.id, ...data } as Project);
            }
          });
          setAssignedProjects(projs);
        });
        return unsubscribe;
      } catch (e) {
        console.error(e);
      }
    };
    const unsub = fetchProjects();
    return () => {
      unsub.then(u => u && u());
    };
  }, [org.id]);

  
  const [isHoveringBanner, setIsHoveringBanner] = useState(false);
  const [isHoveringIcon, setIsHoveringIcon] = useState(false);
  
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [assignProjectModalOpen, setAssignProjectModalOpen] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(initialOrg.name);
  const [iamProject, setIamProject] = useState<Project | null>(null);
  const [iamMember, setIamMember] = useState<OrgMember | null>(null);

  const toast = useToast();
  const dialog = useDialog();
  const router = useRouter();
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = async () => {
    setIsEditingName(false);
    const name = editedName.trim();
    if (name === '' || name === org.name) {
      setEditedName(org.name);
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', org.id), { name });
      // Anche il workspace dell'organizzazione (stesso ID), che prima restava
      // col nome vecchio. L'app mostra comunque quello dell'organizzazione:
      // se il workspace manca o non si aggiorna, il cambio di nome resta.
      await updateDoc(doc(db, 'workspaces', org.id), { name }).catch(err => console.warn('Nome del workspace non aggiornato:', err));
      setOrg({ ...org, name });
      setEditedName(name);
      toast.success(t.organization.nameUpdated);
    } catch (err) {
      console.error(err);
      toast.error(t.organization.nameUpdateError);
      setEditedName(org.name);
    }
  };

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingBanner(true);
    try {
      const storageRef = ref(storage, `organizations/${org.id}/banner_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      // Prima il conteggio: se lo spazio è finito il file è già stato rimosso.
      await trackUpload(org.id, storageRef.fullPath);
      await updateDoc(doc(db, 'organizations', org.id), { bannerUrl: url });
      setOrg({ ...org, bannerUrl: url });
      toast.success(t.organization.bannerUploaded);
    } catch (err) {
      console.error(err);
      toast.error(uploadErrorMessage(err, t.organization.bannerUploadError));
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingLogo(true);
    try {
      const storageRef = ref(storage, `organizations/${org.id}/logo_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await trackUpload(org.id, storageRef.fullPath);
      await updateDoc(doc(db, 'organizations', org.id), { logoUrl: url });
      setOrg({ ...org, logoUrl: url });
      toast.success(t.organization.logoUploaded);
    } catch (err) {
      console.error(err);
      toast.error(uploadErrorMessage(err, t.organization.logoUploadError));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Il link lo genera il server: un codice casuale valido 48 ore.
  // Prima era /invite/{orgId}, valido per chiunque e per sempre.
  const [inviteLink, setInviteLink] = useState('');
  const [isCreatingLink, setIsCreatingLink] = useState(false);

  const copyInviteLink = async () => {
    setIsCreatingLink(true);
    try {
      let link = inviteLink;
      if (!link) {
        const response = await authedFetch('/api/org-invites/link', {
          method: 'POST',
          body: JSON.stringify({ orgId: org.id }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.url) throw new Error(data.error || 'Link non generato.');
        link = data.url;
        setInviteLink(link);
      }
      await navigator.clipboard.writeText(link);
      toast.success(t.organization.linkCopied);
    } catch (err: any) {
      console.error(err);
      toast.error(`Errore: ${err.message}`);
    } finally {
      setIsCreatingLink(false);
    }
  };

  const handleSendEmailInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error(t.organization.validEmailError);
      return;
    }
    
    setIsSendingInvite(true);
    try {
      // Nome dell'organizzazione, di chi invita e link li decide il server.
      const response = await authedFetch('/api/email/invite', {
        method: 'POST',
        body: JSON.stringify({ orgId: org.id, email: inviteEmail.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t.organization.emailInviteError);
      }

      setInviteEmail('');
      setInviteModalOpen(false);
      toast.success(t.organization.inviteSentSuccess);
    } catch (err: any) {
      console.error(err);
      toast.error(`Errore: ${err.message}`);
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleUnassignProject = async (projectId: string) => {
    const isConfirmed = await dialog.confirm({
      title: t.organization.removeProjectTitle,
      message: t.organization.removeProjectMessage,
      isDestructive: true,
      confirmText: t.organization.remove
    });
    if (!isConfirmed) return;

    try {
      await updateDoc(doc(db, 'projects', projectId), {
        organizationIds: arrayRemove(org.id)
      });
      toast.success(t.organization.projectRemoved);
    } catch (err) {
      console.error(err);
      toast.error(t.organization.projectRemoveError);
    }
  };

  // Solo il proprietario, dal server: cancella anche workspace, accessi,
  // team e inviti. Il server rifiuta se il workspace ha ancora progetti.
  const handleDeleteOrg = async () => {
    const typed = await dialog.prompt({
      title: "Elimina organizzazione",
      message: `L'operazione è irreversibile: spariscono l'organizzazione, il suo workspace, gli accessi dei membri, i team e gli inviti. Per confermare scrivi il nome: ${org.name}`,
      placeholder: org.name,
      confirmText: "Elimina",
    });
    if (typed === null || typed === undefined) return;
    if (typed.trim() !== org.name) {
      toast.error("Il nome non corrisponde: organizzazione non eliminata.");
      return;
    }
    setIsDeletingOrg(true);
    try {
      const response = await authedFetch('/api/organizations/delete', {
        method: 'POST',
        body: JSON.stringify({ orgId: org.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Cancellazione non riuscita. Riprova.');
      toast.success("Organizzazione eliminata.");
      router.push('/organization');
    } catch (err: any) {
      toast.error(err?.message || 'Cancellazione non riuscita. Riprova.');
    } finally {
      setIsDeletingOrg(false);
    }
  };

  // assignedProjects is now fetched via onSnapshot

  return (
    <div className="flex flex-col h-full font-sans max-w-[1229px] mx-auto w-full ">
      
      <input type="file" accept="image/*" ref={bannerInputRef} onChange={handleUploadBanner} className="hidden" />
      <input type="file" accept="image/*" ref={logoInputRef} onChange={handleUploadLogo} className="hidden" />

      {/* Top Header Row */}
      <div className="flex items-center justify-between mb-8">
        <Link 
          href="/organization" 
          className="w-[46px] h-[46px] rounded-[16px] border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors bg-transparent"
        >
          <ChevronLeft size={18} className="text-white/70" />
        </Link>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"
          >
            <UserPlus size={16} className="text-[#00A6FF]" />
            {t.organization.inviteMembers}
          </button>
        </div>
      </div>

      {/* Banner */}
      <div 
        className={`w-full h-[180px] shrink-0 rounded-[32px] relative overflow-hidden transition-all ${!org.bannerUrl ? 'bg-gradient-to-br from-[#0061FF] to-[#00D2FF]' : ''}`}
        onMouseEnter={() => setIsHoveringBanner(true)}
        onMouseLeave={() => setIsHoveringBanner(false)}
      >
        {org.bannerUrl && (
          <img src={org.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
        )}
        {isHoveringBanner && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center transition-all animate-in fade-in duration-200">
            <button 
              onClick={() => bannerInputRef.current?.click()}
              disabled={isUploadingBanner}
              className="flex items-center gap-2 bg-black/60 border border-white/20 text-white px-5 py-2.5 rounded-xl backdrop-blur-md font-medium text-[14px] hover:bg-black/80 transition-colors"
            >
              {isUploadingBanner ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {isUploadingBanner ? t.organization.creating : t.organization.editBanner}
            </button>
          </div>
        )}
      </div>

      {/* Title Row */}
      <div className="flex items-center gap-5 mt-8 mb-16 px-2">
        <div 
          className="relative w-[56px] h-[56px] rounded-full bg-[#006AFF] flex items-center justify-center border-[2px] border-[#006AFF] cursor-pointer overflow-hidden group"
          onMouseEnter={() => setIsHoveringIcon(true)}
          onMouseLeave={() => setIsHoveringIcon(false)}
          onClick={() => logoInputRef.current?.click()}
        >
          {org.logoUrl ? (
            <img src={org.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isHoveringIcon ? 'opacity-0' : 'opacity-100'}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          )}

          {(isHoveringIcon || isUploadingLogo) && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-10">
              {isUploadingLogo ? <Loader2 size={18} className="animate-spin text-white" /> : <Pencil size={18} className="text-white" />}
            </div>
          )}
        </div>
        {isEditingName ? (
          <input 
            type="text" 
            value={editedName}
            onChange={e => setEditedName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
            className="text-[32px] font-semibold text-white tracking-tight bg-transparent border-b border-white/20 outline-none w-auto focus:border-[#006AFF]"
            autoFocus
          />
        ) : (
          <h1 
            className="text-[32px] font-semibold text-white tracking-tight cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => setIsEditingName(true)}
            title="Clicca per modificare il nome"
          >
            {org.name}
          </h1>
        )}
      </div>

      {/* Modello Operativo Section */}
      <section className="px-2 mb-12">
        <h2 className="text-sm font-semibold text-[#858585] tracking-wider uppercase mb-4">Modello Operativo Workspace</h2>
        <div className="flex gap-4">
          {[
            { id: 'flat', label: 'Flat (Progetti Singoli)', icon: <Folder size={18} /> },
            { id: 'teams', label: 'Teams (Squadre)', icon: <UserPlus size={18} /> },
            { id: 'corporate', label: 'Corporate (Avanzato)', icon: <Link2 size={18} /> }
          ].map(mode => {
            const isSelected = (org.structureMode || 'teams') === mode.id;
            return (
              <button
                key={mode.id}
                onClick={async () => {
                  try {
                    const { setDoc } = await import('firebase/firestore');
                    // Prima il workspace completo, se manca: altrimenti il salvataggio
                    // qui sotto creerebbe un workspace senza nome né proprietario.
                    if (user) await ensureOwnedOrgWorkspace(org, user.uid);
                    await setDoc(doc(db, 'workspaces', org.id), { structureMode: mode.id }, { merge: true });
                    await updateDoc(doc(db, 'organizations', org.id), { structureMode: mode.id }); // Legacy sync
                    setOrg({ ...org, structureMode: mode.id as any });
                    toast.success(t.organization.operatingModelUpdated);
                  } catch (e) {
                    console.error(e);
                    toast.error(t.organization.operatingModelError);
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                  isSelected 
                    ? 'bg-[#006AFF]/10 border-[#006AFF] text-white shadow-[0_0_15px_rgba(0,106,255,0.2)]' 
                    : 'bg-[#111] border-white/5 text-[#858585] hover:bg-white/5 hover:border-white/10'
                }`}
              >
                <div className={`mb-2 ${isSelected ? 'text-[#006AFF]' : ''}`}>
                  {mode.icon}
                </div>
                <span className="text-sm font-medium">{mode.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Conditional Sections based on Structure Mode */}

      {/* FLAT MODE: Show only Projects and Workspace Members */}
      {(org.structureMode === 'flat' || !org.structureMode) && (
        <section className="px-2 mt-8 mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">{t.organization.projectsFlatMode}</h2>
              <div className="bg-[#1A1A1A] border border-white/5 rounded-full px-2.5 py-0.5 text-[#858585] text-[13px] font-medium flex items-center justify-center min-w-[28px]">
                {assignedProjects.length}
              </div>
            </div>
            <button 
              onClick={() => setAssignProjectModalOpen(true)} 
              className="h-[40px] px-4 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-xl font-medium flex items-center gap-2 transition-colors hover:bg-[#003B80]/80 text-[13px]"
            >
              <PlusCircle size={16} className="text-[#00A6FF]" />
              {t.organization.addProject}
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            {assignedProjects.length === 0 ? (
              <p className="text-[#858585] text-sm">{t.organization.noProjectsInWorkspace}</p>
            ) : (
              assignedProjects.map(project => (
                <div 
                  key={project.id} 
                  className="flex items-center justify-between min-w-[280px] flex-1 max-w-[400px] h-[64px] bg-[#0E0E0E] rounded-[24px] border border-white/10 px-4 hover:border-white/20 transition-all group"
                >
                  <Link href={`/project/${project.id}/tasks`} className="flex items-center gap-3 flex-1 cursor-pointer">
                    <div className="w-[34px] h-[34px] rounded-full bg-[#006AFF]/10 flex items-center justify-center text-[#006AFF]">
                      <Folder size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-[15px] group-hover:text-[#00A6FF] transition-colors">{project.name}</span>
                      <span className="text-[#858585] text-xs">{t.organization.openProject}</span>
                    </div>
                  </Link>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIamProject(project); }}
                      className="w-[34px] h-[34px] rounded-full hover:bg-white/10 flex items-center justify-center text-[#858585] hover:text-white transition-colors"
                      title={t.organization.manageAccess}
                    >
                      <Users size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleUnassignProject(project.id); }}
                      className="w-[34px] h-[34px] rounded-full hover:bg-red-400/10 flex items-center justify-center text-[#858585] hover:text-red-400 transition-colors"
                      title={t.organization.removeFromWorkspace}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* TEAMS MODE: Show Teams / Squadre */}
      {org.structureMode === 'teams' && (
        <TeamsSection workspaceId={org.id} workspaceMembers={org.members || []} />
      )}

      {/* CORPORATE MODE: Show Departments and Roles */}
      {org.structureMode === 'corporate' && (
        <section className="px-2 mt-8 mb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white tracking-tight">Enterprise IAM</h2>
              <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded uppercase font-bold tracking-wider">{t.common.advanced}</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-6">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2"><Link2 size={16} className="text-[#006AFF]"/> {t.organization.departmentsNested}</h3>
              <p className="text-[#858585] text-sm mb-4">{t.organization.departmentsDesc}</p>
              <button onClick={() => dialog.alert({ title: t.organization.comingSoon, message: t.organization.comingSoonDept })} className="text-sm text-[#006AFF] hover:underline">{t.organization.configureDepartments}</button>
            </div>
            
            <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-medium mb-4 flex items-center gap-2"><Lock size={16} className="text-[#006AFF]"/> {t.organization.customGlobalRoles}</h3>
              <p className="text-[#858585] text-sm mb-4">{t.organization.customGlobalRolesDesc}</p>
              <button onClick={() => dialog.alert({ title: t.organization.comingSoon, message: t.organization.comingSoonPolicy })} className="text-sm text-[#006AFF] hover:underline">{t.organization.managePolicies}</button>
            </div>
          </div>
        </section>
      )}

      {/* Membri Globali (Comuni a tutte le modalità) */}
      <section className="px-2 mb-16">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">{t.organization.userDirectory}</h2>
            <div className="bg-[#1A1A1A] border border-white/5 rounded-full px-2.5 py-0.5 text-[#858585] text-[13px] font-medium flex items-center justify-center min-w-[28px]">
              {org.members?.length || 0}
            </div>
          </div>
          <button 
            onClick={() => setInviteModalOpen(true)} 
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {t.organization.invite}
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          {org.members?.map((member, i) => (
            <MemberChip 
              key={i} 
              member={member} 
              orgId={org.id} 
              onClick={() => setIamMember(member)} 
            />
          ))}
        </div>
      </section>

      {org.ownerId === user?.uid && (
        <section className="px-2 mb-16">
          <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-red-400">{t.organization.deleteOrgTitle}</h2>
              <p className="text-sm text-[#858585] mt-1">{t.organization.deleteOrgDesc}</p>
            </div>
            <button
              onClick={handleDeleteOrg}
              disabled={isDeletingOrg}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-full text-sm font-medium transition-colors"
            >
              {isDeletingOrg ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {t.common.delete}
            </button>
          </div>
        </section>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[24px] p-8 max-w-lg w-full shadow-2xl relative">
            <button onClick={() => setInviteModalOpen(false)} className="absolute top-6 right-6 text-[#858585] hover:text-white">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-semibold text-white mb-2">{t.organization.inviteMembers}</h2>
            <p className="text-[#858585] text-sm mb-6">{t.organization.inviteDesc}</p>
            
            {/* Invite via Email */}
            <div className="mb-6">
              <label className="text-sm font-medium text-white/70 block mb-2">{t.organization.inviteViaEmail}</label>
              <div className="flex items-center gap-3">
                <input 
                  type="email" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="mario.rossi@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#006AFF] transition-colors text-sm"
                />
                <button 
                  onClick={handleSendEmailInvite}
                  disabled={!inviteEmail.trim() || isSendingInvite}
                  className="px-5 py-2.5 bg-[#006AFF] hover:bg-blue-600 disabled:bg-[#006AFF]/50 text-white rounded-xl font-medium transition-colors text-sm flex items-center gap-2"
                >
                  {isSendingInvite ? <Loader2 size={16} className="animate-spin" /> : t.organization.send}
                </button>
              </div>
            </div>

            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-[#858585] text-xs font-medium">{t.organization.orShareLink}</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2 mb-8">
              <input 
                type="text" 
                readOnly 
                value={inviteLink}
                placeholder={t.organization.inviteLinkPlaceholder}
                className="w-full bg-transparent border-none outline-none text-white/70 text-sm px-2 placeholder:text-white/40"
              />
              <button 
                onClick={copyInviteLink}
                disabled={isCreatingLink}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors font-medium"
              >
                <Copy size={16} /> {t.organization.copy}
              </button>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setInviteModalOpen(false)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors text-sm"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Project Modal */}
      {assignProjectModalOpen && (
        <AssignProjectModal 
          organization={org} 
          onClose={() => setAssignProjectModalOpen(false)} 
        />
      )}
      
      {iamProject && (
        <ProjectIAMModal 
          project={iamProject} 
          organization={org}
          onClose={() => setIamProject(null)} 
        />
      )}
      
      {iamMember && (
        <MemberProfileModal 
          member={iamMember} 
          onClose={() => setIamMember(null)} 
        />
      )}

    </div>
  );
}
