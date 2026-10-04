import { auth } from './firebase';

export type QueuedEmailType = 'assignment' | 'requester' | 'changes' | 'mention' | 'message';

export interface EnqueueNotificationProps {
  recipientId: string;
  type: QueuedEmailType;
  projectName: string;
  taskTitle?: string;
  authorName: string;
  authorAvatarUrl?: string;
  messageHtml: string;
  actionUrl: string;
  taskId?: string;
  chatId?: string;
  messageId?: string;
}

export async function queueNotification(props: EnqueueNotificationProps) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Authentication required to queue email notifications.');

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/notifications/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(props),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Unable to queue email notification.');
  }
}
