"use client";

import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { sendMessage, Mention, Attachment } from '@/lib/chat';
import { MentionDropdown } from '@/components/shared/MentionDropdown';
import { Send, ImagePlus, Paperclip, Loader2, X, File as FileIcon, Plus, Mic, Square, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

function uploadChatFile(chatId: string, file: File, index: number): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const type: Attachment['type'] = isImage ? 'image' : isVideo ? 'video' : 'file';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${index}_${safeName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', undefined, reject, async () => {
      try {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          type,
          payload: { url, name: file.name, size: file.size, mimeType: file.type },
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function ChatInput({ chatId }: { chatId: string }) {
  const { user } = useAuth();
  const { chats } = useChat();
  const chat = chats.find(c => c.id === chatId);
  const myPermissions = chat?.permissions?.[user?.uid || ''] || { canWrite: true };
  const canWrite = myPermissions.canWrite || chat?.creatorId === user?.uid || chat?.type === 'direct';
  const [text, setText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldSendAudioRef = useRef(false);

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
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0 || !user) return;

    setIsUploading(true);
    setUploadError('');
    const failedFiles: string[] = [];

    // Upload in sequence to avoid saturating the connection with large selections.
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      try {
        const attachment = await uploadChatFile(chatId, file, index);
        setAttachments(prev => [...prev, attachment]);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        failedFiles.push(file.name);
      }
    }

    if (failedFiles.length > 0) {
      setUploadError(`Caricamento non riuscito per: ${failedFiles.join(', ')}`);
    }
    setIsUploading(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };


  const startRecording = async () => {
    if (!canWrite) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      shouldSendAudioRef.current = false;
      setRecordingTime(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        clearInterval(recordingTimerRef.current as any);
        const sendIt = shouldSendAudioRef.current;
        setIsRecording(false);
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());

        if (sendIt) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });
          
          setIsUploading(true);
          try {
            const storageRef = ref(storage, `chats/${chatId}/${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);
            uploadTask.on(
              'state_changed',
              null,
              (error) => {
                console.error(error);
                setIsUploading(false);
              },
              async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // Automatically send message with audio attachment
                try {
                  await sendMessage(chatId, user!.uid, user!.displayName || 'Utente', '', [], [{
                    type: 'audio',
                    payload: {
                      url: downloadURL,
                      name: file.name,
                      size: file.size,
                      mimeType: file.type
                    }
                  }]);
                } catch (e) { console.error(e); }
                
                setIsUploading(false);
              }
            );
          } catch (e) {
            console.error(e);
            setIsUploading(false);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Non riesco ad accedere al microfono. Controlla i permessi del browser.");
    }
  };

  const stopRecordingAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      shouldSendAudioRef.current = true;
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      shouldSendAudioRef.current = false;
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);


  return (
    <div className="shrink-0 flex w-full flex-col items-center justify-center gap-2 px-4 py-3 pointer-events-none md:px-6">
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
          <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1">
            {attachments.map((att, i) => (
              <div key={`${att.payload.url}-${i}`} title={att.payload.name} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#111]">
                {att.type === 'image' ? (
                  <img src={att.payload.url} alt="attachment" className="w-full h-full object-cover" />
                ) : att.type === 'audio' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#006AFF]/20 text-[#006AFF]">
                    <Mic size={20} />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <FileIcon size={20} className="text-[#858585]" />
                  </div>
                )}
                <button 
                  type="button"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Rimuovi ${att.payload.name || 'allegato'}`}
                  className="absolute right-1 top-1 rounded-full bg-black/80 p-1 text-white opacity-100 backdrop-blur-sm transition-opacity hover:bg-black md:opacity-0 md:group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && (
          <p role="alert" className="w-full text-left text-xs text-red-400">{uploadError}</p>
        )}

        <form onSubmit={handleSubmit} className="relative w-full flex items-center gap-2 md:gap-4">
          {isRecording ? (
            <div className="flex-1 flex items-center justify-between bg-white/5 rounded-full pl-4 pr-1 py-1.5 border border-white/5 backdrop-blur-md">
              <button type="button" onClick={cancelRecording} className="text-[#858585] hover:text-[#FF0004] p-2 transition-colors">
                <Trash2 size={20} />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF0004] animate-pulse" />
                <span className="text-white text-[15px] font-medium min-w-[40px]">{formatTime(recordingTime)}</span>
                <style>{`
                  @keyframes equalizer {
                    0% { transform: scaleY(0.3); }
                    50% { transform: scaleY(1); }
                    100% { transform: scaleY(0.3); }
                  }
                  .eq-bar {
                    width: 3px;
                    background-color: #006AFF;
                    border-radius: 9999px;
                    animation: equalizer 1s ease-in-out infinite;
                  }
                `}</style>
                <div className="flex gap-[3px] items-center h-5 opacity-80 ml-2">
                   <div className="eq-bar h-3" style={{ animationDelay: '0.0s' }}></div>
                   <div className="eq-bar h-5" style={{ animationDelay: '0.2s' }}></div>
                   <div className="eq-bar h-4" style={{ animationDelay: '0.4s' }}></div>
                   <div className="eq-bar h-5" style={{ animationDelay: '0.1s' }}></div>
                   <div className="eq-bar h-2" style={{ animationDelay: '0.5s' }}></div>
                   <div className="eq-bar h-4" style={{ animationDelay: '0.3s' }}></div>
                   <div className="eq-bar h-3" style={{ animationDelay: '0.6s' }}></div>
                </div>
              </div>

              <button 
                type="button" 
                onClick={stopRecordingAndSend}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-[#006AFF] hover:bg-blue-600 transition-all duration-300 hover:scale-105 ml-4 shrink-0 shadow-[0_0_15px_rgba(0,106,255,0.4)] animate-in fade-in zoom-in-90"
              >
                <Send size={18} className="text-white ml-0.5" />
              </button>
            </div>
          ) : (
            <>
              {/* + Button */}
              <div className="relative shrink-0">
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !canWrite}
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[#858585] hover:text-white hover:bg-white/10 transition-all shadow-[inset_0_1px_4px_rgba(255,255,255,0.15)] border border-white/5 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                </button>
              </div>
              
              {/* Input Field */}
              <input
                ref={inputRef}
                type="text"
                disabled={!canWrite}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setCursorPos(e.target.selectionStart || 0);
                }}
                onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
                onClick={(e) => setCursorPos(e.currentTarget.selectionStart || 0)}
                placeholder={canWrite ? "Ask anything... usa @ per taggare" : "Non hai i permessi per scrivere in questo canale"}
                className="w-full bg-white/5 rounded-full pl-6 pr-6 py-3.5 text-[15px] text-white placeholder:text-[#555555] outline-none focus:bg-white/10 transition-all shadow-[inset_0_1px_4px_rgba(255,255,255,0.15)] border border-white/5 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed"
              />
              
              {/* Send / Mic Button */}
              {text.trim() || attachments.length > 0 ? (
                <button 
                  type="submit" 
                  disabled={isUploading || !canWrite}
                  className="relative w-12 h-12 rounded-full flex items-center justify-center bg-[#006AFF] hover:bg-blue-600 transition-all duration-300 hover:scale-105 shrink-0 disabled:opacity-50 text-white shadow-[0_0_15px_rgba(0,106,255,0.4)] animate-in fade-in zoom-in-90"
                >
                  <Send size={20} className="ml-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isUploading || !canWrite}
                  className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105 shrink-0 disabled:opacity-50 overflow-hidden animate-in fade-in zoom-in-90"
                >
                  <svg width="48" height="48" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="60" height="60" rx="30" fill="url(#paint0_linear_365_644)"/>
                    <path d="M30.2041 34.5459C31.3972 34.5447 32.5411 34.0702 33.3847 33.2265C34.2284 32.3829 34.7029 31.239 34.7041 30.0459V24.0459C34.7041 22.8524 34.23 21.7078 33.3861 20.8639C32.5422 20.02 31.3976 19.5459 30.2041 19.5459C29.0106 19.5459 27.866 20.02 27.0221 20.8639C26.1782 21.7078 25.7041 22.8524 25.7041 24.0459V30.0459C25.7053 31.239 26.1798 32.3829 27.0235 33.2265C27.8671 34.0702 29.011 34.5447 30.2041 34.5459ZM27.2041 24.0459C27.2041 23.2502 27.5202 22.4872 28.0828 21.9246C28.6454 21.362 29.4085 21.0459 30.2041 21.0459C30.9998 21.0459 31.7628 21.362 32.3254 21.9246C32.888 22.4872 33.2041 23.2502 33.2041 24.0459V30.0459C33.2041 30.8415 32.888 31.6046 32.3254 32.1672C31.7628 32.7298 30.9998 33.0459 30.2041 33.0459C29.4085 33.0459 28.6454 32.7298 28.0828 32.1672C27.5202 31.6046 27.2041 30.8415 27.2041 30.0459V24.0459ZM30.9541 37.5084V40.5459C30.9541 40.7448 30.8751 40.9356 30.7344 41.0762C30.5938 41.2169 30.403 41.2959 30.2041 41.2959C30.0052 41.2959 29.8144 41.2169 29.6738 41.0762C29.5331 40.9356 29.4541 40.7448 29.4541 40.5459V37.5084C27.605 37.3202 25.8914 36.4531 24.6446 35.0747C23.3978 33.6963 22.7064 31.9045 22.7041 30.0459C22.7041 29.847 22.7831 29.6562 22.9238 29.5156C23.0644 29.3749 23.2552 29.2959 23.4541 29.2959C23.653 29.2959 23.8438 29.3749 23.9844 29.5156C24.1251 29.6562 24.2041 29.847 24.2041 30.0459C24.2041 31.6372 24.8362 33.1633 25.9615 34.2885C27.0867 35.4138 28.6128 36.0459 30.2041 36.0459C31.7954 36.0459 33.3215 35.4138 34.4467 34.2885C35.572 33.1633 36.2041 31.6372 36.2041 30.0459C36.2041 29.847 36.2831 29.6562 36.4238 29.5156C36.5644 29.3749 36.7552 29.2959 36.9541 29.2959C37.153 29.2959 37.3438 29.3749 37.4844 29.5156C37.6251 29.6562 37.7041 29.847 37.7041 30.0459C37.7018 31.9045 37.0104 33.6963 35.7636 35.0747C34.5168 36.4531 32.8032 37.3202 30.9541 37.5084Z" fill="white" fillOpacity="0.8"/>
                    <defs>
                      <linearGradient id="paint0_linear_365_644" x1="18" y1="-4" x2="55.5" y2="41.5" gradientUnits="userSpaceOnUse">
                        <stop stopColor="white"/>
                        <stop offset="0.596154" stopColor="#006AFF"/>
                        <stop offset="1" stopColor="#00A6FF"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
