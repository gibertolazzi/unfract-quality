import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface EnqueueNotificationProps {
  recipientId: string;
  type: 'mention' | 'assignment' | 'comment_reply' | 'documentation' | 'meeting';
  projectName: string;
  taskTitle?: string;
  authorName: string;
  authorAvatarUrl?: string;
  messageHtml: string;
  actionUrl: string;
}

export async function queueNotification(props: EnqueueNotificationProps) {
  try {
    const queueRef = collection(db, 'notifications_queue');
    await addDoc(queueRef, {
      ...props,
      createdAt: serverTimestamp(),
      processed: false
    });
  } catch (error) {
    console.error("Error queueing notification:", error);
  }
}
