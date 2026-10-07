'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, orderBy, or } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';
import { createProjectWithBoard, ProjectCreateError } from '@/lib/projects';
import { authedFetch } from '@/lib/authedFetch';

export interface Project {
  id: string;
  name: string;
  userId: string;
  workspaceId?: string;
  organizationIds?: string[];
  createdAt: any;
}

interface ProjectContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  /**
   * Il workspace del progetto aperto: è quello a cui vanno contati spazio e
   * crediti. Può differire dal workspace attivo, perché il menu elenca i
   * progetti di tutti i workspace.
   */
  activeProjectWorkspaceId: string | null;
  setActiveProjectId: (id: string) => void;
  createProject: (name: string, organizationIds?: string[]) => Promise<string>;
  renameProject: (id: string, newName: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  activeProjectId: null,
  activeProject: null,
  activeProjectWorkspaceId: null,
  setActiveProjectId: () => {},
  createProject: async () => { throw new ProjectCreateError('not-signed-in'); },
  renameProject: async () => {},
  deleteProject: async () => {},
  loading: true,
});

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspaceId, workspaces, loading: workspaceLoading } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load active project from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('unfract_active_project');
    if (saved) {
      setActiveProjectIdState(saved);
    }
  }, []);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem('unfract_active_project', id);
  };

  useEffect(() => {
    if (authLoading || workspaceLoading) return;
    
    if (!user || !activeWorkspaceId) {
      setProjects([]);
      setActiveProjectIdState(null);
      setLoading(false);
      return;
    }

    // Fetch projects for ALL workspaces the user has access to
    const workspaceIds = workspaces.map(w => w.id);
    if (workspaceIds.length === 0) {
      setProjects([]);
      setActiveProjectIdState(null);
      setLoading(false);
      return;
    }

    const unsubscribes: Array<() => void> = [];
    let allProjectsMap = new Map<string, Project>();

    // Chunk into arrays of 10 for 'in' queries
    const chunks = [];
    for (let i = 0; i < workspaceIds.length; i += 10) {
      chunks.push(workspaceIds.slice(i, i + 10));
    }

    let loadedChunks = 0;

    chunks.forEach(chunk => {
      const q = query(
        collection(db, 'projects'),
        where('workspaceId', 'in', chunk)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(doc => {
          allProjectsMap.set(doc.id, { id: doc.id, ...doc.data() } as Project);
        });
        
        // Remove projects that were deleted in this chunk
        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') {
            allProjectsMap.delete(change.doc.id);
          }
        });

        const loadedProjects = Array.from(allProjectsMap.values());
        
        loadedProjects.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeA - timeB;
        });

        setProjects([...loadedProjects]);
        
        setActiveProjectIdState((currentActiveId) => {
          const isValid = loadedProjects.find(p => p.id === currentActiveId);
          if (!isValid && loadedProjects.length > 0) {
            const newId = loadedProjects[0].id;
            localStorage.setItem('unfract_active_project', newId);
            return newId;
          }
          return currentActiveId;
        });

        loadedChunks++;
        if (loadedChunks >= chunks.length) {
          setLoading(false);
        }
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, authLoading, workspaceLoading, activeWorkspaceId, workspaces]);

  // Lancia ProjectCreateError: chi chiama mostra il motivo all'utente.
  const createProject = async (name: string, organizationIds?: string[]) => {
    try {
      const projectId = await createProjectWithBoard(db, {
        uid: user?.uid,
        workspaceId: activeWorkspaceId,
        name,
        organizationIds,
      });
      setActiveProjectId(projectId);
      return projectId;
    } catch (e) {
      console.error("Error creating project:", e);
      throw e;
    }
  };

  const renameProject = async (id: string, newName: string) => {
    try {
      await updateDoc(doc(db, 'projects', id), {
        name: newName
      });
    } catch (e) {
      console.error("Error renaming project:", e);
    }
  };



  // Dal server: cancella anche colonne, task, ruoli e accessi del progetto.
  // Lancia un errore con il messaggio da mostrare all'utente.
  const deleteProject = async (id: string) => {
    const response = await authedFetch('/api/projects/delete', {
      method: 'POST',
      body: JSON.stringify({ projectId: id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Cancellazione non riuscita. Riprova.');
    // Il progetto sparisce dall'elenco tramite onSnapshot.
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const activeProjectWorkspaceId = activeProject?.workspaceId || activeWorkspaceId || null;

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProjectId,
      activeProject,
      activeProjectWorkspaceId,
      setActiveProjectId,
      createProject,
      renameProject,
      deleteProject,
      loading
    }}>
      {children}
    </ProjectContext.Provider>
  );

}
