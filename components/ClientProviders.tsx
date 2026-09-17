'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ClockProvider } from '@/contexts/ClockContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { RecordingProvider } from '@/contexts/RecordingContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { DialogProvider } from '@/contexts/DialogContext';
import { ChatProvider } from '@/contexts/ChatContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ClockProvider>
        <OrganizationProvider>
          <ProjectProvider>
            <ToastProvider>
              <DialogProvider>
                <RecordingProvider>
                  <ChatProvider>
                    {children}
                  </ChatProvider>
                </RecordingProvider>
              </DialogProvider>
            </ToastProvider>
          </ProjectProvider>
        </OrganizationProvider>
      </ClockProvider>
    </AuthProvider>
  );
}
