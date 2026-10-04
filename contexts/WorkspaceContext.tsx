'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Workspace, AccessGrant } from '@/types/workspace';
import { migrateToWorkspaces } from '@/lib/workspaceMigration';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string) => void;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaces: [],
  activeWorkspaceId: null,
  activeWorkspace: null,
  setActiveWorkspaceId: () => {},
  loading: true,
});

export const useWorkspace = () => useContext(WorkspaceContext);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceIdState, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to active workspace changes in real-time to update quotas
  useEffect(() => {
    if (!activeWorkspaceIdState) return;
    const unsub = onSnapshot(doc(db, 'workspaces', activeWorkspaceIdState), (snap) => {
      if (snap.exists()) {
        const updatedData = { id: snap.id, ...snap.data() } as Workspace;
        setWorkspaces(prev => prev.map(w => w.id === updatedData.id ? updatedData : w));
      }
    });
    return () => unsub();
  }, [activeWorkspaceIdState]);

  // Load active workspace from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('unfract_active_workspace');
    if (saved) {
      setActiveWorkspaceIdState(saved);
    }
  }, []);

  const setActiveWorkspaceId = (id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem('unfract_active_workspace', id);
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspaceIdState(null);
      setLoading(false);
      return;
    }

    let unsubscribe: () => void;

    const init = async () => {
      // Esegui la migrazione silente se necessaria
      await migrateToWorkspaces();

      // Trova a quali workspace l'utente ha accesso tramite gli access_grants
      const grantsQuery = query(
        collection(db, 'access_grants'),
        where('subjectType', '==', 'user'),
        where('subjectId', '==', user.uid),
        where('resourceType', '==', 'workspace')
      );

      unsubscribe = onSnapshot(grantsQuery, async (snapshot) => {
        if (snapshot.empty) {
          setWorkspaces([]);
          setLoading(false);
          return;
        }

        const workspaceIds = snapshot.docs.map(doc => doc.data().workspaceId);
        
        // Per ogni workspaceId, fetch i dettagli del Workspace
        // Nota: se un utente ha decine di workspace, andrebbe fatto a chunk.
        const wsPromises = workspaceIds.map(id => getDoc(doc(db, 'workspaces', id)));
        const wsDocs = await Promise.all(wsPromises);
        
        const loadedWorkspaces: Workspace[] = [];
        wsDocs.forEach(d => {
          if (d.exists()) {
            loadedWorkspaces.push({ id: d.id, ...d.data() } as Workspace);
          }
        });

        // Ordina in base alla data di creazione
        loadedWorkspaces.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeA - timeB;
        });

        setWorkspaces(loadedWorkspaces);

        // Valida e imposta il workspace attivo
        setActiveWorkspaceIdState((currentId) => {
          const isValid = loadedWorkspaces.find(w => w.id === currentId);
          if (!isValid && loadedWorkspaces.length > 0) {
            const newId = loadedWorkspaces[0].id;
            localStorage.setItem('unfract_active_workspace', newId);
            return newId;
          }
          return currentId;
        });

        setLoading(false);
      });
    };

    init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, authLoading]);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceIdState) || null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspaceId: activeWorkspaceIdState,
      activeWorkspace,
      setActiveWorkspaceId,
      loading
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
