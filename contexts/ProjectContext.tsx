'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, orderBy, deleteDoc, or } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useWorkspace } from './WorkspaceContext';

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
  setActiveProjectId: (id: string) => void;
  createProject: (name: string) => Promise<string | null>;
  renameProject: (id: string, newName: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  activeProjectId: null,
  activeProject: null,
  setActiveProjectId: () => {},
  createProject: async () => null,
  renameProject: async () => {},
  deleteProject: async () => {},
  loading: true,
});

export const useProject = () => useContext(ProjectContext);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspaceId, loading: workspaceLoading } = useWorkspace();
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

    // New logic: fetch all projects for the active workspace
    const q = query(
      collection(db, 'projects'),
      where('workspaceId', '==', activeWorkspaceId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setProjects([]);
        setActiveProjectIdState(null);
      } else {
        const loadedProjects: Project[] = [];
        snapshot.forEach(doc => {
          loadedProjects.push({ id: doc.id, ...doc.data() } as Project);
        });
        
        // Sort client-side by createdAt asc
        loadedProjects.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeA - timeB;
        });

        setProjects(loadedProjects);

        // Validate activeProjectId
        setActiveProjectIdState((currentActiveId) => {
          const isValid = loadedProjects.find(p => p.id === currentActiveId);
          if (!isValid && loadedProjects.length > 0) {
            const newId = loadedProjects[0].id;
            localStorage.setItem('unfract_active_project', newId);
            return newId;
          }
          return currentActiveId;
        });

        // Migrate orphan data to first project (runs once, tracked via localStorage)
        const firstProject = loadedProjects[0];
        if (firstProject) {
          import('@/lib/migration').then(({ migrateOrphanData }) => {
            migrateOrphanData(firstProject.id);
          });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, workspaceLoading, activeWorkspaceId]);

  const createProject = async (name: string) => {
    if (!user || !activeWorkspaceId) return null;
    try {
      const { setDoc } = await import('firebase/firestore');
      const docRef = await addDoc(collection(db, 'projects'), {
        name,
        userId: user.uid,
        creatorId: user.uid,
        workspaceId: activeWorkspaceId,
        createdAt: serverTimestamp()
      });
      const grantRef = doc(collection(db, 'access_grants'));
      await setDoc(grantRef, {
        workspaceId: activeWorkspaceId,
        subjectType: 'user',
        subjectId: user.uid,
        resourceType: 'project',
        resourceId: docRef.id,
        role: 'admin',
        createdAt: serverTimestamp()
      });
      setActiveProjectId(docRef.id);
      return docRef.id;
    } catch (e) {
      console.error("Error creating project:", e);
      return null;
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



  const deleteProject = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
      // State and active project fallback will be handled by the onSnapshot listener.
    } catch (e) {
      console.error("Error deleting project:", e);
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProjectId,
      activeProject,
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
