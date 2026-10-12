import React, { useState } from 'react';
import { X, Folder, PlusCircle, Search, Loader2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { Organization } from './types';
import { db } from '@/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

interface AssignProjectModalProps {
  organization: Organization;
  onClose: () => void;
}

export function AssignProjectModal({ organization, onClose }: AssignProjectModalProps) {
  const { t } = useTranslation();
  const { projects } = useProject();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAssigning, setIsAssigning] = useState<string | null>(null);
  const toast = useToast();

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
      toast.success(t.organization.projectAssigned);
    } catch (error) {
      console.error(error);
      toast.error(t.organization.projectAssignError);
    } finally {
      setIsAssigning(null);
    }
  };

  const dialog = useDialog();
  const { createProject } = useProject();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNew = async () => {
    const name = await dialog.prompt({
      title: t.organization.newProjectTitle,
      message: t.organization.enterNewProjectName,
      placeholder: "Es. Sito Web E-commerce",
      confirmText: t.organization.create
    });

    if (!name || !name.trim()) return;

    setIsCreating(true);
    try {
      const newProjectId = await createProject(name);
      if (newProjectId) {
        await updateDoc(doc(db, 'projects', newProjectId), {
          organizationIds: arrayUnion(organization.id)
        });
        toast.success(t.organization.projectCreatedAndAssigned);
        onClose();
      } else {
        toast.error(t.organization.projectCreateError);
      }
    } catch (error) {
      console.error(error);
      toast.error(t.organization.unexpectedError);
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
            <h2 className="text-lg font-semibold text-white/90">{t.organization.assignProject}</h2>
            <p className="text-xs text-[#858585] mt-1">{t.organization.addProjectTo} {organization.name}</p>
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
              {isCreating ? t.organization.creating : t.organization.createNewProject}
            </span>
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-[#858585] text-xs font-medium uppercase tracking-wider">{t.organization.orAssignExisting}</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          {availableProjects.length === 0 ? (
            <div className="text-center py-8">
              <Folder size={32} className="mx-auto text-[#858585] mb-3" />
              <p className="text-sm text-[#858585]">{t.organization.allProjectsAssigned}</p>
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
                  <PlusCircle size={14} /> {t.organization.assign}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


