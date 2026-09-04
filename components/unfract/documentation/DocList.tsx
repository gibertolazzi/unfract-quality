"use client";

import React, { useState } from 'react';
import { Plus, ChevronDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Document } from './types';
import { DocCard } from './DocCard';

import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';

interface DocListProps {
  documents: Document[];
}

export function DocList({ documents }: DocListProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const { activeProjectId } = useProject();
  const { user } = useAuth();

  const handleCreateNew = async () => {
    if (!activeProjectId || !user) {
      alert("Progetto o utente non trovato.");
      return;
    }
    setIsCreating(true);
    // Dynamic import to avoid SSR issues if any, or just import at top.
    const { createDocument } = await import('@/lib/documentation');
    const newId = await createDocument(user.displayName || "Utente Sconosciuto", activeProjectId);
    if (newId) {
      router.push(`/documentation/${newId}?edit=true`);
    } else {
      setIsCreating(false);
      alert('Errore durante la creazione del documento.');
    }
  };

  return (
    <div className="flex flex-col h-full font-sans max-w-[1229px] mx-auto w-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={handleCreateNew}
          disabled={isCreating}
          className="flex items-center gap-2 bg-[#006AFF]/10 border border-[#006AFF]/20 text-[#006AFF] hover:bg-[#006AFF]/20 transition-colors px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          New Document
        </button>

        <button className="flex items-center gap-2 border border-white/10 bg-transparent text-white/50 hover:text-white transition-colors px-4 py-2.5 rounded-xl text-sm font-medium">
          Ordina per: più recente
          <ChevronDown size={16} />
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-10">
        {documents.length === 0 ? (
          <div className="text-center text-white/50 mt-10">
            Nessun documento trovato. Creane uno nuovo!
          </div>
        ) : (
          documents.map(doc => (
            <DocCard key={doc.id} doc={doc} />
          ))
        )}
      </div>
    </div>
  );
}
