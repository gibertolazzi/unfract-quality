"use client";

import React, { useEffect, useState } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { getMeetingById } from '@/lib/meetings';
import { Meeting } from '@/components/unfract/meetings/types';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ChevronLeft, Calendar, Clock, User, CheckCircle2, FileText, Target, Pencil, Check, X } from 'lucide-react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TaskModal } from '@/components/unfract/TaskModal';
import { useProject } from '@/contexts/ProjectContext';
import { TranscriptModal } from '@/components/unfract/meetings/TranscriptModal';

export default function MeetingDetailPage({ params }: { params: { id: string } }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [columns, setColumns] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [editingTaskIdx, setEditingTaskIdx] = useState<number | null>(null);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);

  const { user, loading: authLoading } = useAuth();
  const { activeProjectId } = useProject();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!user || !activeProjectId) {
      router.push('/');
      return;
    }
    
    getMeetingById(params.id).then(doc => {
      setMeeting(doc);
      setIsLoading(false);
    });

    const loadData = async () => {
      const cSnap = await getDocs(query(collection(db, 'columns'), where('projectId', '==', activeProjectId)));
      setColumns(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const eSnap = await getDocs(query(collection(db, 'epics'), where('projectId', '==', activeProjectId)));
      setEpics(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadData();
  }, [params.id, user, authLoading, router]);

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-white/50" /></div>;
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-xl font-bold mb-2">Meeting non trovato</h2>
        <button onClick={() => router.push('/meetings')} className="px-4 py-2 bg-[#006AFF] rounded-lg mt-4 text-white">Torna ai meeting</button>
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
        columnId: todoColId,
        date: new Date().toLocaleDateString('it-IT'),
        meetingId: params.id,
        meetingTaskIdx: idx,
        projectId: activeProjectId
      });

      // Mark as assigned in meeting document
      const newTasks = [...meeting.tasks];
      newTasks[idx] = { ...newTasks[idx], isAssigned: true, globalTaskId: docRef.id };
      await updateDoc(doc(db, "meetings", params.id), { tasks: newTasks });
      setMeeting({ ...meeting, tasks: newTasks });
      
      alert("Task inviata alla TaskBoard con successo!");
    } catch (e) {
      console.error(e);
      alert("Errore durante l'invio della task.");
    }
  };

  const handleDeassignFromBoard = async (task: any, idx: number) => {
    if (!task.globalTaskId) return;
    if (confirm("Sei sicuro di voler rimuovere l'assegnazione? Questo eliminerà la task dalla Kanban board globale.")) {
      try {
        await deleteDoc(doc(db, 'tasks', task.globalTaskId));
        
        const newTasks = [...meeting.tasks];
        const updatedTask = { ...newTasks[idx], isAssigned: false };
        delete updatedTask.globalTaskId;
        newTasks[idx] = updatedTask;
        
        await updateDoc(doc(db, "meetings", params.id), { tasks: newTasks });
        setMeeting({ ...meeting, tasks: newTasks });
        
      } catch (e) {
        console.error(e);
        alert("Errore durante la de-assegnazione.");
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
    } catch (e) {
      console.error(e);
      alert("Errore durante il salvataggio.");
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
        <h1 className="text-[32px] font-medium text-white tracking-wide mb-4">
          {meeting.title}
        </h1>
        <div className="flex items-center gap-6 text-white/50 text-[15px]">
          <div className="flex items-center gap-2"><Calendar size={16} /> {meeting.date}</div>
          <div className="flex items-center gap-2"><Clock size={16} /> {meeting.duration}</div>
          <div className="flex items-center gap-2"><User size={16} /> {meeting.manager}</div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        
        {/* Riga 1: Riassunto e Decisioni */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="md:col-span-2 bg-[#111] border border-white/5 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
              <FileText size={20} className="text-[#006AFF]" /> Riassunto
            </h2>
            <div className="text-white/80 leading-relaxed text-[15px]">
              {meeting.summary}
            </div>
          </div>

          <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
            <h2 className="text-xl font-medium text-white mb-4 flex items-center gap-2">
              <Target size={20} className="text-purple-500" /> Decisioni Prese
            </h2>
            
            {meeting.decisions.length === 0 ? (
              <p className="text-white/40 text-sm">Nessuna decisione registrata.</p>
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

        {/* Riga 2: Action Items */}
        <div className="bg-[#111] border border-[#006AFF]/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#006AFF]/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h2 className="text-xl font-medium text-white flex items-center gap-2">
              <CheckCircle2 size={20} className="text-[#006AFF]" /> Action Items
            </h2>
          </div>
          
          {meeting.tasks.length === 0 ? (
            <p className="text-white/40 text-sm relative z-10">Nessun task emerso.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
              {meeting.tasks.map((task, idx) => {
                let bgColor = 'bg-white/5';
                let borderColor = 'border-white/10';
                let badgeColor = 'text-white/50 border-white/20';
                
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
                        <span className={`text-white/90 text-sm font-medium flex-1 leading-snug ${task.isAssigned ? 'line-through text-white/50' : ''}`}>{task.title}</span>
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
                          <div className="w-6 h-6 rounded-full border border-black bg-blue-600 overflow-hidden flex items-center justify-center text-white font-bold text-[10px]" title={user?.displayName || "Utente"}>
                            {user?.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover" />
                            ) : (
                              (user?.displayName ? user.displayName.charAt(0) : 'U').toUpperCase()
                            )}
                          </div>
                        </div>
                        <span className="text-white/40 text-xs">{user?.displayName || 'Da assegnare'}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!task.isAssigned && (
                          <button onClick={() => startEditing(task, idx)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                            <Pencil size={14} className="text-white/50" />
                          </button>
                        )}
                        {!task.isAssigned ? (
                          <button 
                            onClick={() => handleAssignToBoard(task, idx)}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-[#006AFF] hover:bg-[#0055CC] text-white"
                          >
                            Assegna
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleDeassignFromBoard(task, idx)}
                            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                          >
                            De-assegna
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

        {/* Riga 3: Trascrizione */}
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium text-white flex items-center gap-2">
              <FileText size={20} className="text-white/50" /> Trascrizione Completa
            </h2>
            {meeting.transcript && (
              <button 
                onClick={() => setIsTranscriptModalOpen(true)}
                className="text-sm text-[#006AFF] hover:underline"
              >
                Espandi
              </button>
            )}
          </div>
          <div className="text-white/50 leading-relaxed text-[14px] h-[300px] overflow-y-auto custom-scrollbar italic pr-4 whitespace-pre-wrap">
            {typeof meeting.transcript === 'string' ? meeting.transcript : JSON.stringify(meeting.transcript)}
            {!meeting.transcript && "Trascrizione non disponibile."}
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
