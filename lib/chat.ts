import { db } from './firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, query, where, orderBy, getDocs, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';

export interface ChatPermissions {
  canWrite: boolean;
  canAddMembers: boolean;
  canEditChannel: boolean;
}

export interface Chat {
  id: string;
  projectId: string;
  type: 'channel' | 'group' | 'direct';
  name?: string;
  members: string[];
  creatorId?: string;
  permissions?: Record<string, ChatPermissions>;
  createdAt: any;
  updatedAt: any;
}

export interface Attachment {
  type: 'doc' | 'poll' | 'meeting' | 'task' | 'image' | 'video' | 'file' | 'audio';
  payload: any;
}

export interface Mention {
  type: 'user' | 'task' | 'doc' | 'meeting';
  id: string;
  name: string;
  fullItem?: any;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  mentions: Mention[];
  attachments: Attachment[];
  createdAt: any;
  readBy: string[];
  deletedFor?: string[];
  deletedForEveryone?: boolean;
}

export const createChat = async (projectId: string, type: Chat['type'], members: string[], name?: string, creatorId?: string) => {
  const permissions: Record<string, ChatPermissions> = {};
  if (creatorId) {
    permissions[creatorId] = { canWrite: true, canAddMembers: true, canEditChannel: true };
  }
  // Optional: for direct messages or others, give basic perms
  members.forEach(m => {
    if (!permissions[m]) {
      permissions[m] = { canWrite: true, canAddMembers: type !== 'direct', canEditChannel: false };
    }
  });

  const chatRef = await addDoc(collection(db, 'chats'), {
    projectId,
    type,
    members,
    creatorId: creatorId || null,
    permissions,
    name: name || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return chatRef.id;
};

export const sendMessage = async (chatId: string, senderId: string, senderName: string, text: string, mentions: Mention[] = [], attachments: Attachment[] = []) => {
  const msgRef = await addDoc(collection(db, 'messages'), {
    chatId,
    senderId,
    senderName,
    text,
    mentions,
    attachments,
    createdAt: serverTimestamp(),
    readBy: [senderId]
  });
  
  await updateDoc(doc(db, 'chats', chatId), {
    updatedAt: serverTimestamp()
  });

  try {
    const { getDoc } = require('firebase/firestore');
    const chatSnap = await getDoc(doc(db, 'chats', chatId));
    if (chatSnap.exists()) {
      const chatData = chatSnap.data();
      const otherMembers = (chatData.members || []).filter((m: string) => m !== senderId);
      const mentionedUserIds = new Set(mentions.filter(mention => mention.type === 'user').map(mention => mention.id));
      if (otherMembers.length > 0) {
        const { createNotification } = require('./services/notificationService');
        const { queueNotification } = require('./queueNotification');
        const messagePreview = text.trim() || (attachments.length ? `Ha condiviso ${attachments.length} allegato/i.` : 'Nuovo messaggio');
        for (const memberId of otherMembers) {
          await createNotification({
            userId: memberId,
            title: chatData.type === 'direct' ? `Nuovo messaggio da ${senderName}` : `Nuovo messaggio in ${chatData.name || 'Chat'}`,
            description: messagePreview.substring(0, 50) + (messagePreview.length > 50 ? '...' : ''),
            type: 'message',
            link: `/chat`
          });

          const isMentioned = mentionedUserIds.has(memberId);
          try {
            await queueNotification({
              recipientId: memberId,
              type: isMentioned ? 'mention' : 'message',
              projectName: chatData.name || 'Chat',
              taskTitle: chatData.type === 'direct' ? 'Messaggio diretto' : `Chat: ${chatData.name || 'Team'}`,
              authorName: senderName,
              messageHtml: isMentioned ? `${senderName} ti ha menzionato: ${messagePreview}` : messagePreview,
              actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unfract.com'}/chat`,
              chatId,
              messageId: msgRef.id,
            });
          } catch (queueError) {
            console.error(`Unable to queue chat email for ${memberId}:`, queueError);
          }
        }
      }
    }
  } catch (e) {
    console.error("Error sending message notifications", e);
  }
  
  return msgRef.id;
};
