"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Mic, Square, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { processMeetingTranscript } from '@/lib/gemini';
import { saveMeeting } from '@/lib/meetings';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface RecordingContextType {
  isRecording: boolean;
  isProcessing: boolean;
  elapsedTime: number;
  transcript: string;
  startRecording: () => void;
  stopRecording: () => void;
  openPiP: () => void;
  pipWindowBody: HTMLElement | null;
}

const RecordingContext = createContext<RecordingContextType>({
  isRecording: false,
  isProcessing: false,
  elapsedTime: 0,
  transcript: '',
  startRecording: () => {},
  stopRecording: () => {},
  openPiP: () => {},
  pipWindowBody: null,
});

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const toast = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const pipWindowRef = useRef<any>(null);
  const [pipWindowBody, setPipWindowBody] = useState<HTMLElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'it-IT';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
    };
    
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Il tuo browser non supporta la Web Speech API. Usa Google Chrome.");
      return;
    }
    if (!activeProjectId) {
      toast.error("Seleziona un progetto prima di registrare.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      // Compressione audio per ottimizzazione storage
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType: 'audio/webm',
        audioBitsPerSecond: 24000 // 24kbps per una buona compressione vocale
      });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
    } catch(err) {
      console.error("Microphone error:", err);
      toast.error("Impossibile accedere al microfono. Controlla i permessi.");
      return;
    }

    setIsRecording(true);
    setTranscript("");
    setElapsedTime(0);
    timerRef.current = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.log("Already started");
    }
  }, [activeProjectId, toast]);

  const stopRecording = async () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    setIsProcessing(true);
    
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.close();
      } catch(e) {}
    }

    const audioBlob = await new Promise<Blob>((resolve) => {
      mediaRecorderRef.current!.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        resolve(blob);
      };
      mediaRecorderRef.current!.stop();
      mediaRecorderRef.current!.stream.getTracks().forEach(track => track.stop());
    });

    const managerName = user?.displayName || 'Utente';
    const duration = `${Math.floor(elapsedTime / 60)}m ${elapsedTime % 60}s`;
    
    if (!activeProjectId) {
      setIsProcessing(false);
      return;
    }

    let audioUrl = '';
    try {
      const timestamp = new Date().getTime();
      const storageRef = ref(storage, `meetings/${activeProjectId}/${timestamp}.webm`);
      await uploadBytes(storageRef, audioBlob);
      audioUrl = await getDownloadURL(storageRef);
    } catch (uploadError) {
      console.error("Failed to upload audio to storage:", uploadError);
      toast.error("Errore nel salvataggio dell'audio sul cloud.");
    }

    try {
      const result = await processMeetingTranscript(audioBlob, transcript);
      await saveMeeting(activeProjectId, {
        title: "Nuovo Meeting",
        date: new Date().toLocaleDateString('it-IT'),
        duration,
        manager: managerName,
        summary: result.summary,
        decisions: result.decisions,
        tasks: result.tasks,
        transcript: result.transcript || transcript,
        audioUrl: audioUrl || undefined
      });
    } catch (error: any) {
      console.error("Gemini failed:", error);
      toast.error(`Errore AI durante la trascrizione, salvo la registrazione di backup.`);
      
      // Fallback: save raw meeting
      await saveMeeting(activeProjectId, {
        title: "Meeting (Trascrizione Fallita)",
        date: new Date().toLocaleDateString('it-IT'),
        duration,
        manager: managerName,
        summary: "L'IA non è riuscita a elaborare la trascrizione. Potrebbe essere necessario elaborarla manualmente.",
        decisions: [],
        tasks: [],
        transcript: transcript || "Nessun testo trascritto.",
        audioUrl: audioUrl || undefined
      });
    }
    
    setIsProcessing(false);
    setTranscript("");
    setElapsedTime(0);
  };

  const openPiP = async () => {
    if (!('documentPictureInPicture' in window)) {
      toast.error("Il tuo browser non supporta il Document Picture-in-Picture. Usa Chrome su Desktop.");
      return;
    }

    try {
      const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width: 350,
        height: 200,
      });
      
      pipWindowRef.current = pipWindow;
      
      // Copy styles
      Array.from(document.styleSheets).forEach((styleSheet) => {
        try {
          const cssRules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('');
          const style = document.createElement('style');
          style.textContent = cssRules;
          pipWindow.document.head.appendChild(style);
        } catch (e) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.type = styleSheet.type;
          link.media = styleSheet.media.mediaText;
          link.href = styleSheet.href || '';
          pipWindow.document.head.appendChild(link);
        }
      });

      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.backgroundColor = '#111';
      
      const pipRoot = document.createElement('div');
      pipRoot.id = 'pip-root';
      pipRoot.style.height = '100%';
      pipWindow.document.body.appendChild(pipRoot);

      setPipWindowBody(pipRoot);
      
      pipWindow.addEventListener("pagehide", () => {
        setPipWindowBody(null);
        pipWindowRef.current = null;
      });

    } catch (error) {
      console.error(error);
      toast.error("Errore durante l'apertura del PiP.");
    }
  };

  return (
    <RecordingContext.Provider value={{
      isRecording,
      isProcessing,
      elapsedTime,
      transcript,
      startRecording,
      stopRecording,
      openPiP,
      pipWindowBody
    }}>
      {children}
      {pipWindowBody && createPortal(
        <div style={{ padding: '24px', color: 'white', fontFamily: 'sans-serif', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} className="animate-pulse" />}
              <span style={{ fontWeight: 'bold', fontSize: '18px', textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>
                {isProcessing ? 'Elaborazione' : `${Math.floor(elapsedTime / 60)}m ${(elapsedTime % 60).toString().padStart(2, '0')}s`}
              </span>
            </div>
            <button 
              onClick={stopRecording}
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 14px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          </div>
          <div style={{ marginTop: '20px', fontSize: '15px', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
            {transcript ? `"${transcript.slice(-150)}"` : "In ascolto..."}
          </div>
        </div>,
        pipWindowBody
      )}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  return useContext(RecordingContext);
}
