import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useState, useCallback, useEffect } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { findAiTaskBlock } from '@/lib/aiTaskBlock';
import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deleteStoredFile } from '@/lib/usage';

// Le chiamate a Gemini passano da /api/ai/*: la chiave resta sul server.

export type Message = {
  role: 'user' | 'model';
  content: string;
  attachmentUrls?: string[];
  attachments?: { url: string; name: string; type: string }[];
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
  const { activeWorkspaceId } = useWorkspace();
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
      fetchedChats.sort((a:any, b:any) => {
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
      const chatRef = doc(db, 'ai_chats', id);
      const snapshot = await getDoc(chatRef);
      const chatMessages = snapshot.exists() ? snapshot.data().messages || [] : [];
      for (const message of chatMessages) {
        for (const attachment of message.attachments || []) {
          if (!attachment?.storagePath) continue;
          await deleteStoredFile(attachment.storagePath, {
            workspaceId: attachment.workspaceId,
            bytes: attachment.size,
            usageTracked: attachment.usageTracked === true,
          });
        }
      }
      await deleteDoc(chatRef);
      if (activeChatId === id) {
        setActiveChatId(null);
      }
    } catch (e) {
      console.error("Errore cancellazione chat:", e);
    }
  };

  const generateTitle = async (firstMessage: string) => {
    try {
      const response = await authedFetch('/api/ai/title', {
        method: 'POST',
        body: JSON.stringify({ kind: 'chat', projectId, text: firstMessage }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.title) throw new Error(data.error || `HTTP ${response.status}`);
      return String(data.title).trim();
    } catch (e) {
      console.error("Errore generazione titolo:", e);
      return "New chat";
    }
  };

  const sendMessage = useCallback(async (text: string, files: File[] = [], uploadedFiles: any[] = []) => {
    if ((!text.trim() && files.length === 0) || !projectId || !userId) return;
    
    setIsLoading(true);

    let currentChatId = activeChatId;
    let currentMessages = [...messages];
    
    // Optimistic UI update
    const userMessage: Message = { role: 'user', content: text, attachments: uploadedFiles };
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
      const fileToBase64 = (file: File) => new Promise<{ data: string; mimeType: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ data: (reader.result as string).split(',')[1] || '', mimeType: file.type });
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const response = await authedFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          projectContext: projectContextText,
          attachments: await Promise.all(files.map(fileToBase64)),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 402 && typeof data.error === 'string') {
        // Crediti del mese finiti: lo si dice, senza ripiegare su altri modelli.
        currentMessages.push({ role: 'model', content: data.error });
        if (currentChatId) {
          await updateDoc(doc(db, 'ai_chats', currentChatId), { messages: currentMessages, updatedAt: serverTimestamp() });
        }
        return;
      }
      if (!response.ok || typeof data.text !== 'string') throw new Error(data.error || `HTTP ${response.status}`);
      let responseText: string = data.text;
      
      // Blocco con cui l'AI chiede di creare un task (vedi lib/aiTaskBlock.ts).
      const found = findAiTaskBlock(responseText);
      if (found) {
        try {
          if (!found.task) throw new Error('Blocco del task non leggibile');
          const taskData = found.task;

          // 1. Get first column for the project
          const colsQuery = query(collection(db, 'columns'), where('projectId', '==', projectId));
          const colsSnap = await getDocs(colsQuery);
          let columnId = 'backlog'; // fallback
          if (!colsSnap.empty) {
            // Sort by order and pick first
            const cols = colsSnap.docs.map(d => ({id: d.id, ...d.data()})).sort((a:any, b:any) => (a.order || 0) - (b.order || 0));
            columnId = cols[0].id;
          }

          // 2. Create the task in Firestore
          const newTaskRef = await addDoc(collection(db, 'tasks'), {
            projectId,
            columnId,
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            category: taskData.category,
            requesterUid: userId,
            assigneeUid: userId,
            createdBy: userId,
            lastModifiedBy: userId,
            createdAt: serverTimestamp(),
            order: 0,
            assignees: 1,
            comments: []
          });

          // 3. Replace the magic block with the visual TASK tag
          responseText = responseText.replace(found.block, "\n\n[TASK:" + newTaskRef.id + "]");

        } catch (err) {
          console.error("Errore durante la creazione automatica della task:", err);
          responseText = responseText.replace(found.block, "\n\n*(Errore: impossibile creare la task nel database)*");
        }
      }

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
      console.error("Errore AI Hub principale:", error);
      let fallbackText = "";
      
      // Fallback a LLM locale (Gemini Nano in Chrome) se disponibile
      try {
        if (typeof window !== 'undefined' && 'ai' in window && 'languageModel' in (window as any).ai) {
           console.log("Tentativo di fallback su modello locale (window.ai)...");
           const session = await (window as any).ai.languageModel.create({
             systemPrompt: `Sei Unfract AI, assistente strategico. Contesto del progetto: ${projectContextText}\nConsidera solo le attività aperte. Non consigliare né taggare task completate; usa [TASK:id] solo per task aperte elencate nel contesto.`
           });
           
           let localPrompt = "";
           messages.slice(-4).forEach(m => {
              localPrompt += m.role === 'user' ? `Utente: ${m.content}\n` : `AI: ${m.content}\n`;
           });
           localPrompt += `Utente: ${text}\nAI:`;
           
           fallbackText = await session.prompt(localPrompt);
           fallbackText += "\n\n*(Risposta generata dal modello locale di backup)*";
        }
      } catch (localError) {
         console.error("Errore nel fallback locale:", localError);
      }

      const responseText = fallbackText || "Scusa, si è verificato un errore durante la connessione con i server AI, e il modello locale non è disponibile. Riprova più tardi.";
      const modelMessage: Message = { role: 'model', content: responseText };
      currentMessages.push(modelMessage);
      
      if (currentChatId) {
        await updateDoc(doc(db, 'ai_chats', currentChatId), {
          messages: currentMessages,
          updatedAt: serverTimestamp()
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [messages, projectContextText, activeChatId, projectId, userId, activeWorkspaceId]);

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
