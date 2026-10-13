"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { db } from '@/lib/firebase';
import { deleteStoredFile } from '@/lib/usage';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Message, Attachment, Mention } from '@/lib/chat';
import { ChatInput } from './ChatInput';
import { File as FileIcon, Play, Calendar, CheckSquare, FileText, ChevronRight, ChevronLeft, Trash2, X, Download, Settings, Pause, Ban } from 'lucide-react';
import { ChatSettingsModal } from './ChatSettingsModal';

const CustomAudioPlayer = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 bg-[#111] border border-white/10 rounded-full px-4 py-2 min-w-[200px] shadow-sm max-w-[260px]">
      <button 
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-[#006AFF] flex items-center justify-center text-white shrink-0 hover:bg-[#0055CC] transition-colors"
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col gap-1 justify-center">
        <div className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer" onClick={(e) => {
          if (audioRef.current && duration > 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = clickPos * duration;
          }
        }}>
          <div 
            className="absolute top-0 left-0 h-full bg-[#006AFF] rounded-full transition-all duration-100" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-[#858585] font-medium leading-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      <audio 
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
};

import { useRouter } from 'next/navigation';

import { Menu } from "lucide-react";

export function ChatWindow({ chatId, onOpenSidebar }: { chatId: string, onOpenSidebar?: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { chats, markChatAsRead } = useChat();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const userId = user?.uid;

  const chat = chats.find(c => c.id === chatId);
  const imageGallery = messages
    .filter(message => !message.deletedFor?.includes(userId || '') && !message.deletedForEveryone)
    .flatMap(message => (message.attachments || [])
      .filter(attachment => attachment.type === 'image')
      .map(attachment => ({ url: attachment.payload.url, name: attachment.payload.name || t.chat.image })));
  const selectedImage = selectedImageIndex === null ? null : imageGallery[selectedImageIndex] || null;

  const showPreviousImage = () => {
    if (imageGallery.length > 1 && selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex - 1 + imageGallery.length) % imageGallery.length);
    }
  };

  const showNextImage = () => {
    if (imageGallery.length > 1 && selectedImageIndex !== null) {
      setSelectedImageIndex((selectedImageIndex + 1) % imageGallery.length);
    }
  };

  useEffect(() => {
    if (selectedImageIndex === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') showPreviousImage();
      if (event.key === 'ArrowRight') showNextImage();
      if (event.key === 'Escape') setSelectedImageIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, imageGallery.length]);

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

      if (userId) {
        const unreadMessageIds = msgs.filter(message =>
          message.senderId !== userId &&
          !message.readBy?.includes(userId) &&
          !message.deletedFor?.includes(userId) &&
          !message.deletedForEveryone
        ).map(message => message.id);

        void markChatAsRead(chatId, unreadMessageIds);
      }
    }, (error) => {
      console.error("Firebase onSnapshot error in ChatWindow:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, userId, markChatAsRead]);

  const confirmDelete = async (type: 'me' | 'everyone') => {
    if (!messageToDelete || !user) return;
    try {
      if (type === 'everyone') {
        const attachments = messageToDelete.attachments || [];
        for (const attachment of attachments) {
          const payload = attachment?.payload;
          if (!payload?.storagePath) continue;
          try {
            await deleteStoredFile(payload.storagePath, {
              workspaceId: payload.workspaceId,
              bytes: payload.size,
              usageTracked: payload.usageTracked === true,
            });
          } catch (error) {
            // Leave message metadata intact if a file could not be deleted, so a retry remains possible.
            console.error('Failed to delete shared chat attachment:', error);
            return;
          }
        }
        await updateDoc(doc(db, 'messages', messageToDelete.id), {
          deletedForEveryone: true,
          text: t.chat.messageDeleted,
          attachments: [],
          mentions: []
        });
      } else {
        await updateDoc(doc(db, 'messages', messageToDelete.id), {
          deletedFor: arrayUnion(user.uid)
        });
      }
    } catch (e) {
      console.error("Failed to delete message", e);
    }
    setMessageToDelete(null);
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
      router.push(`/?highlightTask=${mention.id}`);
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
    <div className="flex-1 min-h-0 flex flex-col h-full relative">
      {showSettings && chat && (
        <ChatSettingsModal chat={chat} onClose={() => setShowSettings(false)} />
      )}
      {/* Header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 shrink-0 bg-transparent backdrop-blur-md z-20 relative">
        <div className="flex items-center gap-3">
          {onOpenSidebar && (
            <button 
              onClick={onOpenSidebar}
              className="md:hidden w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center backdrop-blur-sm"
            >
              <Menu size={16} />
            </button>
          )}
          <h3 className="font-semibold text-white/90">
            {chat?.type === 'channel' ? `# ${chat?.name}` : chat?.name || t.chat.directMessage}
          </h3>
        </div>
        {chat?.type === 'channel' && (
          <button onClick={() => setShowSettings(true)} className="text-[#858585] hover:text-white transition-colors">
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-6 space-y-4 relative z-0">
        {isLoading ? (
          <div className="text-center text-[#858585] text-sm">{t.chat.loadingMessages}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-[#858585] text-sm mt-10">{t.chat.noMessages}</div>
        ) : (
          messages.filter(msg => !msg.deletedFor?.includes(user?.uid || '')).map((msg) => {
            const isMe = msg.senderId === user?.uid;
            const hasText = hasVisibleText(msg);
            const imageAttachments = (msg.attachments || []).filter(att => att.type === 'image');
            const nonImageAttachments = (msg.attachments || []).filter(att => att.type !== 'image');
            const nonUserMentions = (msg.mentions || []).filter(m => m.type !== 'user');

            return (
              <div key={msg.id} className={`flex flex-col group w-full ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Header (Sender name & Trash button) */}
                <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className="text-[10px] text-[#858585]">{msg.senderName || t.chat.you}</span>
                  {!msg.deletedForEveryone && (
                    <button 
                      onClick={() => setMessageToDelete(msg)}
                      className="opacity-0 group-hover:opacity-100 text-[#858585] hover:text-[#FF0004] transition-all p-1"
                      title={t.chat.deleteMessage}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Message Content Stack */}
                <div className={`flex flex-col gap-2 max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Image Attachments (top) */}
                  {imageAttachments.length > 0 && (
                    <div className={`flex flex-col gap-2 ${isMe ? 'items-end' : 'items-start'}`}>
                      {imageAttachments.length === 1 ? (
                        (() => {
                          const att = imageAttachments[0];
                          const galleryIndex = imageGallery.findIndex(image => image.url === att.payload.url);
                          return (
                            <button
                              key={att.payload.url}
                              type="button"
                              onClick={() => setSelectedImageIndex(galleryIndex)}
                              className="group relative overflow-hidden rounded-[20px] border border-white/10 bg-[#111] transition-all hover:border-white/25 focus:outline-none focus:ring-2 focus:ring-[#006AFF] max-w-[280px] sm:max-w-[320px] shadow-sm"
                              aria-label={`${t.chat.openImage} ${att.payload.name || t.chat.image.toLowerCase()}`}
                            >
                              <img
                                src={att.payload.url}
                                alt={att.payload.name || t.chat.image}
                                className="block w-full h-auto max-h-[340px] object-cover rounded-[20px] transition duration-200 group-hover:scale-[1.02]"
                              />
                            </button>
                          );
                        })()
                      ) : (
                        <div className={`grid gap-2 ${
                          imageAttachments.length === 2 
                            ? 'grid-cols-2 max-w-[340px]' 
                            : 'grid-cols-2 sm:grid-cols-3 max-w-[420px]'
                        }`}>
                          {imageAttachments.map((att, i) => {
                            const galleryIndex = imageGallery.findIndex(image => image.url === att.payload.url);
                            return (
                              <button
                                key={`${att.payload.url}-${i}`}
                                type="button"
                                onClick={() => setSelectedImageIndex(galleryIndex)}
                                className="group relative aspect-square min-w-0 overflow-hidden rounded-[16px] border border-white/10 bg-[#111] transition hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-[#006AFF]"
                                aria-label={`${t.chat.openImage} ${att.payload.name || t.chat.image.toLowerCase()}`}
                              >
                                <img
                                  src={att.payload.url}
                                  alt={att.payload.name || t.chat.image}
                                  className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                                />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Text Bubble */}
                  {hasText && (
                    <div className={`rounded-[20px] px-5 py-3 w-fit max-w-full text-[14px] leading-relaxed shadow-sm ${
                      isMe 
                        ? (msg.deletedForEveryone ? 'bg-transparent border border-white/10 text-[#858585] italic' : 'bg-[#006AFF] text-white rounded-tr-sm')
                        : (msg.deletedForEveryone ? 'bg-transparent border border-white/10 text-[#858585] italic' : 'bg-white/5 border border-white/5 text-[#E0E0E0] rounded-tl-sm')
                    }`}>
                      {msg.deletedForEveryone ? (
                        <div className="flex items-center gap-2">
                          <Ban size={14} className="opacity-50" />
                          {t.chat.messageDeleted}
                        </div>
                      ) : (
                        msg.text && renderTextWithMentions(msg.text, msg.mentions || [])
                      )}
                    </div>
                  )}

                  {/* Non-image Attachments (Videos, Audio, Files) */}
                  {nonImageAttachments.length > 0 && (
                    <div className={`flex flex-col gap-2 ${isMe ? 'items-end' : 'items-start'}`}>
                      {nonImageAttachments.map((att: Attachment, i: number) => {
                        if (att.type === 'video') {
                          return (
                            <div key={i} className="w-full max-w-[420px] overflow-hidden rounded-[20px] border border-white/10 bg-black">
                              <video
                                src={att.payload.url}
                                controls
                                playsInline
                                preload="metadata"
                                className="block max-h-[360px] w-full object-contain"
                              >
                                {t.chat.videoNotSupported}
                              </video>
                            </div>
                          );
                        }
                        if (att.type === 'audio') {
                          return <CustomAudioPlayer key={i} url={att.payload.url} />;
                        }
                        if (att.type === 'file') {
                          return (
                            <a
                              key={i}
                              href={att.payload.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 transition-colors min-w-[220px] max-w-[320px]"
                            >
                              <div className="w-10 h-10 rounded-xl bg-[#006AFF]/20 text-[#006AFF] flex items-center justify-center shrink-0">
                                <FileIcon size={20} />
                              </div>
                              <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                                <span className="text-sm text-white/90 truncate font-medium">{att.payload.name}</span>
                                <span className="text-[10px] text-[#858585]">
                                  {att.payload.size ? (att.payload.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                                </span>
                              </div>
                            </a>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Rich Cards for Mentions */}
                  {nonUserMentions.length > 0 && (
                    <div className={`flex flex-col gap-2 ${isMe ? 'items-end' : 'items-start'}`}>
                      {nonUserMentions.map((mention: Mention, i: number) => {
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
              </div>
            );
          })
        )}
      </div>

      {/* Composer occupies its own layout space so it cannot cover the last message. */}
      <div className="z-10 w-full shrink-0 border-t border-white/5 bg-[#090909]">
        <ChatInput chatId={chatId} />
      </div>

      {/* Fullscreen Image Modal */}
      {selectedImage && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black/95 p-4 backdrop-blur-sm" onClick={() => setSelectedImageIndex(null)}>
          <div className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between md:left-8 md:right-8">
            <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-white/80">
              {(selectedImageIndex ?? 0) + 1} / {imageGallery.length}
            </span>
            <div className="flex items-center gap-3">
            <a 
              href={selectedImage.url} 
              download 
              target="_blank" 
              rel="noreferrer"
              onClick={event => event.stopPropagation()}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <Download size={20} />
            </a>
            <button 
              onClick={() => setSelectedImageIndex(null)}
              aria-label={t.chat.closeGallery}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[#FF0004]/80 transition-all"
            >
              <X size={20} />
            </button>
            </div>
          </div>
          {imageGallery.length > 1 && (
            <button type="button" onClick={event => { event.stopPropagation(); showPreviousImage(); }} aria-label={t.chat.prevImage} className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:left-8">
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="flex h-[calc(100dvh-5rem)] w-[calc(100vw-6rem)] items-center justify-center" onClick={event => event.stopPropagation()}>
            <img src={selectedImage.url} className="block h-auto w-auto max-h-full max-w-full rounded-xl object-contain" alt={selectedImage.name} />
          </div>
          {imageGallery.length > 1 && (
            <button type="button" onClick={event => { event.stopPropagation(); showNextImage(); }} aria-label={t.chat.nextImage} className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 md:right-8">
              <ChevronRight size={24} />
            </button>
          )}
        </div>,
        document.body
      )}
      {/* Delete Modal */}
      {messageToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center shadow-xl">
            <h3 className="text-white font-medium mb-1 text-lg">{t.chat.deleteMessage}</h3>
            <p className="text-sm text-[#858585] mb-6 text-center">{t.chat.deleteMessageConfirm}</p>
            <div className="flex flex-col gap-3 w-full">
              {messageToDelete.senderId === user?.uid && (
                <button 
                  onClick={() => confirmDelete('everyone')}
                  className="w-full py-2.5 rounded-xl bg-[#FF0004]/10 text-[#FF0004] hover:bg-[#FF0004]/20 font-medium transition-colors"
                >
                  {t.chat.deleteForEveryone}
                </button>
              )}
              <button 
                onClick={() => confirmDelete('me')}
                className="w-full py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 font-medium transition-colors"
              >
                {t.chat.deleteForMe}
              </button>
              <button 
                onClick={() => setMessageToDelete(null)}
                className="w-full py-2.5 rounded-xl bg-transparent text-[#858585] hover:text-white font-medium transition-colors mt-2"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
