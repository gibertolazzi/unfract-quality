"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { arrayUnion, collection, doc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Chat } from '@/lib/chat';

interface ChatContextType {
  chats: Chat[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  isLoadingChats: boolean;
  unreadCount: number;
  unreadCounts: Record<string, number>;
  markChatAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
}

const ChatContext = createContext<ChatContextType>({
  chats: [],
  activeChatId: null,
  setActiveChatId: () => {},
  isLoadingChats: true,
  unreadCount: 0,
  unreadCounts: {},
  markChatAsRead: async () => {},
});

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [userChatIdsKey, setUserChatIdsKey] = useState('');
  const readInFlight = useRef(new Set<string>());

  const markChatAsRead = useCallback(async (chatId: string, messageIds: string[]) => {
    if (!user || messageIds.length === 0) return;
    const newIds = messageIds.filter(id => !readInFlight.current.has(`${chatId}:${id}`));
    if (newIds.length === 0) return;

    newIds.forEach(id => readInFlight.current.add(`${chatId}:${id}`));
    setUnreadCounts(current => ({ ...current, [chatId]: 0 }));

    try {
      for (let start = 0; start < newIds.length; start += 450) {
        const batch = writeBatch(db);
        newIds.slice(start, start + 450).forEach(id => {
          batch.update(doc(db, 'messages', id), { readBy: arrayUnion(user.uid) });
        });
        await batch.commit();
      }
    } catch (error) {
      newIds.forEach(id => readInFlight.current.delete(`${chatId}:${id}`));
      console.error(`Unable to mark messages as read in chat ${chatId}:`, error);
      try {
        const snapshot = await getDocs(query(collection(db, 'messages'), where('chatId', '==', chatId)));
        const unread = snapshot.docs.filter(messageDoc => {
          const message = messageDoc.data();
          return message.senderId !== user.uid &&
            !(Array.isArray(message.readBy) && message.readBy.includes(user.uid)) &&
            !(Array.isArray(message.deletedFor) && message.deletedFor.includes(user.uid)) &&
            !message.deletedForEveryone;
        }).length;
        setUnreadCounts(current => ({ ...current, [chatId]: unread }));
      } catch (refreshError) {
        console.error(`Unable to refresh unread messages for chat ${chatId}:`, refreshError);
      }
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !activeProjectId) {
      setChats([]);
      setActiveChatId(null);
      setIsLoadingChats(false);
      return;
    }

    setIsLoadingChats(true);
    const q = query(
      collection(db, 'chats'),
      where('projectId', '==', activeProjectId),
      where('members', 'array-contains', user.uid),
      // orderBy requires a composite index, so we might need to sort client side if no index exists
      // orderBy('updatedAt', 'desc') 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      
      // Sort descending by updatedAt
      fetchedChats.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis() || 0;
        const timeB = b.updatedAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setChats(fetchedChats);
      
      // Auto-select first chat if none selected OR currently selected chat is not in the list
      setActiveChatId(currentActiveId => {
        const exists = fetchedChats.some(c => c.id === currentActiveId);
        if (!exists && fetchedChats.length > 0) {
          return fetchedChats[0].id;
        }
        if (!exists && fetchedChats.length === 0) {
          return null;
        }
        return currentActiveId;
      });
      
      setIsLoadingChats(false);
    }, (error) => {
      console.error("Error fetching chats:", error);
      setIsLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user, activeProjectId]);

  useEffect(() => {
    if (!user) {
      setUserChatIdsKey('');
      setUnreadCounts({});
      readInFlight.current.clear();
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'chats'), where('members', 'array-contains', user.uid)),
      snapshot => {
        const nextKey = snapshot.docs.map(chatDoc => chatDoc.id).sort().join(',');
        setUserChatIdsKey(currentKey => currentKey === nextKey ? currentKey : nextKey);
      },
      error => console.error('Error fetching chats for unread count:', error)
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !userChatIdsKey) {
      setUnreadCounts({});
      return;
    }

    const chatIds = userChatIdsKey.split(',');
    let isActive = true;
    const countByChat: Record<string, number> = {};

    const updateTotal = () => {
      if (isActive) {
        const visibleCounts = { ...countByChat };
        chatIds.forEach(chatId => {
          if (Array.from(readInFlight.current).some(id => id.startsWith(`${chatId}:`))) {
            visibleCounts[chatId] = 0;
          }
        });
        setUnreadCounts(visibleCounts);
      }
    };

    const unsubscribes = chatIds.map(chatId => onSnapshot(
      query(collection(db, 'messages'), where('chatId', '==', chatId)),
      snapshot => {
        const unread = snapshot.docs.reduce((count, messageDoc) => {
          const message = messageDoc.data();
          const deletedFor = Array.isArray(message.deletedFor) ? message.deletedFor : [];
          const readBy = Array.isArray(message.readBy) ? message.readBy : [];
          if (
            message.senderId !== user.uid &&
            !readBy.includes(user.uid) &&
            !deletedFor.includes(user.uid) &&
            !message.deletedForEveryone
          ) {
            return count + 1;
          }
          return count;
        }, 0);

        const hasPendingRead = Array.from(readInFlight.current).some(id => id.startsWith(`${chatId}:`));
        if (hasPendingRead && unread > 0) return;
        if (unread === 0) {
          Array.from(readInFlight.current).forEach(id => {
            if (id.startsWith(`${chatId}:`)) readInFlight.current.delete(id);
          });
        }
        countByChat[chatId] = unread;
        updateTotal();
      },
      error => console.error(`Error fetching unread messages for chat ${chatId}:`, error)
    ));

    return () => {
      isActive = false;
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user?.uid, userChatIdsKey]);

  const unreadCount = chats.reduce((total, chat) => total + (unreadCounts[chat.id] || 0), 0);

  return (
    <ChatContext.Provider value={{ chats, activeChatId, setActiveChatId, isLoadingChats, unreadCount, unreadCounts, markChatAsRead }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
