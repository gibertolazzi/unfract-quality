import type { AppModule, ModulePermissions, PermissionLevel } from '@/types/iam';

/**
 * Permessi per modulo di un utente su un progetto (task, documenti, CRM,
 * impostazioni).
 *
 * Li usano l'app (`contexts/IamContext.tsx`) e il server MCP
 * (`lib/server/mcp/access.ts`): il calcolo è uno solo, così un assistente
 * collegato non vede mai più di quello che l'utente vede nell'app.
 *
 * - Chi ha creato il progetto e gli amministratori del workspace: tutto.
 * - Gli altri: il permesso più alto fra i ruoli assegnati a loro o alle loro
 *   squadre (`project_members` → `project_roles`). Senza ruoli: niente.
 */

export const APP_MODULES: AppModule[] = ['crm', 'tasks', 'documentation', 'settings'];

export const OWNER_PERMISSIONS: ModulePermissions = {
  crm: 'write',
  tasks: 'write',
  documentation: 'write',
  settings: 'write',
};

export const NO_PERMISSIONS: ModulePermissions = {
  crm: 'none',
  tasks: 'none',
  documentation: 'none',
  settings: 'none',
};

/** Il permesso più alto fra i ruoli, modulo per modulo. */
export function mergeRolePermissions(roles: Array<Partial<Record<AppModule, PermissionLevel>> | null | undefined>): ModulePermissions {
  const merged: ModulePermissions = { ...NO_PERMISSIONS };
  for (const permissions of roles) {
    if (!permissions) continue;
    for (const appModule of APP_MODULES) {
      const level = permissions[appModule];
      if (level === 'write') merged[appModule] = 'write';
      if (level === 'read' && merged[appModule] === 'none') merged[appModule] = 'read';
    }
  }
  return merged;
}

export function canReadModule(permissions: ModulePermissions | null | undefined, appModule: AppModule): boolean {
  const level = permissions?.[appModule];
  return level === 'read' || level === 'write';
}

export function canWriteModule(permissions: ModulePermissions | null | undefined, appModule: AppModule): boolean {
  return permissions?.[appModule] === 'write';
}
