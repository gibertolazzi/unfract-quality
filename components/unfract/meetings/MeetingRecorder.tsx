"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Mic, Square, X, Loader2, ExternalLink } from 'lucide-react';
import { processMeetingTranscript } from '@/lib/gemini';
import { saveMeeting } from '@/lib/meetings';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';

interface MeetingRecorderProps {
  onClose: () => void;
  onComplete: () => void;
}

export function MeetingRecorder({ onClose, onComplete }: MeetingRecorderProps) {
  const { user } = useAuth();
  const { activeProjectId } = useProject();
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
    // Check support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Il tuo browser non supporta la Web Speech API. Usa Google Chrome.");
      onClose();
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
      // If we are still "recording" but it ended (e.g. pause in speech), restart it
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
  }, [onClose]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
    } catch(err) {
      console.error("Microphone error:", err);
      alert("Impossibile accedere al microfono. Controlla i permessi.");
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
  };

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

    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    reader.onloadend = async () => {
      const base64data = (reader.result as string).split(',')[1];
      
      try {
        const result = await processMeetingTranscript(base64data, transcript);
        
        const managerName = user?.displayName || 'Utente';
        const duration = `${Math.floor(elapsedTime / 60)}m ${elapsedTime % 60}s`;
        
        if (!activeProjectId) {
          alert("Progetto non trovato. Impossibile salvare.");
          setIsProcessing(false);
          return;
        }

        await saveMeeting(activeProjectId, {
          title: "Nuovo Meeting",
          date: new Date().toLocaleDateString('it-IT'),
          duration,
          manager: managerName,
          summary: result.summary,
          decisions: result.decisions,
          tasks: result.tasks,
          transcript: result.transcript || transcript
        });

        onComplete();
      } catch (error: any) {
        alert(`Errore AI: ${error?.message || 'Controlla la console per i dettagli'}`);
        console.error(error);
        setIsProcessing(false);
      }
    };
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const openPiP = async () => {
    if (!('documentPictureInPicture' in window)) {
      alert("Il tuo browser non supporta il Document Picture-in-Picture. Usa Chrome su Desktop.");
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

      // Prepare body
      pipWindow.document.body.style.margin = '0';
      pipWindow.document.body.style.backgroundColor = '#111';
      
      const pipRoot = document.createElement('div');
      pipRoot.id = 'pip-root';
      pipRoot.style.height = '100%';
      pipWindow.document.body.appendChild(pipRoot);

      setPipWindowBody(pipRoot);
      
      pipWindow.addEventListener("pagehide", (event: any) => {
        setPipWindowBody(null);
        pipWindowRef.current = null;
      });

    } catch (error) {
      console.error(error);
      alert("Errore durante l'apertura del PiP.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <h3 className="text-xl font-medium text-white mb-2">Nuovo Meeting</h3>
        <p className="text-white/50 text-sm mb-6">
          Registra l'audio locale per generare automaticamente il riassunto e i task.
          <br/><br/>
          <span className="text-yellow-500">Nota:</span> Usa gli altoparlanti (non le cuffie) per permettere al microfono di catturare l'audio degli altri partecipanti.
        </p>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 size={40} className="animate-spin text-[#006AFF] mb-4" />
            <p className="text-white/70">L'IA sta elaborando il meeting...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <span className="text-2xl font-mono text-white/90">{formatTime(elapsedTime)}</span>
              
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  className="px-6 py-2 bg-[#006AFF] hover:bg-[#0055CC] text-white rounded-full font-medium transition-colors flex items-center gap-2"
                >
                  <Mic size={18} /> Inizia
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full font-medium transition-colors flex items-center gap-2"
                >
                  <Square size={18} /> Ferma
                </button>
              )}
            </div>

            {isRecording && (
              <button 
                onClick={openPiP}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <ExternalLink size={18} />
                Apri Widget PiP Fluttuante
              </button>
            )}
            
            <div className="h-32 bg-black/50 rounded-xl p-4 overflow-y-auto custom-scrollbar border border-white/5">
              <p className="text-white/60 text-sm italic">
                {transcript || (isRecording ? "In attesa di audio..." : "La trascrizione apparirà qui...")}
              </p>
            </div>
          </div>
        )}
      </div>
      {pipWindowBody && createPortal(
        <div className="flex flex-col h-full bg-[#111] text-white p-4 font-sans border-t-2 border-red-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-medium">Registrazione in corso</span>
            </div>
            <span className="text-white/50">{formatTime(elapsedTime)}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto mb-4 text-sm text-white/70 italic custom-scrollbar">
            {transcript ? `"...${transcript.slice(-100)}"` : "In attesa di audio..."}
          </div>
          
          <button 
            onClick={stopRecording}
            className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center gap-2 transition-colors font-medium text-sm"
          >
            <Square size={16} /> Termina Registrazione
          </button>
        </div>, 
        pipWindowBody
      )}
    </div>
  );
}
