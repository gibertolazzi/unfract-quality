import { useState, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const AI_HUB_KEY = process.env.NEXT_PUBLIC_AI_HUB_GEMINI_KEY || '';

export type Message = {
  role: 'user' | 'model';
  content: string;
};

export type AiChat = {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: any;
  updatedAt: any;
};

export function useAiHubChat(projectContextText: string, projectId?: string, userId?: string) {
  const [chats, setChats] = useState<AiChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch chats for the current user and project
  useEffect(() => {
    if (!projectId || !userId) return;

    const q = query(
      collection(db, 'ai_chats'),
      where('projectId', '==', projectId),
      where('userId', '==', userId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AiChat));
      // Sort in memory to avoid requiring a composite index in Firestore
      fetchedChats.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || Date.now();
        const timeB = b.updatedAt?.toMillis?.() || Date.now();
        return timeB - timeA;
      });
      setChats(fetchedChats);
      
      // If no active chat but we have chats, don't automatically select one to allow "New chat" state
    });

    return () => unsub();
  }, [projectId, userId]);

  const activeChat = chats.find(c => c.id === activeChatId);
  const messages = activeChat?.messages || [];

  const createNewChat = () => {
    setActiveChatId(null);
  };

  const deleteChat = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ai_chats', id));
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    } catch (e) {
      console.error("Errore cancellazione chat:", e);
    }
  };

  const generateTitle = async (firstMessage: string) => {
    try {
      const genAI = new GoogleGenerativeAI(AI_HUB_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
      const prompt = `Genera un titolo molto breve (massimo 4-5 parole) per descrivere questo messaggio dell'utente. Restituisci SOLO il titolo senza virgolette e senza altra punteggiatura.\nMessaggio: "${firstMessage}"`;
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      return "New chat";
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !AI_HUB_KEY || !projectId || !userId) return;
    
    setIsLoading(true);

    let currentChatId = activeChatId;
    let currentMessages = [...messages];
    
    // Optimistic UI update
    const userMessage: Message = { role: 'user', content: text };
    currentMessages.push(userMessage);

    // If new chat, create it in Firestore first
    if (!currentChatId) {
      const newChatRef = await addDoc(collection(db, 'ai_chats'), {
        projectId,
        userId,
        title: "New chat...", // Temporary title
        messages: [userMessage],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      currentChatId = newChatRef.id;
      setActiveChatId(currentChatId);
      
      // Generate title in background
      generateTitle(text).then(title => {
        updateDoc(newChatRef, { title }).catch(console.error);
      }).catch(console.error);
      
    } else {
      // Update existing chat
      await updateDoc(doc(db, 'ai_chats', currentChatId), {
        messages: currentMessages,
        updatedAt: serverTimestamp()
      });
    }

    try {
      const genAI = new GoogleGenerativeAI(AI_HUB_KEY);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.8-flash',
        systemInstruction: `Sei Unfract AI, l'assistente strategico del progetto aziendale. \n\nContesto del progetto:\n${projectContextText}\n\nRispondi alle domande dell'utente in modo professionale e conciso. Se l'utente chiede lo stato di una task, o menziona una task specifica, INCLUDI SEMPRE il tag speciale [TASK:id_della_task] nel tuo testo per permettere al sistema di mostrare la card visiva.` 
      });

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({
        history,
        generationConfig: {
          maxOutputTokens: 1000,
        }
      });

      const result = await chat.sendMessage(text);
      const responseText = await result.response.text();
      
      const modelMessage: Message = { role: 'model', content: responseText };
      currentMessages.push(modelMessage);

      // Save model response to Firestore
      if (currentChatId) {
        await updateDoc(doc(db, 'ai_chats', currentChatId), {
          messages: currentMessages,
          updatedAt: serverTimestamp()
        });
      }

    } catch (error) {
      console.error("Errore AI Hub:", error);
      const errorMessage: Message = { role: 'model', content: "Scusa, si è verificato un errore durante la connessione con l'AI. Riprova più tardi." };
      currentMessages.push(errorMessage);
      if (currentChatId) {
        await updateDoc(doc(db, 'ai_chats', currentChatId), {
          messages: currentMessages,
          updatedAt: serverTimestamp()
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, projectContextText, activeChatId, projectId, userId]);

  return {
    messages,
    chats,
    activeChatId,
    setActiveChatId,
    createNewChat,
    deleteChat,
    isLoading,
    sendMessage
  };
}
