"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function InvitePage() {
  const params = useParams();
  const orgId = params.id as string;
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [status, setStatus] = useState('Verifica invito in corso...');

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      // Potremmo reindirizzare al login, ma per ora il sistema ha solo il popup AuthContext.
      // Assumiamo che se non c'è l'utente, non può accettare l'invito finché non accede.
      setStatus('Effettua il login per accettare questo invito.');
      return;
    }

    const processInvite = async () => {
      try {
        const orgRef = doc(db, 'organizations', orgId);
        const orgSnap = await getDoc(orgRef);
        
        if (!orgSnap.exists()) {
          setStatus('Link di invito non valido o organizzazione non trovata.');
          return;
        }

        const orgData = orgSnap.data();
        const members = orgData.members || [];
        
        const isAlreadyMember = members.some((m: any) => m.uid === user.uid);
        
        if (isAlreadyMember) {
          router.push(`/organization/${orgId}`);
          return;
        }
        
        setStatus('Ti stiamo aggiungendo all\'organizzazione...');
        
        const newMember = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Utente',
          photoURL: user.photoURL || '',
          initials: (user.displayName || 'U').charAt(0).toUpperCase(),
          role: 'member'
        };
        
        await updateDoc(orgRef, {
          members: arrayUnion(newMember),
          memberCount: (orgData.memberCount || 0) + 1
        });
        
        router.push(`/organization/${orgId}`);
      } catch (err) {
        console.error(err);
        setStatus("Si è verificato un errore durante l'accettazione dell'invito.");
      }
    };
    
    processInvite();
  }, [user, loading, orgId, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0B0B0B] text-white">
      <div className="flex flex-col items-center gap-4">
        {status.includes('corso') || status.includes('aggiungendo') ? (
          <Loader2 className="w-10 h-10 animate-spin text-[#006AFF]" />
        ) : null}
        <p className="text-white/70 font-medium">{status}</p>
        {!user && !loading && (
          <p className="text-sm text-white/40 mt-2">Torna alla home o ricarica dopo aver fatto l'accesso.</p>
        )}
      </div>
    </div>
  );
}
