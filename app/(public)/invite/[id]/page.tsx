"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authedFetch } from '@/lib/authedFetch';
import { Loader2 } from 'lucide-react';
import { LoginScreen } from '@/components/auth/LoginScreen';

/**
 * Accettazione di un invito. `id` è il codice dell'invito, non l'ID
 * dell'organizzazione: lo verifica il server (`/api/org-invites/accept`), che
 * aggiunge l'utente all'organizzazione.
 */
export default function InvitePage() {
  const params = useParams();
  const token = params.id as string;
  const { user, loading } = useAuth();
  const router = useRouter();
  const started = useRef(false);

  const [status, setStatus] = useState('Verifica invito in corso...');

  useEffect(() => {
    if (loading || !user || started.current) return;
    started.current = true;

    const processInvite = async () => {
      try {
        const response = await authedFetch('/api/org-invites/accept', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.orgId) {
          setStatus(data.error || "Si è verificato un errore durante l'accettazione dell'invito.");
          return;
        }
        router.push(`/organization/${data.orgId}`);
      } catch (err) {
        console.error(err);
        setStatus("Si è verificato un errore durante l'accettazione dell'invito.");
      }
    };

    processInvite();
  }, [user, loading, token, router]);

  if (!user && !loading) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0B0B0B] text-white">
      <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
        {status.includes('corso') || status.includes('aggiungendo') ? (
          <Loader2 className="w-10 h-10 animate-spin text-[#006AFF]" />
        ) : null}
        <p className="text-white/70 font-medium">{status}</p>
        {!status.includes('corso') && !status.includes('aggiungendo') && (
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-5 py-2.5 bg-[#006AFF] hover:bg-[#0056d6] text-white rounded-xl text-sm font-medium transition-colors"
          >
            Vai all’applicazione
          </button>
        )}
      </div>
    </div>
  );
}
