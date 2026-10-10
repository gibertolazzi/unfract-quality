"use client";

import React, { useState, useEffect } from 'react';
import { PlusCircle, UserPlus, Link2, MoreHorizontal, Loader2, X } from 'lucide-react';
import { OrgCard } from '@/components/organization/OrgCard';
import { Organization } from '@/components/organization/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { createOrganization, ensureOwnedOrgWorkspace } from '@/lib/orgWorkspace';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRouter } from 'next/navigation';

export default function OrganizationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchOrgs = async () => {
      try {
        // Solo le organizzazioni di cui l'utente fa parte (`memberUids`).
        // Prima le scaricava tutte e filtrava qui.
        const q = query(collection(db, 'organizations'), where('memberUids', 'array-contains', user.uid));
        const snapshot = await getDocs(q);
        const fetchedOrgs: Organization[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
        setOrgs(fetchedOrgs);
        // Organizzazioni create senza workspace: lo aggiunge per chi le possiede.
        fetchedOrgs.forEach(org => {
          ensureOwnedOrgWorkspace(org, user.uid).catch(error => console.error('Workspace dell’organizzazione non creato:', error));
        });
      } catch (error) {
        console.error("Error fetching organizations:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrgs();
  }, [user]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !user) return;
    setIsCreating(true);
    try {
      // Organizzazione, workspace e accesso del creatore nascono insieme.
      const orgId = await createOrganization(user, newOrgName.trim());
      const newOrgData = {
        name: newOrgName.trim(),
        ownerId: user.uid,
        memberUids: [user.uid],
        memberCount: 1,
        bannerGradient: 'from-[#0061FF] to-[#00D2FF]',
        members: [{
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Utente',
          photoURL: user.photoURL || '',
          initials: (user.displayName || 'U').charAt(0).toUpperCase(),
          role: 'admin' as const
        }],
      };
      setOrgs([{ id: orgId, ...newOrgData, createdAt: new Date() } as Organization, ...orgs]);
      setIsCreateModalOpen(false);
      setNewOrgName('');
      
      // Optional: Redirect directly to the new org
      router.push(`/organization/${orgId}`);
    } catch (error) {
      console.error("Error creating organization:", error);
      toast.error("Errore durante la creazione dell'organizzazione.");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-[#858585]" /></div>;
  }

  return (
    <div className="flex flex-col h-full font-sans max-w-[1229px] mx-auto w-full ">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8 mt-2">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Organizzazioni</h1>
          <p className="text-[#858585] text-sm mt-1">Gestisci i tuoi team e i progetti condivisi</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm"
        >
          <PlusCircle size={16} className="text-[#00A6FF]" />
          Aggiungi Organizzazione
        </button>
      </div>

      {/* List */}
      {orgs.length === 0 ? (
        <div className="text-center text-[#858585] mt-20">
          <p>Nessuna organizzazione trovata. Creane una nuova!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-[24px] p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-6 right-6 text-[#858585] hover:text-white">
              <X size={20} />
            </button>
            <h2 className="text-2xl font-semibold text-white mb-6">Crea Organizzazione</h2>
            <div className="flex flex-col gap-2 mb-8">
              <label className="text-sm text-white/70">Nome Organizzazione</label>
              <input 
                type="text" 
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Es. GMF Labs"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#006AFF] transition-colors"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-white/70 hover:bg-white/5 transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={handleCreateOrg}
                disabled={!newOrgName.trim() || isCreating}
                className="px-5 py-2.5 bg-[#006AFF] text-white rounded-xl font-medium hover:bg-[#0055CC] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isCreating && <Loader2 size={16} className="animate-spin" />}
                Crea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
