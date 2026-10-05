export type StructureMode = 'flat' | 'teams' | 'corporate';

export interface WorkspaceQuotas {
  planTier: 'free' | 'pro' | 'enterprise';
  storageUsed: number;
  storageLimit: number;
  aiCreditsUsed: number;
  aiCreditsLimit: number;
  aiCreditsPeriod?: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  structureMode: StructureMode;
  bannerGradient?: string;
  bannerUrl?: string;
  logoUrl?: string;
  quotas?: WorkspaceQuotas;
  createdAt?: any;
  updatedAt?: any;
}

export type WorkspaceRole = 'admin' | 'member' | 'guest';

// La collection "access_grants" è il cuore del nuovo sistema IAM
export interface AccessGrant {
  id: string;
  workspaceId: string;
  
  // CHI riceve l'accesso
  subjectType: 'user' | 'group'; 
  subjectId: string; // userId o groupId
  
  // A COSA riceve l'accesso
  resourceType: 'workspace' | 'project'; 
  resourceId: string; // workspaceId o projectId
  
  // CON CHE RUOLO
  role: WorkspaceRole | string; // 'admin', 'member', 'guest' o ID di un custom role
  createdAt?: any;
}

export interface WorkspaceGroup {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt?: any;
}

export interface WorkspaceProject {
  id: string;
  workspaceId: string;
  name: string;
  creatorId: string;
  createdAt?: any;
  updatedAt?: any;
}
