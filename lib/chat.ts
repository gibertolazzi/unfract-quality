import { db } from './firebase';
import { collection, doc, addDoc, updateDoc, serverTimestamp, query, where, orderBy, getDocs, onSnapshot, arrayUnion, arrayRemove } from 'firebase/firestore';

export interface Chat {
  id: string;
  projectId: string;
  type: 'channel' | 'group' | 'direct';
  name?: string;
  members: string[];
  createdAt: any;
  updatedAt: any;
}

export interface Attachment {
  type: 'doc' | 'poll' | 'meeting' | 'task' | 'image' | 'video' | 'file';
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
}

export const createChat = async (projectId: string, type: Chat['type'], members: string[], name?: string) => {
  const chatRef = await addDoc(collection(db, 'chats'), {
    projectId,
    type,
    members,
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
  
  return msgRef.id;
};
