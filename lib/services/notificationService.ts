import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type NotificationType = 'task' | 'meeting' | 'transcript' | 'documentation' | 'organization' | 'access_request' | 'message';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  description: string;
  type: NotificationType;
  link?: string;
  metadata?: any;
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const notifRef = collection(db, 'notifications');
    await addDoc(notifRef, {
      ...params,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
};
