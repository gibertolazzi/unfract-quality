'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useProject } from './ProjectContext';
import { useWorkspace } from './WorkspaceContext';
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
  tasks: 'write',
  documentation: 'write',
  settings: 'write'
};

export function IamProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const { activeWorkspaceId } = useWorkspace();
  
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

    const checkAccess = async () => {
      try {
        const { collection, query, where, getDocs, doc, getDoc } = await import('firebase/firestore');
        
        // 1. Check if Workspace Admin (via access_grants)
        if (activeWorkspaceId) {
          const grantsQ = query(collection(db, 'access_grants'), where('subjectId', '==', user.uid), where('workspaceId', '==', activeWorkspaceId));
          const grantsSnap = await getDocs(grantsQ);
          const isWorkspaceAdmin = grantsSnap.docs.some(d => {
            const g = d.data();
            return g.resourceType === 'workspace' && g.resourceId === activeWorkspaceId && g.role === 'admin';
          });
          
          if (isWorkspaceAdmin) {
            setActiveRole({
              id: 'workspace_admin',
              projectId: activeProject.id,
              name: 'Workspace Admin',
              permissions: OWNER_PERMISSIONS
            });
            setLoading(false);
            return;
          }
        }

        // 2. Fetch project roles and member access mappings
        const pmQ = query(collection(db, 'project_members'), where('projectId', '==', activeProject.id));
        const pmSnap = await getDocs(pmQ);
        const membersAccess = pmSnap.docs.map(d => d.data() as ProjectMemberAccess);

        let highestPerms: Record<AppModule, PermissionLevel> = {
          crm: 'none', tasks: 'none', documentation: 'none', settings: 'none'
        };
        let foundAnyRole = false;

        const evaluateRole = async (roleId: string) => {
          const roleSnap = await getDoc(doc(db, 'project_roles', roleId));
          if (roleSnap.exists()) {
            const roleData = roleSnap.data() as CustomRole;
            foundAnyRole = true;
            (Object.keys(highestPerms) as AppModule[]).forEach(mod => {
              const perm = roleData.permissions[mod];
              if (perm === 'write') highestPerms[mod] = 'write';
              if (perm === 'read' && highestPerms[mod] === 'none') highestPerms[mod] = 'read';
            });
          }
        };

        // A. Direct Assignment
        const directAccess = membersAccess.find(m => m.userId === user.uid);
        if (directAccess && directAccess.roleId) {
          await evaluateRole(directAccess.roleId);
        }

        // B. Team Assignments
        if (activeWorkspaceId) {
          const grantsQ = query(collection(db, 'access_grants'), where('subjectId', '==', user.uid), where('resourceType', '==', 'workspace_group'));
          const grantsSnap = await getDocs(grantsQ);
          const teamIds = grantsSnap.docs.map(d => d.data().resourceId);
          
          for (const teamId of teamIds) {
            const teamAccess = membersAccess.find(m => m.userId === teamId);
            if (teamAccess && teamAccess.roleId) {
              await evaluateRole(teamAccess.roleId);
            }
          }
        }

        if (foundAnyRole) {
          setActiveRole({
            id: 'inherited_role',
            projectId: activeProject.id,
            name: 'Inherited Role',
            permissions: highestPerms
          });
        } else {
          setActiveRole(null);
        }
      } catch (e) {
        console.error(e);
        setActiveRole(null);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, activeProject, activeWorkspaceId]);

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
