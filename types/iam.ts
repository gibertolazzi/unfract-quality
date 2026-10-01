export type PermissionLevel = 'none' | 'read' | 'write';

export type AppModule = 'crm' | 'tasks' | 'documentation' | 'settings';

export type ModulePermissions = Record<AppModule, PermissionLevel>;

export interface CustomRole {
  id: string;
  projectId: string;
  name: string;
  permissions: ModulePermissions;
  createdAt?: any;
  updatedAt?: any;
}

export interface ProjectMemberAccess {
  id: string; // projectId_userId
  projectId: string;
  userId: string;
  roleId: string; // ID of the CustomRole
  assignedAt?: any;
}

export interface AccessRequest {
  id: string;
  projectId: string;
  userId: string;
  module: AppModule;
  requestedLevel: 'read' | 'write';
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: any;
  resolvedAt?: any;
}
