"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Bell, Clock, Timer, Hourglass, Play, Pause, RotateCcw, Calendar, CheckSquare, Video, FileText, Loader2, Users, Circle, Settings, Mic, Square, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClock } from '@/contexts/ClockContext';
import { useRecording } from '@/contexts/RecordingContext';
import { collection, getDocs, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { searchCalendarEvents } from '@/lib/googleCalendar';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useProject } from '@/contexts/ProjectContext';
import { resolveAccessRequest } from '@/lib/services/iamService';
import { Check, X, Key } from 'lucide-react';
import { UserSettingsModal } from '@/components/auth/UserSettingsModal';

type Notification = {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'meeting' | 'transcript' | 'documentation' | 'organization' | 'access_request';
  metadata?: any;
  read: boolean;
  createdAt: any;
  link?: string;
  userId?: string;
};

const MOCK_NOTIFICATIONS = [
  { title: 'Nuova task assegnata', description: 'Sei stato assegnato a "UI UX Design"', type: 'task', read: false, link: '/' },
  { title: 'Nuovo meeting', description: 'Sync Settimanale programmato per domani', type: 'meeting', read: false, link: '/meetings' },
  { title: 'Trascrizione pronta', description: 'La trascrizione del meeting è pronta', type: 'transcript', read: true, link: '/meetings' },
  { title: 'Nuovo documento', description: 'Mario ha creato "Linee Guida Brand"', type: 'documentation', read: true, link: '/documentation' },
  { title: 'Nuovo membro', description: 'Luigi si è unito all\'organizzazione', type: 'organization', read: true, link: '/organization' },
];

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user, accessToken } = useAuth();
  const { activeProjectId } = useProject();
  const { 
    chronoTime, chronoRunning, toggleChrono, resetChrono,
    timerTime, timerRunning, toggleTimer, resetTimer, setCustomTimer 
  } = useClock();
  const { isRecording, isProcessing, elapsedTime, transcript, stopRecording, openPiP } = useRecording();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const islandRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Local clock state
  const [time, setTime] = useState<string>("00:00:00");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("it-IT", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ type: string; item: any }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    // First time setup: Generate mock data if collection is empty
    const checkAndPopulateMocks = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', user.uid)));
        if (snap.empty) {
          const batch = writeBatch(db);
          MOCK_NOTIFICATIONS.forEach((n, index) => {
            const newRef = doc(collection(db, 'notifications'));
            // Create timestamps slightly in the past so they format nicely
            const pastDate = new Date();
            pastDate.setHours(pastDate.getHours() - index); 
            
            batch.set(newRef, {
              ...n,
              userId: user.uid,
              createdAt: Timestamp.fromDate(pastDate)
            });
          });
          await batch.commit();
        }
      } catch (err) {
        console.error("Error populating mock notifications:", err);
      }
    };
    
    checkAndPopulateMocks();

    // Listen to notifications
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      const loadedNotifications: Notification[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Notification;
        
        // Exclude older than 30 days
        let isValid = true;
        if (data.createdAt) {
          const createdAtDate = data.createdAt.toDate();
          if (now.getTime() - createdAtDate.getTime() > thirtyDaysMs) {
            isValid = false;
          }
        }
        
        if (isValid) {
          loadedNotifications.push({ ...data, id: doc.id });
        }
      });
      
      loadedNotifications.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA; // Descending
      });
      
      setNotifications(loadedNotifications);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = async (id: string, link?: string) => {
    try {
      const notifRef = doc(db, 'notifications', id);
      await updateDoc(notifRef, { read: true });
      if (link) {
        router.push(link);
        setIsNotificationsOpen(false);
      }
    } catch (err) {
      console.error("Error updating notification:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        const ref = doc(db, 'notifications', n.id);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (islandRef.current && !islandRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      
      setIsSearching(true);
      const results: { type: string; item: any }[] = [];
      const qText = searchQuery.toLowerCase();
      
      try {
        // 1. Search Tasks
        if (activeProjectId) {
          const tasksSnap = await getDocs(query(collection(db, "tasks"), where("projectId", "==", activeProjectId)));
          tasksSnap.forEach(doc => {
            const data = doc.data();
            if (data.title?.toLowerCase().includes(qText) || data.description?.toLowerCase().includes(qText)) {
              results.push({ type: 'task', item: { id: doc.id, ...data } });
            }
          });

          // 2. Search Meetings
          const meetingsSnap = await getDocs(query(collection(db, "meetings"), where("projectId", "==", activeProjectId)));
          meetingsSnap.forEach(doc => {
            const data = doc.data();
            const title = data.title?.toLowerCase() || '';
            const transcript = data.transcript?.toLowerCase() || '';
            if (title.includes(qText) || transcript.includes(qText)) {
              results.push({ type: 'meeting', item: { id: doc.id, ...data } });
            }
          });

          // 3. Search Documentation
          const docsSnap = await getDocs(query(collection(db, "documentation"), where("projectId", "==", activeProjectId)));
          docsSnap.forEach(doc => {
            const data = doc.data();
            const title = data.title?.toLowerCase() || '';
            const content = data.blocks?.map((b: any) => b.content).join(' ').toLowerCase() || '';
            if (title.includes(qText) || content.includes(qText)) {
              results.push({ type: 'documentation', item: { id: doc.id, ...data } });
            }
          });
        }

        // 4. Search Google Calendar
        if (accessToken) {
          const calEvents = await searchCalendarEvents(accessToken, searchQuery);
          calEvents.forEach((ev: any) => {
            results.push({ type: 'calendar', item: ev });
          });
        }
        
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setSearchResults(results);
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, accessToken, activeProjectId]);

  const formatSeconds = (totalSeconds: number) => {
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isTimerActive = timerTime > 0 && timerTime < 25 * 60; // Simplified for active visual
  const isChronoActive = chronoTime > 0;
  
  let islandContent = (
    <div className="flex items-center gap-2 text-white/70">
      <Clock size={14} className="text-[#858585]" />
      <span className="text-[13px] font-medium tracking-wider tabular-nums">{time.substring(0, 5)}</span>
    </div>
  );

  const activeElements = [];
  
  if (timerRunning || isTimerActive) {
    activeElements.push(
      <div key="timer" className="flex items-center gap-2">
        <Hourglass size={14} className="text-[#00D222]" />
        <span className="text-[13px] font-bold tracking-wider tabular-nums text-[#00D222] drop-shadow-[0_0_8px_rgba(0,210,34,0.4)]">
          {formatSeconds(timerTime)}
        </span>
      </div>
    );
  }
  
  if (chronoRunning || isChronoActive) {
    activeElements.push(
      <div key="chrono" className="flex items-center gap-2">
        <Timer size={14} className="text-[#FFB800]" />
        <span className="text-[13px] font-bold tracking-wider tabular-nums text-[#FFB800] drop-shadow-[0_0_8px_rgba(255,184,0,0.4)]">
          {formatSeconds(chronoTime)}
        </span>
      </div>
    );
  }

  if (isRecording || isProcessing) {
    activeElements.push(
      <div key="recording" className="flex items-center gap-2">
        {isProcessing ? (
          <Loader2 size={14} className="text-red-500 animate-spin" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
        <span className="text-[13px] font-bold tracking-wider tabular-nums text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
          {isProcessing ? 'Elaborazione' : formatSeconds(elapsedTime)}
        </span>
      </div>
    );
  }

  islandContent = (
    <div className="flex items-center gap-4 text-white/90">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-[#858585]" />
        <span className="text-[13px] font-medium tracking-wider tabular-nums text-white/70">{time.substring(0, 5)}</span>
      </div>
      {activeElements.map((el, i) => (
        <React.Fragment key={i}>
          <div className="w-[1px] h-[14px] bg-white/10" />
          {el}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-[88px] h-auto py-4 md:py-0 w-full flex flex-wrap md:flex-nowrap items-center justify-between px-4 md:px-6 bg-[#0B0B0B] gap-4">
      
      
      {/* Mobile Hamburger */}
      <button onClick={onMenuClick} className="md:hidden p-2 -ml-2 rounded-lg text-[#858585] hover:text-white hover:bg-white/5 transition-colors">
        <Menu size={20} />
      </button>
      
      {/* CENTER: Cerca (Allargata e allineata a sinistra) */}
      <div className="w-full md:flex-1 md:flex justify-start relative order-2 md:order-1" ref={searchRef}>
        <div className={`flex items-center gap-3 bg-[#0A0A0A] border transition-colors h-[44px] px-5 rounded-full w-full max-w-[600px] shadow-sm ${isSearchOpen ? 'border-[#006AFF]/50' : 'border-white/5 hover:border-white/10'}`}>
          <Search size={16} className="text-[#858585]" />
          <input 
            type="text" 
            placeholder="Cerca globalmente (Task, Meeting, Calendario...)" 
            className="bg-transparent border-none outline-none text-[14px] text-white placeholder:text-[#858585] w-full font-normal"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
          />
          {isSearching && <Loader2 size={16} className="text-[#858585] animate-spin" />}
        </div>
        
        {/* Search Results Dropdown */}
        {isSearchOpen && searchQuery.length >= 2 && (
          <div className="absolute top-[60px] w-full max-w-[600px] bg-[#121212] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 flex flex-col">
            <div className="max-h-[400px] overflow-y-auto p-2">
              {isSearching ? (
                <div className="p-6 text-center text-[#858585] text-sm">Ricerca in corso...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-[#858585] text-sm">Nessun risultato trovato per "{searchQuery}".</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {searchResults.map((res, idx) => {
                    let Icon = FileText;
                    let title = "";
                    let subtitle = "";
                    let onClick = () => {};
                    
                    if (res.type === 'task') {
                      Icon = CheckSquare;
                      title = res.item.title;
                      subtitle = `Task • ${res.item.status || 'Senza stato'} • ${res.item.assignee || 'Non assegnata'}`;
                      onClick = () => { router.push('/'); setIsSearchOpen(false); };
                    } else if (res.type === 'meeting') {
                      Icon = Video;
                      title = res.item.title;
                      subtitle = `Meeting • ${res.item.date} ${res.item.time}`;
                      onClick = () => { router.push(`/meetings/${res.item.id}`); setIsSearchOpen(false); };
                    } else if (res.type === 'calendar') {
                      Icon = Calendar;
                      title = res.item.summary || 'Evento';
                      const sDate = res.item.start?.dateTime ? new Date(res.item.start.dateTime) : null;
                      subtitle = `Calendario • ${sDate ? sDate.toLocaleString('it-IT') : 'Data non specificata'}`;
                      onClick = () => { router.push('/calendar'); setIsSearchOpen(false); };
                    } else if (res.type === 'documentation') {
                      Icon = FileText;
                      title = res.item.title;
                      subtitle = `Documento • Ultima modifica: ${res.item.lastUpdate}`;
                      onClick = () => { router.push(`/documentation/${res.item.id}`); setIsSearchOpen(false); };
                    }
                    
                    return (
                      <div 
                        key={`${res.type}-${idx}`} 
                        onClick={onClick}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Icon size={18} className="text-white/70" />
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-sm font-medium text-white truncate">{title}</span>
                          <span className="text-[11px] text-[#858585] truncate">{subtitle}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-white/5 bg-black/20">
              <span className="text-[10px] text-[#858585] uppercase tracking-wider font-semibold px-2">Cerca in Unfract</span>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PORTION (Dynamic Island + Notifiche & Profilo) */}
      <div className="flex items-center gap-3 md:gap-6 justify-end w-auto lg:w-[350px] order-1 md:order-2">
        {/* Dynamic Island */}
        <div className="relative z-50" ref={islandRef}>
          <div 
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-[44px] px-5 rounded-full bg-[#121212] border border-white/10 flex items-center justify-center cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden min-w-[100px] shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:bg-[#1a1a1a]"
          >
            {islandContent}
          </div>

          {/* Expanded Menu */}
          <div className={`absolute top-[54px] right-0 md:left-1/2 md:-translate-x-1/2 w-[240px] bg-[#121212] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] origin-top flex flex-col p-4 gap-4 ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[#858585] text-xs font-medium uppercase tracking-wider">Orologio</span>
              <span className="text-white font-medium text-sm tabular-nums">{time}</span>
            </div>
            
            <div className="w-full h-[1px] bg-white/10" />

            {/* Expanded Timer */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {timerRunning || isTimerActive ? (
                  <Hourglass size={14} className="text-[#00D222]" />
                ) : (
                  <Circle size={14} className="text-[#858585]" />
                )}
                
                {!timerRunning && !isTimerActive ? (
                  <>
                    <input
                    type="number"
                    className="w-8 bg-transparent text-[15px] font-bold tracking-wider tabular-nums text-[#858585] outline-none placeholder:text-[#858585] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:m-0"
                    placeholder="25"
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) setCustomTimer(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt(e.currentTarget.value);
                        if (val > 0) setCustomTimer(val);
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <span className="text-[10px] uppercase tracking-wider text-[#858585]/70 font-semibold ml-[-4px]">min</span>
                  </>
                ) : (
                  <span className={`text-[15px] font-bold tracking-wider tabular-nums ${timerRunning || isTimerActive ? "text-[#00D222] drop-shadow-[0_0_8px_rgba(0,210,34,0.4)]" : "text-[#858585]"}`}>
                    {formatSeconds(timerTime)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleTimer} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                  {timerRunning ? <Pause size={14} className="text-[#00D222]" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" /> : <Play size={14} className="text-white/70 hover:text-white transition-colors" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />}
                </button>
                <button onClick={resetTimer} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                  <RotateCcw size={14} className="text-[#858585] hover:text-white" />
                </button>
              </div>
            </div>

            {/* Expanded Chrono */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {chronoRunning || isChronoActive ? (
                  <Timer size={14} className="text-[#FFB800]" />
                ) : (
                  <Circle size={14} className="text-[#858585]" />
                )}
                <span className={`text-[15px] font-bold tracking-wider tabular-nums ${chronoRunning || isChronoActive ? "text-[#FFB800] drop-shadow-[0_0_8px_rgba(255,184,0,0.4)]" : "text-[#858585]"}`}>
                  {formatSeconds(chronoTime)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleChrono} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                  {chronoRunning ? <Pause size={14} className="text-[#FFB800]" fill="currentColor" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" /> : <Play size={14} className="text-white/70 hover:text-white transition-colors" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />}
                </button>
                <button onClick={resetChrono} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                  <RotateCcw size={14} className="text-[#858585] hover:text-white" />
                </button>
              </div>
            </div>

            {/* Expanded Recording */}
            {(isRecording || isProcessing) && (
              <>
                <div className="w-full h-[1px] bg-white/10" />
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-500">
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} className="animate-pulse" />}
                      <span className="text-[15px] font-bold tracking-wider tabular-nums drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                        {isProcessing ? 'Elaborazione' : formatSeconds(elapsedTime)}
                      </span>
                    </div>
                    {isRecording && (
                      <div className="flex items-center gap-1">
                        <button onClick={openPiP} className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-[#858585] hover:text-white" title="Apri PiP">
                          <ExternalLink size={14} />
                        </button>
                        <button onClick={stopRecording} className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-[#858585] hover:text-red-500" title="Termina">
                          <Square size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  {isRecording && (
                    <div className="text-xs text-[#858585] italic truncate">
                      {transcript ? `"${transcript.slice(-40)}"` : "In ascolto..."}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Profilo & Notifiche */}
        <div className="flex items-center gap-4">
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="text-white/70 hover:text-white transition-colors relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              )}
            </button>
            
            {/* Notifications Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute top-[54px] right-0 w-[320px] bg-[#121212] border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden z-50 flex flex-col origin-top-right transition-all duration-300">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notifiche</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[11px] text-[#006AFF] hover:text-[#006AFF]/80 font-medium transition-colors">
                      Segna come lette
                    </button>
                  )}
                </div>
                
                <div className="max-h-[360px] overflow-y-auto p-2 flex flex-col gap-1">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-[#858585] text-sm">Nessuna notifica</div>
                  ) : (
                    notifications.map((notif) => {
                      let Icon = Bell;
                      let colorClass = "text-white/70";
                      let bgClass = "bg-white/5";
                      
                      if (notif.type === 'task') { Icon = CheckSquare; colorClass = "text-blue-400"; bgClass = "bg-blue-400/10"; }
                      else if (notif.type === 'meeting') { Icon = Calendar; colorClass = "text-orange-400"; bgClass = "bg-orange-400/10"; }
                      else if (notif.type === 'transcript') { Icon = Video; colorClass = "text-green-400"; bgClass = "bg-green-400/10"; }
                      else if (notif.type === 'documentation') { Icon = FileText; colorClass = "text-purple-400"; bgClass = "bg-purple-400/10"; }
                      else if (notif.type === 'organization') { Icon = Users; colorClass = "text-pink-400"; bgClass = "bg-pink-400/10"; }
                      else if (notif.type === 'access_request') { Icon = Key; colorClass = "text-yellow-400"; bgClass = "bg-yellow-400/10"; }
                      
                      let timeAgo = '';
                      if (notif.createdAt) {
                        try {
                          timeAgo = formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true, locale: it });
                        } catch(e) {}
                      }

                      return (
                        <div 
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif.id, notif.link)}
                          className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${notif.read ? 'opacity-50 hover:bg-white/5' : 'bg-white/[0.03] hover:bg-white/[0.08]'}`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bgClass}`}>
                            <Icon size={16} className={colorClass} />
                          </div>
                          <div className="flex flex-col gap-1 overflow-hidden">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm truncate ${notif.read ? 'font-medium text-white/80' : 'font-semibold text-white'}`}>{notif.title}</span>
                              <span className="text-[10px] text-[#858585] whitespace-nowrap">{timeAgo}</span>
                            </div>
                            <span className="text-xs text-white/60 leading-snug">{notif.description}</span>
                            {notif.type === 'access_request' && notif.metadata && !notif.read && (
                              <div className="flex items-center gap-2 mt-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resolveAccessRequest(notif.metadata.requestId, 'approved');
                                    // Mark notif as read
                                    updateDoc(doc(db, 'notifications', notif.id), { read: true });
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors text-xs font-medium"
                                >
                                  <Check size={12} /> Approva
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resolveAccessRequest(notif.metadata.requestId, 'rejected');
                                    updateDoc(doc(db, 'notifications', notif.id), { read: true });
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-[#858585] rounded-lg hover:bg-white/10 transition-colors text-xs font-medium"
                                >
                                  <X size={12} /> Rifiuta
                                </button>
                              </div>
                            )}
                          </div>
                          {!notif.read && notif.type !== 'access_request' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-[#006AFF] flex-shrink-0 mt-2" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold text-white tracking-tight truncate max-w-[80px]">{user?.displayName || "Ospite"}</span>
            <div className="w-[34px] h-[34px] rounded-full bg-[#006AFF] flex items-center justify-center font-bold text-[12px] text-white tracking-wider shadow-[0_0_10px_rgba(0,106,255,0.2)] overflow-hidden flex-shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || "Avatar"} className="w-full h-full object-cover" />
              ) : (
                (user?.displayName ? user.displayName.charAt(0) : 'U').toUpperCase()
              )}
            </div>
          </div>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="text-[#858585] hover:text-white transition-colors w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/5"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
      
      {isSettingsOpen && <UserSettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}
