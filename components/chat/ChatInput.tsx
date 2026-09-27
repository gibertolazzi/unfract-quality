"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { sendMessage, Mention, Attachment } from '@/lib/chat';
import { MentionDropdown } from '@/components/shared/MentionDropdown';
import { Send, ImagePlus, Paperclip, Loader2, X, File as FileIcon, Plus } from 'lucide-react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export function ChatInput({ chatId }: { chatId: string }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && attachments.length === 0) || !user || isUploading) return;

    try {
      await sendMessage(chatId, user.uid, user.displayName || 'Utente', text.trim(), mentions, attachments);
      setText('');
      setMentions([]);
      setAttachments([]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectMention = (newValue: string, newCursorPos: number, rawTag?: string) => {
    setText(newValue);
    if (rawTag) {
      try {
        const parsed = JSON.parse(rawTag);
        setMentions([...mentions, { type: parsed.type, id: parsed.id, name: parsed.name, fullItem: parsed.fullItem }]);
      } catch (e) {
        // Fallback for old behaviour just in case
        setMentions([...mentions, { type: 'user', id: rawTag, name: rawTag }]);
      }
    }
    
    // Focus and restore cursor
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const type = isImage ? 'image' : isVideo ? 'video' : 'file';
      
      const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress can be handled here if needed
        },
        (error) => {
          console.error(error);
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setAttachments(prev => [...prev, {
            type,
            payload: {
              url: downloadURL,
              name: file.name,
              size: file.size,
              mimeType: file.type
            }
          }]);
          setIsUploading(false);
          // reset input
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      );
    } catch (error) {
      console.error(error);
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="pb-8 pt-16 px-6 shrink-0 flex flex-col items-center justify-center relative z-10 gap-2 w-full bg-gradient-to-t from-[#090909] via-[#090909]/90 to-transparent pointer-events-none">
      <div className="pointer-events-auto w-full relative max-w-[700px] flex flex-col items-center">
        <MentionDropdown 
          value={text} 
          cursorPosition={cursorPos} 
          onSelect={handleSelectMention}
          anchorRef={inputRef}
          position="top"
        />
        
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple accept="image/*,video/*,application/pdf" />

        {attachments.length > 0 && (
          <div className="w-full flex items-center gap-4 overflow-x-auto pb-2">
            {attachments.map((att, i) => (
              <div key={i} className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0 group bg-[#111]">
                {att.type === 'image' ? (
                  <img src={att.payload.url} alt="attachment" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <FileIcon size={20} className="text-[#858585]" />
                  </div>
                )}
                <button 
                  onClick={() => removeAttachment(i)}
                  className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative w-full flex items-center gap-4">
          {/* + Button */}
          <div className="relative shrink-0">
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#858585] hover:text-white hover:bg-white/10 transition-all shadow-[inset_0_1px_4px_rgba(255,255,255,0.15)] border border-white/5 disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
            </button>
          </div>
          
          {/* Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCursorPos(e.target.selectionStart || 0);
            }}
            onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
            onClick={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
            placeholder="Ask anything... usa @ per taggare"
            className="w-full bg-white/5 rounded-full pl-6 pr-6 py-3.5 text-[15px] text-white placeholder:text-[#555555] outline-none focus:bg-white/10 transition-all shadow-[inset_0_1px_4px_rgba(255,255,255,0.15)] border border-white/5 backdrop-blur-md"
          />
          
          {/* Send Button */}
          <button 
            type="submit" 
            disabled={(!text.trim() && attachments.length === 0) || isUploading}
            className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-500 shrink-0 overflow-hidden ${
              text.trim() || attachments.length > 0
                ? 'bg-[#006AFF] shadow-[0_0_20px_rgba(0,106,255,0.4)] hover:bg-[#0055CC]' 
                : 'bg-transparent hover:bg-white/5'
            } disabled:opacity-50`}
          >
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${text.trim() || attachments.length > 0 ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-45'}`}>
              <Send size={20} className="mr-0.5 mt-0.5" />
            </div>
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${!(text.trim() || attachments.length > 0) ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-150 rotate-45'}`}>
              <svg width="48" height="48" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="60" height="60" rx="30" fill="url(#paint0_linear_365_644)"/>
                <path d="M30.2041 34.5459C31.3972 34.5447 32.5411 34.0702 33.3847 33.2265C34.2284 32.3829 34.7029 31.239 34.7041 30.0459V24.0459C34.7041 22.8524 34.23 21.7078 33.3861 20.8639C32.5422 20.02 31.3976 19.5459 30.2041 19.5459C29.0106 19.5459 27.866 20.02 27.0221 20.8639C26.1782 21.7078 25.7041 22.8524 25.7041 24.0459V30.0459C25.7053 31.239 26.1798 32.3829 27.0235 33.2265C27.8671 34.0702 29.011 34.5447 30.2041 34.5459ZM27.2041 24.0459C27.2041 23.2502 27.5202 22.4872 28.0828 21.9246C28.6454 21.362 29.4085 21.0459 30.2041 21.0459C30.9998 21.0459 31.7628 21.362 32.3254 21.9246C32.888 22.4872 33.2041 23.2502 33.2041 24.0459V30.0459C33.2041 30.8415 32.888 31.6046 32.3254 32.1672C31.7628 32.7298 30.9998 33.0459 30.2041 33.0459C29.4085 33.0459 28.6454 32.7298 28.0828 32.1672C27.5202 31.6046 27.2041 30.8415 27.2041 30.0459V24.0459ZM30.9541 37.5084V40.5459C30.9541 40.7448 30.8751 40.9356 30.7344 41.0762C30.5938 41.2169 30.403 41.2959 30.2041 41.2959C30.0052 41.2959 29.8144 41.2169 29.6738 41.0762C29.5331 40.9356 29.4541 40.7448 29.4541 40.5459V37.5084C27.605 37.3202 25.8914 36.4531 24.6446 35.0747C23.3978 33.6963 22.7064 31.9045 22.7041 30.0459C22.7041 29.847 22.7831 29.6562 22.9238 29.5156C23.0644 29.3749 23.2552 29.2959 23.4541 29.2959C23.653 29.2959 23.8438 29.3749 23.9844 29.5156C24.1251 29.6562 24.2041 29.847 24.2041 30.0459C24.2041 31.6372 24.8362 33.1633 25.9615 34.2885C27.0867 35.4138 28.6128 36.0459 30.2041 36.0459C31.7954 36.0459 33.3215 35.4138 34.4467 34.2885C35.572 33.1633 36.2041 31.6372 36.2041 30.0459C36.2041 29.847 36.2831 29.6562 36.4238 29.5156C36.5644 29.3749 36.7552 29.2959 36.9541 29.2959C37.153 29.2959 37.3438 29.3749 37.4844 29.5156C37.6251 29.6562 37.7041 29.847 37.7041 30.0459C37.7018 31.9045 37.0104 33.6963 35.7636 35.0747C34.5168 36.4531 32.8032 37.3202 30.9541 37.5084Z" fill="white" fill-opacity="0.8"/>
                <defs>
                  <linearGradient id="paint0_linear_365_644" x1="18" y1="-4" x2="55.5" y2="41.5" gradientUnits="userSpaceOnUse">
                    <stop stop-color="white"/>
                    <stop offset="0.596154" stop-color="#006AFF"/>
                    <stop offset="1" stop-color="#00A6FF"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </button>
        </form>
      </div>
    </div>
  );
}
