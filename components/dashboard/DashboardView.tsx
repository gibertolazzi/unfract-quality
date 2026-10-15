"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClock } from "@/contexts/ClockContext";
import { collection, onSnapshot, query, where, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { safeFormat } from "@/lib/dateUtils";
import Link from "next/link";
import { useProject } from "@/contexts/ProjectContext";
import { CheckCircle2, Circle, CircleDot, ArrowRight, Video, ExternalLink } from "lucide-react";
import { useTranslation } from "@/contexts/TranslationContext";
import { subscribeToEvents } from "@/lib/calendar";
import { authedFetch } from "@/lib/authedFetch";
import { myDashboardTasks, taskStatus } from "@/lib/dashboardTasks";
import { toggleDoneTarget } from "@/lib/taskWorkflow";

interface DashboardEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  meetLink?: string;
  date: Date;
  googleEventId?: string;
  microsoftEventId?: string;
}

export function DashboardView() {
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const { t } = useTranslation();
  
  const {
    chronoTime, chronoRunning, toggleChrono, resetChrono,
    timerTime, timerRunning, toggleTimer, resetTimer, setCustomTimer
  } = useClock();

  const [tasks, setTasks] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notes, setNotes] = useState("");
  const notesSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || !activeProjectId) {
      setTasks([]);
      setColumns([]);
      return;
    }
    const unsubTasks = onSnapshot(query(collection(db, "tasks"), where("projectId", "==", activeProjectId)), (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(fetchedTasks);
    });
    const unsubCols = onSnapshot(query(collection(db, "columns"), where("projectId", "==", activeProjectId)), (snapshot) => {
      const fetchedCols = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setColumns(fetchedCols);
    });
    return () => {
      unsubTasks();
      unsubCols();
    };
  }, [user, activeProjectId]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const today = new Date();
    const start = startOfDay(today);
    const end = endOfDay(today);
    let firestoreEvents: DashboardEvent[] = [];
    let externalEvents: DashboardEvent[] = [];

    const updateEvents = () => {
      const knownGoogle = new Set(firestoreEvents.map(event => event.googleEventId).filter(Boolean));
      const knownMicrosoft = new Set(firestoreEvents.map(event => event.microsoftEventId).filter(Boolean));
      const merged = [
        ...firestoreEvents,
        ...externalEvents.filter(event =>
          !(event.googleEventId && knownGoogle.has(event.googleEventId)) &&
          !(event.microsoftEventId && knownMicrosoft.has(event.microsoftEventId))
        ),
      ]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 6);
      setEvents(merged);
    };

    const unsubscribe = subscribeToEvents(user.uid, (savedEvents) => {
      firestoreEvents = savedEvents
        .filter(event => isWithinInterval(event.date, { start, end }))
        .map(event => ({
          id: event.id,
          title: event.title || t.dashboard.untitled,
          startTime: event.startTime || t.dashboard.allDay,
          endTime: event.endTime || "",
          meetLink: event.meetLink,
          date: event.date,
          googleEventId: event.googleEventId,
          microsoftEventId: event.microsoftEventId,
        }));
      updateEvents();
    });

    const loadExternalEvents = async () => {
      setIsSyncing(true);
      try {
        const response = await authedFetch(
          `/api/calendar/sync?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`
        );
        if (!response.ok) {
          throw new Error(`Calendar sync failed: ${response.status}`);
        }
        const data = await response.json();
        externalEvents = (data.events || []).map((event: any): DashboardEvent => {
          const eventStart = new Date(event.startISO || event.date);
          const eventEnd = new Date(event.endISO || event.date);
          return {
            id: event.id,
            title: event.title || t.dashboard.untitled,
            startTime: event.startTime || safeFormat(eventStart, "HH:mm", undefined, "09:00"),
            endTime: event.endTime || safeFormat(eventEnd, "HH:mm", undefined, "10:00"),
            meetLink: event.meetLink || undefined,
            date: eventStart,
            googleEventId: event.googleEventId,
            microsoftEventId: event.microsoftEventId,
          };
        });
        updateEvents();
      } catch (error) {
        console.error("Errore fetch eventi calendario:", error);
        updateEvents();
      } finally {
        setIsSyncing(false);
      }
    };

    loadExternalEvents();
    return () => unsubscribe();
  }, [user, t.dashboard.allDay, t.dashboard.untitled]);

  useEffect(() => {
    if (!user) {
      setNotes("");
      return;
    }

    getDoc(doc(db, "users", user.uid))
      .then(snapshot => setNotes(snapshot.data()?.dashboardNotes || ""))
      .catch(error => console.error("Unable to load dashboard notes:", error));
  }, [user]);

  const persistNotes = (value: string) => {
    if (!user) return;
    if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
    setDoc(doc(db, "users", user.uid), { dashboardNotes: value }, { merge: true })
      .catch(error => console.error("Unable to save dashboard notes:", error));
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (!user) return;
    if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
    notesSaveTimeout.current = setTimeout(() => persistNotes(value), 500);
  };

  useEffect(() => () => {
    if (notesSaveTimeout.current) clearTimeout(notesSaveTimeout.current);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const { visible: userTasks, pendingCount } = user
    ? myDashboardTasks(tasks, columns, user)
    : { visible: [], pendingCount: 0 };
  
  const completedCount = tasks.filter(t => getTaskStatus(t) === "done").length;
  const inProgressCount = tasks.filter(t => getTaskStatus(t) === "progress").length;
  const notStartedCount = tasks.filter(t => getTaskStatus(t) === "todo").length;
  const totalTasks = tasks.length || 1; 

  const percCompleted = Math.round((completedCount / totalTasks) * 100);
  
  const circ = 2 * Math.PI * 38;
  const pDashOffset = circ - (completedCount / totalTasks) * circ;
  const cDashOffset = circ - (inProgressCount / totalTasks) * circ;
  const nDashOffset = circ - (notStartedCount / totalTasks) * circ;
  
  const pRotation = -90 + (completedCount / totalTasks) * 360;
  const nRotation = -90 + ((completedCount + inProgressCount) / totalTasks) * 360;

  const getPriorityColor = (priority: string) => {
    if (priority === "High" || priority === "Critical") return "bg-[#FF0004]/10 text-[#FF0004] border-[#FF0004]/30";
    if (priority === "Medium") return "bg-[#FFB800]/10 text-[#FFB800] border-[#FFB800]/30";
    return "bg-[#006AFF]/10 text-[#006AFF] border-[#006AFF]/30";
  };
  
  const getPriorityTextColor = (priority: string) => {
    if (priority === "High" || priority === "Critical") return "text-[#FF0004]";
    if (priority === "Medium") return "text-[#FFB800]";
    return "text-[#006AFF]";
  };

  const getPriorityBorderColor = (priority: string) => {
    if (priority === "High" || priority === "Critical") return "border-[#FF0004]";
    if (priority === "Medium") return "border-[#FFB800]";
    return "border-[#006AFF]";
  };

  const getPriorityGlow = (priority: string) => {
    if (priority === "High" || priority === "Critical") return "bg-[#FF0004]";
    if (priority === "Medium") return "bg-[#FFB800]";
    return "bg-[#006AFF]";
  };

  function getTaskStatus(task: any) {
    return taskStatus(task, columns);
  }

  const handleToggleTaskStatus = async (e: React.MouseEvent, task: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    // In «Completato» o di nuovo in «Da fare», dalle categorie delle colonne
    // (lib/taskWorkflow.ts). Prima cercava le colonne per nome e, senza
    // «Done», spostava l'attività nell'ultima colonna, qualunque fosse.
    const target = toggleDoneTarget(task, columns);
    if (target) {
      try {
        await updateDoc(doc(db, "tasks", task.id), {
          columnId: target.columnId,
          completedAt: target.done ? new Date().toISOString() : null,
        });
      } catch (error) {
        console.error("Error updating task status:", error);
      }
    }
  };

  return (
    <div className="flex flex-col h-full font-sans max-w-[1229px] mx-auto w-full pt-4 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">

          {/* My Tasks */}
          <div className="bg-[#0B0B0B] rounded-[32px] border border-white/5 p-6 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-medium text-white/90">
                {t.dashboard.myTasks}
                {pendingCount > 0 && (
                  <span className="ml-2 text-[12px] font-normal text-[#858585]">{pendingCount} {t.dashboard.toDo}</span>
                )}
              </h3>
              <Link href="/" className="flex items-center gap-1 text-[12px] text-[#858585] hover:text-white/70 transition-colors">
                {t.dashboard.seeAll} <ArrowRight size={12} />
              </Link>
            </div>
            
            {userTasks.length === 0 ? (
              <div className="py-8 text-center text-[#858585] text-sm">{t.dashboard.noTasksAssigned}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {userTasks.map((task) => {
                  const status = getTaskStatus(task);
                  return (
                    <Link
                      key={task.id}
                      href="/"
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div 
                        className="relative flex-shrink-0 cursor-pointer group/dot"
                        onClick={(e) => handleToggleTaskStatus(e, task)}
                      >
                        {status === "done" ? (
                          <div className={`w-[20px] h-[20px] rounded-full border-[2px] ${getPriorityBorderColor(task.priority)} flex items-center justify-center`}>
                            <div className={`w-[10px] h-[10px] rounded-full ${getPriorityGlow(task.priority)}`} />
                          </div>
                        ) : (
                          <div className={`w-[20px] h-[20px] rounded-full border-[2px] ${getPriorityBorderColor(task.priority)} opacity-50 group-hover/dot:opacity-100 transition-opacity`} />
                        )}
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full ${getPriorityGlow(task.priority)} opacity-20 blur-[6px]`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[13px] font-medium block truncate ${status === "done" ? "text-[#858585] line-through" : "text-white/90"}`}>
                          {task.title || t.dashboard.untitled}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${getPriorityColor(task.priority)}`}>
                        {task.priority || "Medium"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Calendar */}
          <div className="bg-[#0B0B0B] rounded-[32px] border border-white/5 p-6 flex flex-col shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-medium text-white/90">{t.dashboard.todayInCalendar}</h3>
              <Link href="/calendar" className="flex items-center gap-1 text-[12px] text-[#858585] hover:text-white/70 transition-colors">
                {t.dashboard.seeCalendar} <ArrowRight size={12} />
              </Link>
            </div>

            {isSyncing ? (
              <div className="py-8 text-center text-[#858585] text-sm">{t.dashboard.syncing}</div>
            ) : events.length === 0 ? (
              <div className="py-8 text-center text-[#858585] text-sm">{t.dashboard.noEventsToday}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-shrink-0 w-[52px] text-center">
                      <span className="text-[13px] font-medium text-white/70 tabular-nums">{event.startTime}</span>
                    </div>
                    <div className="w-[2px] h-8 bg-[#006AFF] rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-medium text-white/90 block truncate">{event.title}</span>
                      <span className="text-[11px] text-[#858585]">{event.startTime} – {event.endTime}</span>
                    </div>
                    {event.meetLink && (
                      <a 
                        href={event.meetLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#006AFF]/10 text-[#006AFF] text-[11px] font-medium hover:bg-[#006AFF]/20 transition-colors flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Video size={12} /> Meet
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">

          {/* Project Overview */}
          <div className="bg-[#0B0B0B] rounded-[32px] border border-white/5 p-6 flex flex-col shadow-xl min-h-[300px]">
            <h3 className="text-[16px] font-medium text-white/90 mb-6">{t.dashboard.projectOverview}</h3>
            
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <svg viewBox="0 0 100 100" className="w-[180px] h-[180px] drop-shadow-[0_0_15px_rgba(0,106,255,0.1)]">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#1A1A1A" strokeWidth="14" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#006AFF" strokeWidth="14" strokeDasharray={circ} strokeDashoffset={cDashOffset} className="origin-center -rotate-90 transition-all duration-1000" strokeLinecap="round" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#FFB800" strokeWidth="14" strokeDasharray={circ} strokeDashoffset={pDashOffset} className="origin-center transition-all duration-1000" style={{ transform: `rotate(${pRotation}deg)` }} strokeLinecap="round" />
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#FF0004" strokeWidth="14" strokeDasharray={circ} strokeDashoffset={nDashOffset} className="origin-center transition-all duration-1000" style={{ transform: `rotate(${nRotation}deg)` }} strokeLinecap="round" />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
                <span className="text-[32px] font-bold text-white tracking-tighter">{percCompleted}%</span>
                <span className="text-[10px] text-[#858585] -mt-1 uppercase tracking-widest">{t.dashboard.doneCircle}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#006AFF]" />
                <span className="text-[10px] text-[#858585] font-medium">{t.dashboard.done} ({completedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#FFB800]" />
                <span className="text-[10px] text-[#858585] font-medium">{t.dashboard.inProgress} ({inProgressCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#FF0004]" />
                <span className="text-[10px] text-[#858585] font-medium">{t.dashboard.todo} ({notStartedCount})</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-[#0B0B0B] rounded-[32px] border border-white/5 p-6 flex flex-col shadow-xl flex-1">
            <h3 className="text-[16px] font-medium text-white/90 mb-4">{t.dashboard.notes}</h3>
            <div className="relative w-full flex-1 min-h-[180px]">
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(transparent, transparent 31px, rgba(255,255,255,0.03) 31px, rgba(255,255,255,0.03) 32px)", backgroundPosition: "0 4px" }} />
              <textarea
                value={notes}
                onChange={(event) => handleNotesChange(event.target.value)}
                onBlur={() => persistNotes(notes)}
                className="w-full h-full bg-transparent resize-none outline-none text-white/70 text-[14px] leading-[32px] pt-1 custom-scrollbar"
                placeholder={t.dashboard.notesPlaceholder}
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
