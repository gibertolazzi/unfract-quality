"use client";

import React, { useState, useEffect } from "react";
import { Search, Edit3, Plus, Mic, Link as LinkIcon, Cpu, CheckSquare, Calendar, FileText, ChevronRight, Loader2, Send, X, Trash2, Menu, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { useSearchParams, useRouter } from "next/navigation";
import { useAiHubChat } from "@/hooks/useAiHubChat";
import { fetchProjectContext } from "@/lib/ai-hub";
import { db } from "@/lib/firebase";
import { deleteStoredFile, StorageLimitError, trackUpload } from "@/lib/usage";
import { useToast } from "@/contexts/ToastContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "@/contexts/TranslationContext";
import { taskStatus } from '@/lib/taskWorkflow';

export function AiHubView() {
  const { user } = useAuth();
  const router = useRouter();
  const { activeProject, activeProjectId } = useProject();
  const { t, locale } = useTranslation();
  // Spazio e crediti vanno al workspace del progetto aperto, non a quello attivo.
  const { activeProjectWorkspaceId: activeWorkspaceId } = useProject();
  const toast = useToast();

  const [inputMessage, setInputMessage] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showMCPModal, setShowMCPModal] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);
  // Il server MCP può essere spento (in prod finché non si attiva): lo si chiede ai suoi metadati.
  const [mcpAvailable, setMcpAvailable] = useState<boolean | null>(null);
  const mcpUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  // Keep task completion and columns live so completed work is never offered as an action.
  useEffect(() => {
    if (!activeProjectId) {
      setTasks([]);
      setColumns([]);
      return;
    }
    const taskQuery = query(collection(db, 'tasks'), where('projectId', '==', activeProjectId));
    const columnQuery = query(collection(db, 'columns'), where('projectId', '==', activeProjectId));
    const unsubscribeTasks = onSnapshot(taskQuery, snapshot => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, error => console.error('Unable to load AI Hub tasks:', error));
    const unsubscribeColumns = onSnapshot(columnQuery, snapshot => {
      setColumns(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, error => console.error('Unable to load AI Hub task columns:', error));

    return () => {
      unsubscribeTasks();
      unsubscribeColumns();
    };
  }, [activeProjectId]);

  const isTaskCompleted = (task: any) => {
    // Con una colonna, decide la sua categoria (lib/taskWorkflow.ts): un
    // `completedAt` rimasto da prima non basta.
    if (columns.some(column => column.id === task.columnId)) return taskStatus(task, columns) === 'done';
    const status = String(task.status || '').trim().toLowerCase();
    return task.completed === true || task.isDone === true || Boolean(task.completedAt) ||
      status === 'done' || status === 'completed' || status === 'fatto' || status === 'completato';
  };
  const actionableTasks = tasks.filter(task => !isTaskCompleted(task));
  const isEn = locale === 'en';
  const context = activeProject ? (
    isEn
      ? `Project: ${activeProject.name}\n\nTasks remaining to complete:\n${actionableTasks.map(task => `- [TASK:${task.id}] ${task.title} (status: ${columns.find(column => column.id === task.columnId)?.title || task.status || 'To Do'}, priority: ${task.priority || 'medium'})`).join('\n') || 'No open tasks.'}\n\nDo not suggest or re-propose completed tasks.`
      : `Progetto: ${activeProject.name}\n\nAttività ancora da completare:\n${actionableTasks.map(task => `- [TASK:${task.id}] ${task.title} (stato: ${columns.find(column => column.id === task.columnId)?.title || task.status || 'To Do'}, priorità: ${task.priority || 'medium'})`).join('\n') || 'Nessuna attività aperta.'}\n\nNon consigliare né riproporre attività completate.`
  ) : "";

  const { 
    messages, 
    isLoading, 
    sendMessage, 
    chats, 
    activeChatId, 
    setActiveChatId, 
    createNewChat,
    deleteChat
  } = useAiHubChat(context, activeProject?.id, user?.uid, (locale as 'it' | 'en'));

  const searchParams = useSearchParams();
  const urlChatId = searchParams?.get('chatId');
  useEffect(() => {
    if (urlChatId && chats.find(c => c.id === urlChatId)) {
      setActiveChatId(urlChatId);
    }
  }, [urlChatId, chats, setActiveChatId]);

  const activeChat = chats.find(c => c.id === activeChatId);

  const handleSend = async () => {
    if (!inputMessage.trim() && attachments.length === 0) return;
    setIsUploadingMedia(true);
    let textToProcess = inputMessage;
    let uploadedFiles: { url: string; name: string; type: string; storagePath?: string; size?: number; workspaceId?: string | null; usageTracked?: boolean }[] = [];
    
    if (attachments.length > 0 && activeProjectId) {
      try {
        const { storage } = await import('@/lib/firebase');
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        
        for (const file of attachments) {
          const storageRef = ref(storage, `ai-hub/${activeProjectId}/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          const usageTracked = await trackUpload(activeWorkspaceId, storageRef.fullPath);
          uploadedFiles.push({
            url,
            name: file.name,
            type: file.type,
            storagePath: storageRef.fullPath,
            size: file.size,
            workspaceId: activeWorkspaceId,
            usageTracked,
          });
        }
      } catch (e) {
        console.error("Error uploading attachments:", e);
        if (e instanceof StorageLimitError) {
          // Spazio finito: il messaggio resta da inviare. Gli allegati già
          // caricati si tolgono, altrimenti occuperebbero spazio senza essere usati.
          await Promise.all(uploadedFiles.map(f => f.storagePath
            ? deleteStoredFile(f.storagePath, { usageTracked: f.usageTracked }).catch(console.error)
            : undefined));
          toast.error(e.message);
          setIsUploadingMedia(false);
          return;
        }
      }
    }
    
    const filesToSend = [...attachments];
    setInputMessage("");
    setAttachments([]);
    setIsUploadingMedia(false);
    sendMessage(textToProcess || "Media in allegato", filesToSend, uploadedFiles);
  };

  const handleMicClick = () => {
    if (inputMessage || attachments.length > 0) {
      handleSend();
      return;
    }
    
    if (!('webkitSpeechRecognition' in window)) {
      alert("Il tuo browser non supporta il riconoscimento vocale.");
      return;
    }
    
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = true;
    
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((res: any) => res[0].transcript)
        .join('');
      setInputMessage(transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === "High" || priority === "Critical") return "bg-[#FF0004]/10 text-[#FF0004] border-[#FF0004]/30";
    if (priority === "Medium") return "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30";
    return "bg-[#00FF38]/10 text-[#00FF38] border-[#00FF38]/30";
  };

  const getPriorityGlow = (priority: string) => {
    if (priority === "High" || priority === "Critical") return "bg-[#FF0004]";
    if (priority === "Medium") return "bg-[#FFB800]";
    return "bg-[#00FF38]";
  };

  const renderMessageContent = (content: string) => {
    const taskMatch = content.match(/\[TASK:([a-zA-Z0-9_]+)\]/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      const task = tasks.find(t => t.id === taskId && !isTaskCompleted(t));
      
      const cleanContent = content.replace(/\[TASK:[a-zA-Z0-9_]+\]/g, '').trim();
      
      return (
        <div className="flex flex-col gap-2">
          {cleanContent && (
            <div className="markdown-body [&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>li]:mb-1 [&>strong]:font-semibold [&>strong]:text-white [&>a]:text-[#006AFF] [&>a]:underline">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {cleanContent}
              </ReactMarkdown>
            </div>
          )}
          
          {task && (
            <div onClick={() => router.push(`/?highlightTask=${task.id}`)} className="flex items-center justify-between w-full max-w-[480px] bg-[#090909] border border-white/5 rounded-full px-5 py-3 hover:bg-white/5 cursor-pointer transition-all group relative overflow-hidden my-3 shadow-lg">
              {/* Dynamic subtle outer glow based on priority */}
              <div className={`absolute inset-0 rounded-full ${getPriorityGlow(task.priority || 'Medium')} opacity-[0.03] pointer-events-none`} />
              <div className={`absolute -right-10 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full ${getPriorityGlow(task.priority || 'Medium')} opacity-20 blur-[30px] pointer-events-none`} />
              
              <div className="flex items-center gap-4 z-10">
                {/* Category Pill */}
                <div className="flex items-center justify-center min-w-[70px] h-7 bg-white/5 border border-white/5 rounded-full px-3 shrink-0">
                  <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">{task.category || 'TASK'}</span>
                </div>
                
                {/* Task Title */}
                <span className="text-sm font-medium text-white truncate max-w-[200px] group-hover:text-[#006AFF] transition-colors">{task.title}</span>
              </div>
              
              <div className="flex items-center gap-3 shrink-0 z-10">
                {/* Priority */}
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getPriorityColor(task.priority || 'Medium')} shrink-0`}>
                  {task.priority || 'Medium'}
                </span>
                <ChevronRight size={16} className="text-[#858585] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="markdown-body [&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5 [&>li]:mb-1 [&>strong]:font-semibold [&>strong]:text-white [&>a]:text-[#006AFF] [&>a]:underline [&>h1]:text-lg [&>h1]:font-bold [&>h2]:text-base [&>h2]:font-bold [&>h3]:text-sm [&>h3]:font-bold">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full text-white relative">
      {/* Background shaders for the entire view */}
      <div className="absolute -inset-8 z-0 pointer-events-none overflow-hidden rounded-[31px] bg-[#050505]">
        <div className="absolute bottom-[-30%] left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-white opacity-[0.06] blur-[140px] rounded-full" />
        <div className="absolute bottom-[-45%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-[#006AFF] opacity-[0.35] blur-[140px] rounded-full animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden rounded-[31px]"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Inner Sidebar */}
      <div className={`
        w-[300px] sm:w-[320px] shrink-0 p-5 flex flex-col gap-6 z-50 rounded-[32px] border border-white/[0.08] bg-[#0a0a0a] md:bg-black/40 backdrop-blur-[40px]
        my-4 ml-4
        absolute md:relative h-[calc(100%-2rem)] md:h-auto
        transition-transform duration-300 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'}
      `}>
        {/* Mobile Sidebar Header */}
        <div className="md:hidden flex items-center justify-between -mb-2">
          <span className="text-[12px] font-semibold text-[#858585] tracking-wider uppercase">{t.aiHub.menu}</span>
          <button 
            onClick={() => setIsMobileSidebarOpen(false)}
            className="text-[#858585] hover:text-white bg-white/5 p-1.5 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Connect Button */}
        <button onClick={() => {
          setShowMCPModal(true);
          if (mcpAvailable === null) fetch("/api/oauth/protected-resource").then(r => setMcpAvailable(r.ok)).catch(() => setMcpAvailable(false));
        }} className="relative w-full h-[60px] rounded-[30px] overflow-hidden group hover:opacity-90 transition-opacity">
          <img src="/connectagent.svg" alt="Connect agent with MCP" className="w-full h-full object-cover" />
        </button>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#858585]" />
            <input 
              type="text" 
              placeholder={t.aiHub.searchChat}
              className="w-full bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[13px] text-white placeholder:text-[#555555] outline-none focus:border-white/20 transition-all"
            />
          </div>
          <button onClick={() => { createNewChat(); setIsMobileSidebarOpen(false); }} className="flex items-center justify-center gap-2 bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-[13px] text-white hover:bg-white/10 transition-all">
            <Edit3 size={14} />
            <span>{t.aiHub.newChat}</span>
          </button>
        </div>

        {/* Recenti */}
        <div className="flex flex-col flex-1 overflow-hidden mt-2">
          <span className="text-[11px] font-semibold text-[#555555] uppercase tracking-wider mb-2 px-2">{t.aiHub.recent}</span>
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {chats.map(chat => (
              <div 
                key={chat.id}
                onClick={() => { setActiveChatId(chat.id); setIsMobileSidebarOpen(false); }}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer text-[13px] ${
                  activeChatId === chat.id 
                    ? 'bg-white/10 text-white font-medium' 
                    : 'hover:bg-white/5 text-[#858585] hover:text-white'
                }`}
              >
                <span className="truncate pr-6">{chat.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatToDelete(chat.id);
                  }}
                  className={`absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 ${
                    activeChatId === chat.id ? 'text-white' : 'text-[#858585]'
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-transparent z-10 w-full">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 z-20 shrink-0">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center backdrop-blur-sm"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-white">{activeChat?.title || t.aiHub.newChat}</span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>
        
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6 relative z-10 items-center">
          {/* Title from the target design */}
          <h2 className="text-[14px] font-medium text-[#858585] mb-6 tracking-wide hidden md:block">{activeChat?.title || t.aiHub.newChat}</h2>

          {messages.length === 0 ? (
            <div className="flex flex-col items-center mt-auto mb-4">
              <div className="flex items-center gap-3">
                <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 30H6V23.9155H18V0H24V30ZM6 23.9155H0V0H6V23.9155Z" fill="url(#paint0_linear_377_1178)"/>
                  <defs>
                    <linearGradient id="paint0_linear_377_1178" x1="32" y1="-2.98023e-07" x2="19.2478" y2="32.8164" gradientUnits="userSpaceOnUse">
                      <stop stopColor="white"/>
                      <stop offset="0.596154" stopColor="#006AFF"/>
                      <stop offset="1" stopColor="#00A6FF"/>
                    </linearGradient>
                  </defs>
                </svg>
                <h2 className="text-[#FFF] font-sans text-[24px] font-medium leading-[20px] tracking-[-0.96px] mt-1">
                  {t.aiHub.hello} {user?.displayName ? user.displayName.split(' ')[0] : 'User'}!
                </h2>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl flex flex-col gap-6">
              {messages.map((msg, i) => {
                const hasAttachments = (msg.attachments && msg.attachments.length > 0) || (msg.attachmentUrls && msg.attachmentUrls.length > 0);
                
                return (
                  <div key={i} className={`flex flex-col gap-2 w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    
                    {/* Render attachments outside and above the bubble */}
                    {hasAttachments && (
                      <div className={`flex flex-wrap gap-2 max-w-[80%] ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.attachments ? msg.attachments.map((file, idx) => (
                          <div key={idx} className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 group bg-[#111]" title={file.name}>
                            {file.type.startsWith('image/') ? (
                              <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center">
                                 <FileText size={20} className="text-[#858585]" />
                              </div>
                            )}
                          </div>
                        )) : msg.attachmentUrls?.map((url, idx) => (
                          <div key={idx} className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 group bg-[#111]" title="Attachment">
                            {url.includes('.pdf') || url.includes('.doc') ? (
                              <div className="w-full h-full flex flex-col items-center justify-center">
                                 <FileText size={20} className="text-[#858585]" />
                              </div>
                            ) : (
                              <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Render text bubble */}
                    {msg.content && (
                      <div className={`max-w-[80%] rounded-[24px] px-6 py-4 text-[14px] leading-relaxed ${
                        msg.role === 'user' 
                          ? 'bg-white/5 border border-white/5 text-[#E0E0E0] rounded-tr-sm' 
                          : 'text-[#CCCCCC]'
                      }`}>
                        {renderMessageContent(msg.content)}
                      </div>
                    )}
                    
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="max-w-[70%] rounded-2xl px-5 py-3.5 text-[15px] text-[#858585] flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> {t.aiHub.thinking}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="pb-6 pt-2 px-4 md:pb-8 md:pt-4 md:px-6 shrink-0 flex flex-col items-center justify-center relative z-10 gap-2">
          {attachments.length > 0 && (
            <div className="w-full max-w-[700px] flex items-center gap-4 overflow-x-auto pb-2">
              {attachments.map((file, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 group bg-[#111]">
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                       <FileText size={20} className="text-[#858585]" />
                    </div>
                  )}
                  <button 
                    onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative w-full max-w-[700px] flex items-center gap-4">
            
            {/* + Button */}
            <div className="relative shrink-0">
              <input 
                type="file" 
                id="media-upload" 
                className="hidden" 
                multiple
                accept="image/*,video/*,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
              />
              <button 
                onClick={() => document.getElementById('media-upload')?.click()}
                className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#858585] hover:text-white hover:bg-white/10 transition-all shadow-[inset_0_1px_4px_rgba(255,255,255,0.15)] border border-white/5"
              >
                <Plus size={20} />
              </button>
            </div>
            
            {/* Input Field */}
            <input 
              type="text" 
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={t.aiHub.askAnything}
              className="w-full bg-white/5 rounded-full pl-6 pr-6 py-3.5 text-[15px] text-white placeholder:text-[#555555] outline-none focus:bg-white/10 transition-all shadow-[inset_0_1px_4px_rgba(255,255,255,0.15)] border border-white/5 backdrop-blur-md"
              disabled={isLoading || isUploadingMedia || !context}
            />

            {/* Mic / Send Button */}
            <button 
              onClick={handleMicClick} 
              disabled={isLoading || isUploadingMedia || !context} 
              className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-500 shrink-0 overflow-hidden ${
                (isLoading || isUploadingMedia) ? 'bg-[#333333]' : 
                inputMessage || attachments.length > 0
                  ? 'bg-[#006AFF] shadow-[0_0_20px_rgba(0,106,255,0.4)] hover:bg-[#0055CC]' 
                  : isRecording ? 'bg-red-500 animate-pulse' : 'bg-transparent hover:bg-white/5'
              } disabled:opacity-50`}
            >
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${(isLoading || isUploadingMedia) ? 'opacity-100' : 'opacity-0 scale-50'}`}>
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${!(isLoading || isUploadingMedia) && (inputMessage || attachments.length > 0) ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-45'}`}>
                <Send size={20} className="mr-0.5 mt-0.5" />
              </div>
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${!(isLoading || isUploadingMedia) && !(inputMessage || attachments.length > 0) ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-150 rotate-45'}`}>
                <svg width="48" height="48" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="60" height="60" rx="30" fill="url(#paint0_linear_365_644)"/>
                  <path d="M30.2041 34.5459C31.3972 34.5447 32.5411 34.0702 33.3847 33.2265C34.2284 32.3829 34.7029 31.239 34.7041 30.0459V24.0459C34.7041 22.8524 34.23 21.7078 33.3861 20.8639C32.5422 20.02 31.3976 19.5459 30.2041 19.5459C29.0106 19.5459 27.866 20.02 27.0221 20.8639C26.1782 21.7078 25.7041 22.8524 25.7041 24.0459V30.0459C25.7053 31.239 26.1798 32.3829 27.0235 33.2265C27.8671 34.0702 29.011 34.5447 30.2041 34.5459ZM27.2041 24.0459C27.2041 23.2502 27.5202 22.4872 28.0828 21.9246C28.6454 21.362 29.4085 21.0459 30.2041 21.0459C30.9998 21.0459 31.7628 21.362 32.3254 21.9246C32.888 22.4872 33.2041 23.2502 33.2041 24.0459V30.0459C33.2041 30.8415 32.888 31.6046 32.3254 32.1672C31.7628 32.7298 30.9998 33.0459 30.2041 33.0459C29.4085 33.0459 28.6454 32.7298 28.0828 32.1672C27.5202 31.6046 27.2041 30.8415 27.2041 30.0459V24.0459ZM30.9541 37.5084V40.5459C30.9541 40.7448 30.8751 40.9356 30.7344 41.0762C30.5938 41.2169 30.403 41.2959 30.2041 41.2959C30.0052 41.2959 29.8144 41.2169 29.6738 41.0762C29.5331 40.9356 29.4541 40.7448 29.4541 40.5459V37.5084C27.605 37.3202 25.8914 36.4531 24.6446 35.0747C23.3978 33.6963 22.7064 31.9045 22.7041 30.0459C22.7041 29.847 22.7831 29.6562 22.9238 29.5156C23.0644 29.3749 23.2552 29.2959 23.4541 29.2959C23.653 29.2959 23.8438 29.3749 23.9844 29.5156C24.1251 29.6562 24.2041 29.847 24.2041 30.0459C24.2041 31.6372 24.8362 33.1633 25.9615 34.2885C27.0867 35.4138 28.6128 36.0459 30.2041 36.0459C31.7954 36.0459 33.3215 35.4138 34.4467 34.2885C35.572 33.1633 36.2041 31.6372 36.2041 30.0459C36.2041 29.847 36.2831 29.6562 36.4238 29.5156C36.5644 29.3749 36.7552 29.2959 36.9541 29.2959C37.153 29.2959 37.3438 29.3749 37.4844 29.5156C37.6251 29.6562 37.7041 29.847 37.7041 30.0459C37.7018 31.9045 37.0104 33.6963 35.7636 35.0747C34.5168 36.4531 32.8032 37.3202 30.9541 37.5084Z" fill="white" fill-opacity="0.8"/>
                  <defs>
                    <linearGradient id="paint0_linear_365_644" x1="18" y1="-4" x2="55.5" y2="41.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="white"/>
                      <stop offset="0.596154" stopColor="#006AFF"/>
                      <stop offset="1" stopColor="#00A6FF"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
      
      {/* MCP Modal */}
      {showMCPModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 max-w-md w-full relative shadow-2xl">
            <button 
              onClick={() => setShowMCPModal(false)}
              className="absolute top-4 right-4 text-[#858585] hover:text-white p-2"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-medium text-white mb-4">{t.mcp.hubTitle}</h3>

            {/* Unfract come server MCP (app/api/mcp): l'indirizzo da aggiungere
                come connettore. Il login e il consenso li gestisce /oauth/authorize. */}
            {mcpAvailable === null ? (
              <Loader2 className="animate-spin text-[#858585]" size={18} />
            ) : !mcpAvailable ? (
              <p className="text-sm text-[#858585]">{t.mcp.disabled}</p>
            ) : (
              <>
                <p className="text-sm text-[#858585] mb-4">{t.mcp.hubDesc}</p>
                <div className="bg-black border border-white/10 rounded-xl p-3 mb-4 flex items-center justify-between gap-3">
                  <code className="text-[#006AFF] text-sm truncate">{mcpUrl}</code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(mcpUrl).then(() => { setMcpCopied(true); setTimeout(() => setMcpCopied(false), 2000); }).catch(() => undefined); }}
                    className="shrink-0 flex items-center gap-1 text-xs text-[#858585] hover:text-white transition-colors"
                  >
                    {mcpCopied ? <><Check size={16} className="text-green-500" />{t.mcp.copied}</> : <><Copy size={16} />{t.mcp.copy}</>}
                  </button>
                </div>
                <p className="text-xs text-white/70 mb-2">{t.mcp.hubSafety}</p>
                <p className="text-xs text-[#858585]">{t.mcp.hubManage}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {chatToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-white mb-2">{t.aiHub.deleteChatTitle}</h3>
            <p className="text-[#858585] text-sm mb-6">
              {t.aiHub.deleteChatDesc}
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setChatToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors"
              >
                {t.common.cancel}
              </button>
              <button 
                onClick={() => {
                  deleteChat(chatToDelete);
                  setChatToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#FF0004]/10 text-[#FF0004] hover:bg-[#FF0004]/20 transition-colors"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Temporary icon component since Sparkles isn't exported in the above scope
const Sparkles = ({ size, className }: { size: number, className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </svg>
);
