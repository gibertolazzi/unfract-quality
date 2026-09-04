'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, orderBy, deleteDoc, or } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useOrganization } from './OrganizationContext';

export interface Project {
  id: string;
  name: string;
  userId: string;
  organizationIds?: string[];
  createdAt: any;

}

interface ProjectContextType {
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  createProject: (name: string, organizationIds?: string[]) => Promise<string | null>;
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
  const { organizations, loading: orgLoading } = useOrganization();
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
    if (authLoading || orgLoading) return;
    
    if (!user) {
      setProjects([]);
      setActiveProjectIdState(null);
      setLoading(false);
      return;
    }

    const orgIds = organizations.map(org => org.id);
    
    // We want to fetch projects that either belong to the user personally OR belong to any of the user's organizations
    let q;
    if (orgIds.length > 0) {
      // split into chunks if needed, but array-contains-any allows max 10 elements in Firebase.
      // For MVP, we slice to 10.
      q = query(
        collection(db, 'projects'),
        or(
          where('userId', '==', user.uid),
          where('organizationIds', 'array-contains-any', orgIds.slice(0, 10))
        )
      );
    } else {
      q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid)
      );
    }

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Create default project
        try {
          const docRef = await addDoc(collection(db, 'projects'), {
            name: 'Untitled Project',
            userId: user.uid,
            createdAt: serverTimestamp()
          });
          setActiveProjectId(docRef.id);
          // Migrate orphan data to the newly created project
          const { migrateOrphanData } = await import('@/lib/migration');
          await migrateOrphanData(docRef.id);
        } catch (e) {
          console.error("Error creating default project:", e);
        }
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
  }, [user, authLoading, orgLoading, organizations.length]);

  const createProject = async (name: string, organizationIds?: string[]) => {
    if (!user) return null;
    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        name,
        userId: user.uid,
        organizationIds: organizationIds || [],
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
