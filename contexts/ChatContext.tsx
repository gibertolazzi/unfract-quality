"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { Chat } from '@/lib/chat';

interface ChatContextType {
  chats: Chat[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  isLoadingChats: boolean;
}

const ChatContext = createContext<ChatContextType>({
  chats: [],
  activeChatId: null,
  setActiveChatId: () => {},
  isLoadingChats: true,
});

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoadingChats, setIsLoadingChats] = useState(true);

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
      
      // Auto-select first chat if none selected
      if (!activeChatId && fetchedChats.length > 0) {
        setActiveChatId(fetchedChats[0].id);
      }
      
      setIsLoadingChats(false);
    }, (error) => {
      console.error("Error fetching chats:", error);
      setIsLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user, activeProjectId]);

  return (
    <ChatContext.Provider value={{ chats, activeChatId, setActiveChatId, isLoadingChats }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
