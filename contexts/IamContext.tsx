'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useProject } from './ProjectContext';
import { CustomRole, ProjectMemberAccess, AppModule, PermissionLevel } from '@/types/iam';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { requestModuleAccess } from '@/lib/services/iamService';

interface IamContextType {
  activeRole: CustomRole | null;
  loading: boolean;
  canRead: (module: AppModule) => boolean;
  canWrite: (module: AppModule) => boolean;
  requestAccess: (module: AppModule, level: 'read' | 'write') => Promise<void>;
}

const IamContext = createContext<IamContextType>({
  activeRole: null,
  loading: true,
  canRead: () => false,
  canWrite: () => false,
  requestAccess: async () => {},
});

// DEFAULT OWNER ROLE (Hardcoded fallback if the user is the project creator, to prevent locking out)
const OWNER_PERMISSIONS: Record<AppModule, PermissionLevel> = {
  crm: 'write',
  marketing: 'write',
  tasks: 'write',
  documentation: 'write',
  settings: 'write'
};

export function IamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  
  const [activeRole, setActiveRole] = useState<CustomRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activeProject) {
      setActiveRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // If the user is the project owner, they get full access automatically
    if (activeProject.userId === user.uid) {
      setActiveRole({
        id: 'owner',
        projectId: activeProject.id,
        name: 'Project Owner',
        permissions: OWNER_PERMISSIONS
      });
      setLoading(false);
      return;
    }

    // Otherwise, listen for their specific role in this project
    const memberId = `${activeProject.id}_${user.uid}`;
    const unsubscribeMember = onSnapshot(doc(db, 'project_members', memberId), (memberSnap) => {
      if (!memberSnap.exists()) {
        // User has no assigned role in this project
        setActiveRole(null);
        setLoading(false);
        return;
      }

      const access = memberSnap.data() as ProjectMemberAccess;
      if (!access.roleId) {
        setActiveRole(null);
        setLoading(false);
        return;
      }

      // Fetch the actual role definition
      getDoc(doc(db, 'project_roles', access.roleId)).then(roleSnap => {
        if (roleSnap.exists()) {
          setActiveRole({ id: roleSnap.id, ...roleSnap.data() } as CustomRole);
        } else {
          setActiveRole(null);
        }
        setLoading(false);
      }).catch(() => {
        setActiveRole(null);
        setLoading(false);
      });
    });

    return () => unsubscribeMember();
  }, [user, activeProject]);

  const canRead = (module: AppModule): boolean => {
    if (!activeRole) return false;
    const perm = activeRole.permissions[module];
    return perm === 'read' || perm === 'write';
  };

  const canWrite = (module: AppModule): boolean => {
    if (!activeRole) return false;
    const perm = activeRole.permissions[module];
    return perm === 'write';
  };

  const requestAccess = async (module: AppModule, level: 'read' | 'write') => {
    if (!user || !activeProject) return;
    await requestModuleAccess(activeProject.id, user.uid, module, level);
  };

  return (
    <IamContext.Provider value={{ activeRole, loading, canRead, canWrite, requestAccess }}>
      {children}
    </IamContext.Provider>
  );
}

export const useIAM = () => useContext(IamContext);
