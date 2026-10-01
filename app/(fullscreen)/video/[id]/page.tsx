"use client";

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRecording } from '@/contexts/RecordingContext';
import { Mic, Square, Loader2 } from 'lucide-react';

export default function VideoCallPage({ params }: { params: { id: string } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { isRecording, isProcessing, elapsedTime, startRecording, stopRecording, openPiP } = useRecording();
  const jitsiApiRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Fallback al server pubblico se NEXT_PUBLIC_JITSI_DOMAIN non è ancora settato nel .env.local
    const domain = process.env.NEXT_PUBLIC_JITSI_DOMAIN || 'meet.unfract.com';
    const roomName = `unfract-${params.id}`;

    const initJitsi = () => {
      // @ts-ignore
      const JitsiMeetExternalAPI = window.JitsiMeetExternalAPI;
      if (!JitsiMeetExternalAPI) return;

      // Se esiste già un'istanza (React Strict Mode), distruggila prima di ricrearla
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }

      const options = {
        roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        userInfo: {
          displayName: user?.displayName || 'Ospite',
          email: user?.email || '',
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false, 
          prejoinConfig: {
            enabled: false
          }
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          DEFAULT_LOGO_URL: `${window.location.origin}/jitsi-logo.svg`,
          DEFAULT_WELCOME_PAGE_LOGO_URL: `${window.location.origin}/jitsi-logo.svg`,
          HIDE_DEEP_LINKING_LOGO: true,
        }
      };

      const api = new JitsiMeetExternalAPI(domain, options);
      
      api.addListener('videoConferenceLeft', () => {
        api.dispose();
        router.push('/calendar');
      });

      jitsiApiRef.current = api;
    };

    // Caricamento dinamico dello script
    if (document.getElementById('jitsi-script')) {
      initJitsi();
    } else {
      const script = document.createElement('script');
      script.id = 'jitsi-script';
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = initJitsi;
      document.body.appendChild(script);
    }

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    };
  }, [params.id, router, user]);

  return (
    <div className="w-full h-screen p-4 bg-[#050505] flex flex-col relative">
      <div 
        className="flex-1 w-full h-full bg-[#111] rounded-2xl overflow-hidden shadow-2xl border border-white/5 relative" 
        ref={containerRef} 
      >
        {/* Pulsante Fluttuante IA - Spostato in basso a sinistra per non coprire Jitsi */}
        <div className="absolute bottom-24 left-8 z-50">
          {!isRecording && !isProcessing ? (
            <button
              onClick={() => {
                startRecording();
                openPiP();
              }}
              className="px-6 py-2.5 rounded-full bg-black/80 border border-[#00FF88]/30 backdrop-blur-md text-[#00FF88] flex items-center gap-2 text-sm font-medium hover:bg-black hover:border-[#00FF88] hover:scale-105 transition-all shadow-[0_0_15px_rgba(0,255,136,0.15)] group"
            >
              <Mic size={16} className="group-hover:animate-pulse" />
              Avvia IA
            </button>
          ) : isRecording ? (
            <div className="flex items-center gap-4 bg-black/80 border border-red-500/30 backdrop-blur-md px-6 py-2.5 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <div className="flex items-center gap-2 text-red-500 animate-pulse">
                <Mic size={16} />
                <span className="font-bold text-sm">
                  {Math.floor(elapsedTime / 60)}m {(elapsedTime % 60).toString().padStart(2, '0')}s
                </span>
              </div>
              <div className="w-[1px] h-4 bg-white/20 mx-2" />
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors"
              >
                <Square size={14} fill="currentColor" />
                Stop
              </button>
            </div>
          ) : (
            <div className="px-6 py-2.5 rounded-full bg-black/80 border border-blue-500/30 backdrop-blur-md text-blue-500 flex items-center gap-2 text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <Loader2 size={16} className="animate-spin" />
              Elaborazione...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
