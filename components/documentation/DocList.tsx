"use client";

import React, { useState } from 'react';
import { Plus, ChevronDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Document } from './types';
import { DocCard } from './DocCard';

import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface DocListProps {
  documents: Document[];
}

export function DocList({ documents }: DocListProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const toast = useToast();
  const { activeProjectId } = useProject();
  const { user } = useAuth();

  const handleCreateNew = async () => {
    if (!activeProjectId || !user) {
      toast.error("Progetto o utente non trovato.");
      return;
    }
    setIsCreating(true);
    // Dynamic import to avoid SSR issues if any, or just import at top.
    const { createDocument } = await import('@/lib/documentation');
    try {
      const newId = await createDocument(activeProjectId, user.displayName || "Utente Sconosciuto");
      if (newId) {
        router.push(`/documentation/${newId}?edit=true`);
      } else {
        setIsCreating(false);
        toast.error('Errore durante la creazione del documento.');
      }
    } catch (error) {
      console.error(error);
      setIsCreating(false);
      toast.error('Errore durante la creazione del documento.');
    }
  };

  return (
    <div className="flex flex-col h-full font-sans max-w-[1229px] mx-auto w-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={handleCreateNew}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm disabled:opacity-50"
        >
          {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          New Document
        </button>

        <button className="flex items-center gap-2 border border-white/10 bg-transparent text-[#858585] hover:text-white transition-colors px-4 py-2.5 rounded-xl text-sm font-medium">
          Ordina per: più recente
          <ChevronDown size={16} />
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-10">
        {documents.length === 0 ? (
          <div className="text-center text-[#858585] mt-10">
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
