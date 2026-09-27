'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { ClockProvider } from '@/contexts/ClockContext';
import { OrganizationProvider } from '@/contexts/OrganizationContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { IamProvider } from '@/contexts/IamContext';
import { RecordingProvider } from '@/contexts/RecordingContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { DialogProvider } from '@/contexts/DialogContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { CrmProvider } from '@/contexts/CrmContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ClockProvider>
        <OrganizationProvider>
          <ProjectProvider>
            <IamProvider>
              <ToastProvider>
                <DialogProvider>
                  <RecordingProvider>
                    <ChatProvider>
                      <CrmProvider>
                        {children}
                      </CrmProvider>
                    </ChatProvider>
                  </RecordingProvider>
                </DialogProvider>
              </ToastProvider>
            </IamProvider>
          </ProjectProvider>
        </OrganizationProvider>
      </ClockProvider>
    </AuthProvider>
  );
}
