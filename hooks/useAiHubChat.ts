import { incrementAiUsage } from '@/lib/usage';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useState, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';


async function executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('503') || errorMessage.includes('429')) {
        const delay = Math.pow(2, attempt - 1) * 1500;
        console.warn(`Gemini API overloaded (503/429). Retrying in ${delay}ms (attempt ${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Retry limit reached without a result.');
}


const AI_HUB_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

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
      const result = await executeWithRetry(() => model.generateContent(prompt));
      if (activeWorkspaceId) await incrementAiUsage(activeWorkspaceId, 1);
      return result.response.text().trim();
    } catch (e) {
      console.error("Errore generazione titolo:", e);
      return "New chat";
    }
  };

  const sendMessage = useCallback(async (text: string, files: File[] = [], uploadedFiles: any[] = []) => {
    if ((!text.trim() && files.length === 0) || !AI_HUB_KEY || !projectId || !userId) return;
    
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
      const genAI = new GoogleGenerativeAI(AI_HUB_KEY);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-3.8-flash',
        systemInstruction: `Sei Unfract AI, l'assistente strategico del progetto aziendale. \n\nContesto del progetto:\n${projectContextText}\n\nRispondi in modo professionale e conciso. Considera solo le attività ancora aperte: non proporre né taggare come prossime azioni le attività completate. Se menzioni un'attività esistente, usa [TASK:id] solo per un ID presente nell'elenco delle attività aperte.\n1. Se l'utente ti chiede di creare una nuova task (o accetti di farlo), DEVI crearla scrivendo ALLA FINE della tua risposta l'esatto blocco:\n$CREATE_TASK$\n{"title": "Titolo breve", "priority": "High", "description": "Descrizione estesa", "category": "General"}\n$END_TASK$\n\nIl sistema intercetterà questo blocco e creerà la task nel database reale!`
      });

      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({
        history,
        generationConfig: {
          maxOutputTokens: 8192,
        }
      });

      
      const fileToGenerativePart = async (file: File) => {
        const base64EncodedDataPromise = new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        return {
          inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
        };
      };

      let userMessageParts: any[] = [{ text }];
      if (files.length > 0) {
        const fileParts = await Promise.all(files.map(fileToGenerativePart));
        userMessageParts.push(...fileParts);
      }
      const result = await executeWithRetry(() => chat.sendMessage(userMessageParts));
      if (activeWorkspaceId) await incrementAiUsage(activeWorkspaceId, 1);
      let responseText = await result.response.text();
      
      // Check for magic task creation block
      const taskRegex = /\$\$CREATE_TASK\$\$[\s\S]*?\{([\s\S]*?)\}[\s\S]*?\$\$END_TASK\$\$/;
      const match = responseText.match(taskRegex);
      
      if (match) {
        try {
          const jsonStr = "{" + match[1] + "}";
          const taskData = JSON.parse(jsonStr);
          
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
            title: taskData.title || "Nuova Task",
            description: taskData.description || "",
            priority: taskData.priority || "Medium",
            category: taskData.category || "General",
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
          responseText = responseText.replace(taskRegex, "\n\n[TASK:" + newTaskRef.id + "]");
          
        } catch (err) {
          console.error("Errore durante la creazione automatica della task:", err);
          responseText = responseText.replace(taskRegex, "\n\n*(Errore: impossibile creare la task nel database)*");
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
