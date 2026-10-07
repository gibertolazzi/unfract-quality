import React, { useState } from 'react';
import { X, Folder, PlusCircle, Search, Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';
import { Organization } from './types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { projectCreateMessage } from '@/lib/projects';
import { useTranslation } from '@/contexts/TranslationContext';

interface AssignProjectModalProps {
  organization: Organization;
  onClose: () => void;
}

export function AssignProjectModal({ organization, onClose }: AssignProjectModalProps) {
  const { projects } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const toast = useToast();
  const { t } = useTranslation();

  // Progetti che NON sono già in questa organizzazione
  const availableProjects = projects.filter(p => 
    !p.organizationIds?.includes(organization.id) &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssign = async (projectId: string) => {
    setIsAssigning(projectId);
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        organizationIds: arrayUnion(organization.id)
      });
      onClose();
      toast.success("Progetto assegnato!");
    } catch (error) {
      console.error(error);
      toast.error("Errore durante l'assegnazione del progetto.");
    } finally {
      setIsAssigning(null);
    }
  };

  const dialog = useDialog();
  const { createProject } = useProject();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = async () => {
    const name = await dialog.prompt({
      title: "Nuovo Progetto",
      message: "Inserisci il nome del nuovo progetto:",
      placeholder: "Es. Sito Web E-commerce",
      confirmText: "Crea"
    });

    if (!name || !name.trim()) return;

    setIsCreating(true);
    try {
      // Nasce già assegnato all'organizzazione.
      await createProject(name, [organization.id]);
      toast.success("Progetto creato e assegnato!");
      onClose();
    } catch (error) {
      toast.error(projectCreateMessage(error, t.tasks));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white/90">Assegna Progetto</h2>
            <p className="text-xs text-[#858585] mt-1">Aggiungi un progetto a {organization.name}</p>
          </div>
          <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-3">
          <button
            onClick={handleCreateNew}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl transition-colors group mb-2"
          >
            {isCreating ? <Loader2 size={16} className="animate-spin text-[#0D6EFD]" /> : <PlusCircle size={16} className="text-[#0D6EFD]" />}
            <span className="text-sm font-medium text-white group-hover:text-[#0D6EFD] transition-colors">
              {isCreating ? 'Creazione in corso...' : 'Crea Nuovo Progetto'}
            </span>
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-[#858585] text-xs font-medium uppercase tracking-wider">Oppure assegna esistente</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {availableProjects.length === 0 ? (
            <div className="text-center py-8">
              <Folder size={32} className="mx-auto text-[#858585] mb-3" />
              <p className="text-sm text-[#858585]">Tutti i tuoi progetti sono già assegnati a questa organizzazione, oppure non ne hai creati.</p>
            </div>
          ) : (
            availableProjects.map(project => (
              <div key={project.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#006AFF]/10 flex items-center justify-center">
                    <Folder size={14} className="text-[#006AFF]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white/90">{project.name}</h3>
                  </div>
                </div>
                <button
                  onClick={() => handleAssign(project.id)}
                  disabled={!!isAssigning}
                  className="px-4 py-1.5 text-xs font-medium bg-[#006AFF] hover:bg-[#0055CC] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 opacity-0 group-hover:opacity-100"
                >
                  <PlusCircle size={14} /> Assegna
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


