'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ClockProvider } from '@/contexts/ClockContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ClockProvider>
        <OrganizationProvider>
          <ProjectProvider>
            {children}
          </ProjectProvider>
        </OrganizationProvider>
      </ClockProvider>
    </AuthProvider>
  );
}
