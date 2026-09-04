"use client";

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, UserPlus, Link2, MoreHorizontal, MoreVertical, Pencil, PlusCircle, ImagePlus, Loader2, Copy, X } from 'lucide-react';
import { Organization } from './types';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { AssignProjectModal } from './AssignProjectModal';
import { Folder } from 'lucide-react';

export function OrgDetail({ initialOrg }: { initialOrg: Organization }) {
  const { user } = useAuth();
  const { projects } = useProject();
  const [org, setOrg] = useState(initialOrg);
  
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

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleSaveName = async () => {
    setIsEditingName(false);
    if (editedName.trim() === '' || editedName === org.name) {
      setEditedName(org.name);
      return;
    }
    try {
      await updateDoc(doc(db, 'organizations', org.id), { name: editedName });
      setOrg({ ...org, name: editedName });
    } catch (err) {
      console.error(err);
      alert("Errore durante l'aggiornamento del nome.");
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
      
      await updateDoc(doc(db, 'organizations', org.id), { bannerUrl: url });
      setOrg({ ...org, bannerUrl: url });
    } catch (err) {
      console.error(err);
      alert("Errore durante l'upload del banner.");
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
      
      await updateDoc(doc(db, 'organizations', org.id), { logoUrl: url });
      setOrg({ ...org, logoUrl: url });
    } catch (err) {
      console.error(err);
      alert("Errore durante l'upload del logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/invite/${org.id}` : '';

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert("Link copiato negli appunti!");
  };

  const handleSendEmailInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      alert("Inserisci un indirizzo email valido.");
      return;
    }
    
    setIsSendingInvite(true);
    try {
      const response = await fetch('/api/email/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          inviterName: user?.displayName || 'Un utente',
          orgName: org.name,
          inviteLink: inviteLink
        })
      });

      if (!response.ok) {
        throw new Error("Errore durante l'invio dell'email.");
      }

      setInviteEmail('');
      alert('Invito inviato con successo!');
    } catch (err) {
      console.error(err);
      alert("C'è stato un problema durante l'invio dell'invito.");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleUnassignProject = async (projectId: string) => {
    if (!confirm("Sei sicuro di voler rimuovere questo progetto dall'organizzazione?")) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        organizationIds: arrayRemove(org.id)
      });
    } catch (err) {
      console.error(err);
      alert("Errore durante la rimozione del progetto.");
    }
  };

  const assignedProjects = projects.filter(p => p.organizationIds?.includes(org.id));

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
            className="h-[46px] px-5 bg-[#006AFF] border border-[#0055CC] text-white rounded-2xl font-medium flex items-center gap-2.5 transition-colors hover:bg-blue-600 text-[14px]"
          >
            <UserPlus size={16} />
            Add members
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
              {isUploadingBanner ? 'Caricamento...' : 'Modifica Banner'}
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

      {/* Membri Section */}
      <section className="px-2">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Membri</h2>
            <div className="bg-[#1A1A1A] border border-white/5 rounded-full px-2.5 py-0.5 text-white/50 text-[13px] font-medium flex items-center justify-center min-w-[28px]">
              {org.members?.length || 0}
            </div>
          </div>
          <button onClick={() => setInviteModalOpen(true)} className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <PlusCircle size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          {org.members?.map((member, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between min-w-[180px] h-[64px] bg-[#0E0E0E] rounded-[24px] border border-white/10 px-4 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-[34px] h-[34px] rounded-full bg-[#006AFF] flex items-center justify-center text-white text-[12px] font-bold tracking-wider overflow-hidden">
                  {member.photoURL ? (
                    <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                  ) : (
                    member.initials || member.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] text-white font-medium">{member.displayName}</span>
                  <span className="text-[11px] text-white/40 capitalize">{member.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Progetti Section */}
      <section className="px-2 mt-12 mb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white tracking-tight">Progetti</h2>
            <div className="bg-[#1A1A1A] border border-white/5 rounded-full px-2.5 py-0.5 text-white/50 text-[13px] font-medium flex items-center justify-center min-w-[28px]">
              {assignedProjects.length}
            </div>
          </div>
          <button onClick={() => setAssignProjectModalOpen(true)} className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <PlusCircle size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          {assignedProjects.length === 0 ? (
            <p className="text-white/40 text-sm">Nessun progetto assegnato a questa organizzazione.</p>
          ) : (
            assignedProjects.map(project => (
              <div 
                key={project.id} 
                className="flex items-center justify-between min-w-[240px] h-[64px] bg-[#0E0E0E] rounded-[24px] border border-white/10 px-4 hover:border-white/20 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-[34px] h-[34px] rounded-full bg-[#006AFF]/10 flex items-center justify-center text-[#006AFF]">
                    <Folder size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] text-white font-medium">{project.name}</span>
                    <span className="text-[11px] text-white/40">Progetto</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleUnassignProject(project.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-full transition-all"
                  title="Rimuovi progetto"
                >
                  <X size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[24px] p-8 max-w-lg w-full shadow-2xl relative">
            <button onClick={() => setInviteModalOpen(false)} className="absolute top-6 right-6 text-white/50 hover:text-white">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-semibold text-white mb-2">Invita Membri</h2>
            <p className="text-white/50 text-sm mb-6">Invia un invito via email o condividi il link con il tuo team.</p>
            
            {/* Invite via Email */}
            <div className="mb-6">
              <label className="text-sm font-medium text-white/70 block mb-2">Invita tramite Email</label>
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
                  {isSendingInvite ? <Loader2 size={16} className="animate-spin" /> : 'Invia'}
                </button>
              </div>
            </div>

            <div className="relative flex items-center py-2 mb-6">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/30 text-xs font-medium">OPPURE CONDIVIDI IL LINK</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2 mb-8">
              <input 
                type="text" 
                readOnly 
                value={inviteLink}
                className="w-full bg-transparent border-none outline-none text-white/70 text-sm px-2"
              />
              <button 
                onClick={copyInviteLink}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors font-medium"
              >
                <Copy size={16} /> Copia
              </button>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setInviteModalOpen(false)}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors text-sm"
              >
                Chiudi
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

    </div>
  );
}
