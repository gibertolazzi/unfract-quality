"use client";

import React, { useEffect, useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Message, Attachment, Mention } from '@/lib/chat';
import { ChatInput } from './ChatInput';
import { File as FileIcon, Play, Calendar, CheckSquare, FileText, ChevronRight, Trash2, X, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ChatWindow({ chatId }: { chatId: string }) {
  const { user } = useAuth();
  const { chats } = useChat();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const chat = chats.find(c => c.id === chatId);

  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, 'messages'),
      where('chatId', '==', chatId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      // Sort locally to avoid Firebase index error
      msgs.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return a.createdAt.toMillis() - b.createdAt.toMillis();
      });
      setMessages(msgs);
      setIsLoading(false);
    }, (error) => {
      console.error("Firebase onSnapshot error in ChatWindow:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'messages', msgId));
    } catch (e) {
      console.error("Failed to delete message", e);
    }
  };

  const renderTextWithMentions = (text: string, mentions: Mention[]) => {
    if (!mentions || mentions.length === 0) return text;
    
    const parts = text.split(/(@\S+|\/task \S+|\/doc \S+|\/meet \S+)/g);
    return parts.map((part, i) => {
      const isMention = part.startsWith('@') || part.startsWith('/task') || part.startsWith('/doc') || part.startsWith('/meet');
      if (isMention) {
        return <span key={i} className="text-[#006AFF] font-medium cursor-pointer hover:underline">{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
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

  const handleMentionClick = (mention: Mention) => {
    if (mention.type === 'doc') {
      router.push(`/documents/${mention.id}`);
    } else if (mention.type === 'meeting') {
      router.push(`/meetings/${mention.id}`);
    } else if (mention.type === 'task') {
      router.push(`/?taskId=${mention.id}`);
    }
  };

  const hasVisibleText = (msg: Message) => {
    if (!msg.text) return false;
    let cleanText = msg.text;
    if (msg.mentions) {
      msg.mentions.filter(m => m.type !== 'user').forEach(m => {
        cleanText = cleanText.replace(new RegExp(`/(task|doc|meet) ${m.name}`, 'g'), '');
      });
    }
    return cleanText.trim().length > 0;
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center px-6 shrink-0 bg-transparent backdrop-blur-md z-20 relative">
        <h3 className="font-semibold text-white/90">
          {chat?.type === 'channel' ? `# ${chat?.name}` : chat?.name || 'Messaggio Diretto'}
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 pb-[160px] space-y-4 relative z-0">
        {isLoading ? (
          <div className="text-center text-[#858585] text-sm">Caricamento messaggi...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-[#858585] text-sm mt-10">Nessun messaggio in questa chat. Scrivi qualcosa!</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col group w-full ${msg.senderId === user?.uid ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-1">
                {msg.senderId === user?.uid && (
                  <button 
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#858585] hover:text-[#FF0004] transition-all p-1"
                    title="Elimina messaggio"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <span className="text-[10px] text-[#858585]">{msg.senderName || 'Tu'}</span>
              </div>
              
              <div className={`rounded-[20px] px-5 py-3 w-max max-w-[80%] text-[14px] leading-relaxed shadow-sm ${
                 msg.senderId === user?.uid 
                   ? 'bg-[#006AFF] text-white rounded-tr-sm' 
                   : 'bg-white/5 border border-white/5 text-[#E0E0E0] rounded-tl-sm'
              } ${hasVisibleText(msg) ? '' : 'hidden'}`}>
                {msg.text && renderTextWithMentions(msg.text, msg.mentions || [])}
              </div>
              
              {/* Attachments */}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap max-w-[80%]">
                  {msg.attachments.map((att: Attachment, i: number) => {
                    if (att.type === 'image') {
                      return (
                        <div key={i} onClick={() => setSelectedImage(att.payload.url)} className="block max-w-[200px] rounded-lg overflow-hidden border border-white/10 hover:opacity-90 transition-opacity cursor-pointer">
                          <img src={att.payload.url} alt={att.payload.name} className="w-full h-auto object-cover" />
                        </div>
                      );
                    }
                    if (att.type === 'video') {
                      return (
                        <div key={i} className="max-w-[200px] relative rounded-lg overflow-hidden border border-white/10 group cursor-pointer">
                          <video src={att.payload.url} className="w-full h-auto" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="text-white" size={24} />
                          </div>
                        </div>
                      );
                    }
                    if (att.type === 'file') {
                      return (
                        <a key={i} href={att.payload.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-3 transition-colors">
                          <div className="w-10 h-10 rounded bg-[#006AFF]/20 text-[#006AFF] flex items-center justify-center shrink-0">
                            <FileIcon size={20} />
                          </div>
                          <div className="flex flex-col overflow-hidden max-w-[150px]">
                            <span className="text-sm text-white/90 truncate">{att.payload.name}</span>
                            <span className="text-[10px] text-[#858585]">{(att.payload.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                        </a>
                      );
                    }
                    return null;
                  })}
                </div>
              )}

              {/* Rich Cards for Mentions */}
              {msg.mentions && msg.mentions.filter(m => m.type !== 'user').length > 0 && (
                <div className="flex flex-col gap-2 mt-2 w-max max-w-[80%]">
                  {msg.mentions.filter(m => m.type !== 'user').map((mention: Mention, i: number) => {
                    const item = mention.fullItem || {};
                    const priority = item.priority || 'Medium';
                    
                    return (
                      <div 
                        key={i} 
                        onClick={() => handleMentionClick(mention)}
                        className="flex items-center gap-3 bg-[#1A1A1A] border border-white/10 rounded-xl p-3 min-w-[280px] max-w-[320px] hover:bg-white/5 cursor-pointer transition-all group relative overflow-hidden"
                      >
                        {mention.type === 'task' && (
                          <div className={`absolute -top-4 -left-4 w-12 h-12 rounded-full ${getPriorityGlow(priority)} opacity-20 blur-[12px] pointer-events-none`} />
                        )}
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-[#858585] z-10 border border-white/5">
                          {mention.type === 'task' ? <CheckSquare size={18} /> : mention.type === 'meeting' ? <Calendar size={18} /> : <FileText size={18} />}
                        </div>
                        <div className="flex flex-col overflow-hidden flex-1 z-10">
                          <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider mb-0.5 flex items-center gap-2">
                            {mention.type}
                            {mention.type === 'task' && (
                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${getPriorityColor(priority)}`}>
                                {priority}
                              </span>
                            )}
                          </span>
                          <span className="text-sm font-medium text-white truncate group-hover:text-[#006AFF] transition-colors">{mention.name.replace(/-/g, ' ')}</span>
                        </div>
                        <ChevronRight size={16} className="text-[#858585] opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <ChatInput chatId={chatId} />
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="absolute top-6 right-6 flex items-center gap-4">
            <a 
              href={selectedImage} 
              download 
              target="_blank" 
              rel="noreferrer"
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <Download size={20} />
            </a>
            <button 
              onClick={() => setSelectedImage(null)}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[#FF0004]/80 transition-all"
            >
              <X size={20} />
            </button>
          </div>
          <img src={selectedImage} className="max-w-full max-h-[90vh] object-contain rounded-xl" alt="Fullscreen preview" />
        </div>
      )}
    </div>
  );
}
