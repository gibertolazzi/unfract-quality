"use client";
import { getWebLLMEngine } from '@/lib/webllm';

import React, { useEffect, useState, use } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { getMeetingById, updateMeeting } from '@/lib/meetings';
import { requestMeetingAnalysis, requestMeetingTitle } from '@/lib/aiClient';
import { RefreshCw, Download } from 'lucide-react';
import { useDialog } from '@/contexts/DialogContext';
import { useToast } from '@/contexts/ToastContext';
import { Meeting } from '@/components/meetings/types';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ChevronLeft, Calendar, Clock, User, CheckCircle2, FileText, Target, Pencil, Check, X, Sparkles } from 'lucide-react';
import { collection, addDoc, getDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TaskModal } from '@/components/tasks/TaskModal';
import { deleteTaskAttachments } from '@/lib/services/taskService';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { TranscriptModal } from '@/components/meetings/TranscriptModal';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { useTranslation } from '@/contexts/TranslationContext';



function FixedAudioPlayer({ src }: { src: string }) {
  const { t } = useTranslation();
  const audioRef = React.useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let isFixed = false;

    const fixDuration = () => {
      if (isFixed) return;
      isFixed = true;
      
      const originalMuted = audio.muted;
      audio.muted = true;
      
      // Attempt to jump to the end so the browser calculates the true duration
      audio.currentTime = Number.MAX_SAFE_INTEGER;
      
      const onTimeUpdate = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.currentTime = 0;
        audio.muted = originalMuted;
      };
      
      audio.addEventListener('timeupdate', onTimeUpdate);
    };

    audio.addEventListener('loadedmetadata', fixDuration);
    return () => {
      audio.removeEventListener('loadedmetadata', fixDuration);
    };
  }, [src]);

  return (
    <div className="w-full">
      <audio 
        ref={audioRef}
        controls 
        className="w-full h-10 outline-none grayscale invert-[0.9] hue-rotate-180 opacity-80 hover:opacity-100 transition-opacity" 
        src={src}
      >
        {t.meetings.audioUnsupported}
      </audio>
    </div>
  );
}
export default function MeetingDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  // Da Next 15 i parametri della pagina arrivano come Promise.
  const params = use(paramsPromise);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dialog = useDialog();
  const toast = useToast();
  const { t, locale } = useTranslation();
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const handleGenerateTitle = async () => {
    if (!meeting) return;
    setIsGeneratingTitle(true);
    toast.info(t.meetings.generatingTitle);
    let newTitle = locale === 'it' ? 'Nuova riunione' : 'New meeting';
    const systemInstruction = locale === 'it'
      ? "Estrai l'argomento principale dal riepilogo e scrivi un titolo di massimo 5 parole. Rispondi solo con il titolo, senza markdown o prefissi."
      : 'Extract the main topic from the summary and write a title of at most 5 words. Reply only with the title, without markdown or prefixes.';
    const promptText = locale === 'it'
      ? `Riepilogo della riunione:\n\n${meeting.summary || meeting.transcript}\n\nScrivi solo il titolo (massimo 5 parole):`
      : `Meeting summary:\n\n${meeting.summary || meeting.transcript}\n\nWrite only the title (5 words maximum):`;

    try {
      if (typeof window !== 'undefined' && 'ai' in window && 'languageModel' in (window as any).ai) {
        // 1. Native Chrome Gemini Nano
        const session = await (window as any).ai.languageModel.create({ systemPrompt: systemInstruction });
        const localTitle = await session.prompt(promptText);
        if (localTitle) newTitle = localTitle.replace(/^(Riassunto|Titolo|Meeting|Title)[\\s\\:\\-\\*]*/gi, '').replace(/[*\"']/g, '').trim();
        toast.success(`${t.meetings.titleGenerated} (Gemini Nano)!`);
      } else if ((navigator as any).gpu) {
        // 2. Cross-browser Local WebLLM via WebGPU
                const engine = await getWebLLMEngine((progress) => {
           console.log("WebLLM Progress:", progress);
        });
        const reply = await engine.chat.completions.create({
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: promptText }
          ]
        });
        const localTitle = reply.choices[0].message.content;
        if (localTitle) newTitle = localTitle.replace(/^(Riassunto|Titolo|Meeting|Title)[\\s\\:\\-\\*]*/gi, '').replace(/[*\"']/g, '').trim();
        toast.success(`${t.meetings.titleGenerated} (WebLLM)!`);
      } else {
        // 3. Fallback Cloud
        const cloudTitle = await requestMeetingTitle(meeting.projectId || activeProjectId || '', meeting.summary || meeting.transcript, locale);
        newTitle = cloudTitle.replace(/^(Riassunto|Titolo|Meeting|Title)[\\s\\:\\-\\*]*/gi, '').replace(/[*\"']/g, '').trim();
        toast.success(`${t.meetings.titleGenerated} (Cloud)!`);
      }

      await updateMeeting(meeting.id, { title: newTitle });
      setMeeting({ ...meeting, title: newTitle });
      setEditedTitle(newTitle);
    } catch (e) {
      console.error(e);
      toast.error(t.meetings.generateTitleError);
    } finally {
      setIsGeneratingTitle(false);
    }
  };
  
  const [columns, setColumns] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { activeProjectId } = useProject();
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !activeProjectId) {
      router.push('/');
      return;
    }
    
    getMeetingById(params.id).then(doc => {
      setMeeting(doc);
      if (doc) setEditedTitle(doc.title);
      setIsLoading(false);
    });

    const loadData = async () => {
      const cSnap = await getDocs(query(collection(db, 'columns'), where('projectId', '==', activeProjectId)));
      setColumns(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const eSnap = await getDocs(query(collection(db, 'epics'), where('projectId', '==', activeProjectId)));
      setEpics(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadData();
  }, [params.id, user, authLoading, router, activeProjectId]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-[#858585]" /></div>;
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-xl font-bold mb-2">{t.meetings.notFound}</h2>
        <button onClick={() => router.push('/meetings')} className="px-4 py-2 bg-[#006AFF] rounded-lg mt-4 text-white">{t.meetings.backToMeetings}</button>
      </div>
    );
  }

  const handleAssignToBoard = async (task: any, idx: number) => {
    try {
      if (!activeProjectId) return;
      // Find "To Do" column
      const colsSnapshot = await getDocs(query(collection(db, "columns"), where("projectId", "==", activeProjectId)));
      let todoColId = colsSnapshot.docs[0]?.id; // fallback to first column
      colsSnapshot.docs.forEach(d => {
        const title = d.data().title.toLowerCase();
        if (title.includes("to do") || title.includes("todo")) {
          todoColId = d.id;
        }
      });

      // Add to tasks collection
      const docRef = await addDoc(collection(db, "tasks"), {
        title: task.title,
        priority: task.priority === 'CRITICAL' ? 'Critical' : (task.priority === 'HIGH' ? 'High' : (task.priority === 'MEDIUM' ? 'Medium' : 'Low')),
        assignee: user?.displayName || "Utente",
        requesterUid: user?.uid || null,
        assigneeUid: user?.uid || null,
        createdBy: user?.uid || null,
        lastModifiedBy: user?.uid || null,
        columnId: todoColId,
        date: new Date().toLocaleDateString(locale === 'it' ? 'it-IT' : 'en-US'),
        meetingId: params.id,
        meetingTaskIdx: idx,
        projectId: activeProjectId
      });

      // Mark as assigned in meeting document
      const newTasks = [...meeting.tasks];
      newTasks[idx] = { ...newTasks[idx], isAssigned: true, globalTaskId: docRef.id };
      await updateDoc(doc(db, "meetings", params.id), { tasks: newTasks });
      setMeeting({ ...meeting, tasks: newTasks });
      
      toast.success(t.meetings.taskAssigned);
    } catch (e) {
      console.error(e);
      toast.error(t.meetings.taskAssignError);
    }
  };

  const handleDeassignFromBoard = async (task: any, idx: number) => {
    const isConfirmed = await dialog.confirm({
      title: t.meetings.unassign,
      message: t.meetings.confirmUnassign,
      isDestructive: true,
      confirmText: t.meetings.remove
    });
    
    if (isConfirmed) {
      try {
        if (task.globalTaskId) {
          const globalTaskSnapshot = await getDoc(doc(db, 'tasks', task.globalTaskId));
          if (globalTaskSnapshot.exists()) await deleteTaskAttachments(globalTaskSnapshot.data());
          await deleteDoc(doc(db, 'tasks', task.globalTaskId));
        } else {
          const tasksQuery = query(
            collection(db, 'tasks'),
            where('meetingId', '==', params.id),
            where('meetingTaskIdx', '==', idx)
          );
          const querySnapshot = await getDocs(tasksQuery);
          for (const docSnapshot of querySnapshot.docs) {
            await deleteTaskAttachments(docSnapshot.data());
            await deleteDoc(doc(db, 'tasks', docSnapshot.id));
          }
        }
        
        const newTasks = [...meeting.tasks];
        const updatedTask = { ...newTasks[idx], isAssigned: false };
        delete updatedTask.globalTaskId;
        newTasks[idx] = updatedTask;
        
        await updateDoc(doc(db, "meetings", params.id), { tasks: newTasks });
        setMeeting({ ...meeting, tasks: newTasks });
        toast.success(t.meetings.assignmentRemoved);
      } catch (e) {
        console.error(e);
        toast.error(t.meetings.unassignError);
      }
    }
  };

  const startEditing = (task: any, idx: number) => {
    setEditingTaskIdx(idx);
    setEditingTask({ ...task, isNew: false, columnId: task.columnId || columns[0]?.id });
  };

  const saveEditingLocal = async (taskData: any) => {
    if (editingTaskIdx === null) return;
    try {
      const newTasks = [...meeting.tasks];
      newTasks[editingTaskIdx] = { 
        ...newTasks[editingTaskIdx], 
        title: taskData.title,
        priority: taskData.priority,
        assignee: user?.displayName || 'Utente',
        description: taskData.description,
        columnId: taskData.columnId
      };
      await updateDoc(doc(db, "meetings", params.id), { tasks: newTasks });
      setMeeting({ ...meeting, tasks: newTasks });
      setEditingTask(null);
      setEditingTaskIdx(null);
      toast.success(t.meetings.taskUpdated);
    } catch (e) {
      console.error(e);
      toast.error(t.meetings.saveError);
    }
  };

  
  const handleRetryTranscription = async () => {
    if (!meeting) return;
    setIsRetrying(true);
    try {
      // L'audio lo scarica il server da Storage: qui basta indicarlo.
      const result = await requestMeetingAnalysis({
        projectId: meeting.projectId || activeProjectId || '',
        audioUrl: meeting.audioUrl,
        transcript: meeting.transcript,
      });
      const newTitle = meeting.title.replace(" (Trascrizione Fallita)", "");
      
      const newData = {
        title: newTitle,
        summary: result.summary,
        decisions: result.decisions,
        tasks: result.tasks
      };
      
      await updateDoc(doc(db, "meetings", params.id), newData);
      
      setMeeting({
        ...meeting,
        ...newData
      });
      toast.success(t.meetings.transcriptionRegenerated);
    } catch (e) {
      console.error(e);
      toast.error(t.meetings.transcriptionFailed);
    } finally {
      setIsRetrying(false);
    }
  };

  const saveTitle = async () => {
    if (!meeting || !editedTitle.trim() || editedTitle === meeting.title) {
      setIsEditingTitle(false);
      return;
    }
    try {
      await updateDoc(doc(db, "meetings", params.id), { title: editedTitle });
      setMeeting({ ...meeting, title: editedTitle });
      setIsEditingTitle(false);
      toast.success(t.meetings.titleUpdated);
    } catch (error) {
      console.error(error);
      toast.error(t.meetings.saveError);
    }
  };

  return (
    <div className="flex flex-col min-h-full font-sans max-w-[1000px] mx-auto w-full pb-32">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => router.push('/meetings')}
          className="p-3 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-2xl text-white/70 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      {/* Header */}
      <div className="flex flex-col mb-12">
        {isEditingTitle ? (
          <div className="flex items-center gap-2 mb-4">
            <input 
              type="text" 
              value={editedTitle} 
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-[32px] font-medium text-white tracking-wide bg-transparent border-b border-[#006AFF] focus:outline-none w-full max-w-[500px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') {
                  setEditedTitle(meeting.title);
                  setIsEditingTitle(false);
                }
              }}
              onBlur={saveTitle}
            />
            <button onClick={saveTitle} className="p-2 rounded-full hover:bg-white/10 text-green-500 transition-colors">
              <Check size={20} />
            </button>
            <button onClick={() => {
              setEditedTitle(meeting.title);
              setIsEditingTitle(false);
            }} className="p-2 rounded-full hover:bg-white/10 text-[#858585] transition-colors">
              <X size={20} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-4 group">
            <h1 className="text-[32px] font-medium text-white tracking-wide flex items-center gap-3 flex-wrap">
              {meeting.title}
              {(meeting.title.includes('Fallita') || meeting.summary?.includes("L'IA non è riuscita")) && (
                  <button 
                    onClick={handleRetryTranscription}
                    disabled={isRetrying}
                    className="ml-4 flex items-center gap-2 px-3 py-1.5 bg-[#FF0004]/10 border border-[#FF0004]/30 text-[#FF0004] rounded-lg text-[13px] font-medium hover:bg-[#FF0004]/20 transition-colors disabled:opacity-50"
                  >
                    {isRetrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {t.meetings.retryTitle}
                  </button>
                )}
            </h1>
            <div className="opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2">
              <button 
                onClick={() => setIsEditingTitle(true)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-[#858585] hover:text-white transition-all"
                title={t.meetings.editTitle}
              >
                <Pencil size={18} />
              </button>
              <button 
                onClick={handleGenerateTitle}
                disabled={isGeneratingTitle}
                className="p-2 rounded-full bg-[#006AFF]/10 hover:bg-[#006AFF]/20 text-[#006AFF] transition-all disabled:opacity-50"
                title={t.meetings.generateTitle}
              >
                {isGeneratingTitle ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-6 text-[#858585] text-[15px]">
          <div className="flex items-center gap-2"><Calendar size={16} /> {meeting.date}</div>
          <div className="flex items-center gap-2"><Clock size={16} /> {meeting.duration}</div>
          <div className="flex items-center gap-2"><User size={16} /> {meeting.manager}</div>
        </div>
        {meeting.audioUrl && (
          <div className="mt-8 bg-[#111] p-4 rounded-2xl border border-white/5 flex flex-col gap-3">
            <h3 className="text-sm font-medium text-white/80 flex items-center justify-between">
              {t.meetings.audioRecording}
            </h3>
            <FixedAudioPlayer src={meeting.audioUrl} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-8">
        
        {/* Summary and decisions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 bg-[#111] border border-white/5 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-[#006AFF]" /> {t.meetings.summary}
            </h2>
            <div className="text-white/80 leading-relaxed text-[15px]">
              {meeting.summary}
            </div>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
              <Target size={20} className="text-purple-500" /> {t.meetings.decisions}
            </h2>
            
            {meeting.decisions.length === 0 ? (
              <p className="text-[#858585] text-sm">{t.meetings.noDecisions}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {meeting.decisions.map((dec, i) => (
                  <li key={i} className="flex gap-2 text-white/80 text-sm">
                    <span className="text-purple-500 mt-0.5">•</span> {dec}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Action items */}
        <div className="bg-[#111] border border-[#006AFF]/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#006AFF]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h2 className="text-xl font-medium text-white flex items-center gap-2">
              <CheckCircle2 size={20} className="text-[#006AFF]" /> {t.meetings.actionItems}
            </h2>
          </div>
          
          {meeting.tasks.length === 0 ? (
            <p className="text-[#858585] text-sm relative z-10">{t.meetings.noTasks}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {meeting.tasks.map((task, idx) => {
                let bgColor = 'bg-white/5';
                let borderColor = 'border-white/10';
                let badgeColor = 'text-[#858585] border-white/20';
                
                if (task.priority === 'CRITICAL' || task.priority === 'HIGH') {
                  bgColor = 'bg-red-500/10';
                  borderColor = 'border-red-500/20';
                  badgeColor = 'text-red-500 border-red-500/30';
                } else if (task.priority === 'MEDIUM') {
                  bgColor = 'bg-yellow-500/10';
                  borderColor = 'border-yellow-500/20';
                  badgeColor = 'text-yellow-500 border-yellow-500/30';
                } else if (task.priority === 'LOW') {
                  bgColor = 'bg-blue-500/10';
                  borderColor = 'border-blue-500/20';
                  badgeColor = 'text-blue-500 border-blue-500/30';
                }

                if (editingTaskIdx === idx) {
                  // We render the task visually normal, since the modal handles the editing
                  return null; 
                }

                return (
                  <div key={idx} className={`${bgColor} border ${borderColor} rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:bg-white/10 ${task.isAssigned ? 'opacity-50 grayscale' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-4 h-4 rounded-[4px] border border-white/20 flex-shrink-0 mt-0.5" />
                        <span className="text-[#006AFF] font-mono text-sm">[{idx + 1}]</span>
                        <span className={`text-white/90 text-sm font-medium flex-1 leading-snug ${task.isAssigned ? 'line-through text-[#858585]' : ''}`}>{task.title}</span>
                      </div>
                      
                      {task.priority && (
                        <div className={`px-3 py-1 rounded-full border ${badgeColor} text-[10px] font-bold tracking-wider uppercase flex-shrink-0`}>
                          {task.priority}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center -space-x-2">
                          <UserAvatar
                            src={user?.photoURL}
                            name={user?.displayName || user?.email}
                            className="w-6 h-6 rounded-full border border-black bg-blue-600 overflow-hidden flex items-center justify-center text-white font-bold text-[10px]"
                            imageClassName="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[#858585] text-xs">{user?.displayName || 'Da assegnare'}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!task.isAssigned && (
                          <button onClick={() => startEditing(task, idx)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                            <Pencil size={14} className="text-[#858585]" />
                          </button>
                        )}
                        {!task.isAssigned ? (
                          <button 
                            onClick={() => handleAssignToBoard(task, idx)}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-[#006AFF] hover:bg-[#0055CC] text-white"
                          >
                            {t.meetings.assign}
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleDeassignFromBoard(task, idx)}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                          >
                            {t.meetings.unassign}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-white flex items-center gap-2">
              <FileText size={20} className="text-[#858585]" /> {t.meetings.transcript}
            </h2>
            {meeting.transcript && (
              <button 
                onClick={() => setIsTranscriptModalOpen(true)}
                className="text-sm text-[#006AFF] hover:underline"
              >
                {t.meetings.expand}
              </button>
            )}
          </div>
          <div className="text-[#858585] leading-relaxed text-[14px] h-[300px] overflow-y-auto custom-scrollbar italic pr-4 whitespace-pre-wrap">
            {typeof meeting.transcript === 'string' ? meeting.transcript : JSON.stringify(meeting.transcript)}
            {!meeting.transcript && t.meetings.transcriptUnavailable}
          </div>
        </div>

      </div>

      {editingTask && (
        <TaskModal 
          task={editingTask} 
          onClose={() => {
            setEditingTask(null);
            setEditingTaskIdx(null);
          }} 
          columns={columns} 
          epics={epics} 
          onSaveLocal={saveEditingLocal}
        />
      )}

      {isTranscriptModalOpen && meeting.transcript && (
        <TranscriptModal 
          transcript={typeof meeting.transcript === 'string' ? meeting.transcript : JSON.stringify(meeting.transcript)}
          title={meeting.title}
          onClose={() => setIsTranscriptModalOpen(false)}
        />
      )}
    </div>
  );
}
