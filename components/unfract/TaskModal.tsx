import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, X, Send, Trash2, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, arrayUnion, getDoc } from 'firebase/firestore';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { parseMentions } from '@/lib/parseMentions';
import { MentionDropdown } from './MentionDropdown';

const priorityStyles = {
  High: 'text-[#FF2200] border-[#FF2200] bg-[#FF2200]/10',
  Medium: 'text-[#FFAE00] border-[#FFAE00] bg-[#FFAE00]/10',
  Low: 'text-[#006AFF] border-[#006AFF] bg-[#006AFF]/10',
  Critical: 'text-[#FF0004] border-[#FF0004] bg-[#FF0004]/10'
};

const availablePriorities = ['Critical', 'High', 'Medium', 'Low'];

export function TaskModal({ task, onClose, columns, epics = [], onSaveLocal }: { task: any; onClose: () => void; columns: any[]; epics?: any[]; onSaveLocal?: (taskData: any) => void }) {
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('General');
  const [columnId, setColumnId] = useState('');
  const [epicId, setEpicId] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [descCursorPos, setDescCursorPos] = useState(0);
  const [commentCursorPos, setCommentCursorPos] = useState(0);
  
  const calendarRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'Medium');
      setCategory(task.category || 'General');
      setColumnId(task.columnId || (columns[0]?.id || ''));
      setEpicId(task.epicId || '');
      setDate(task.date ? new Date(task.date) : undefined);
      setComments(task.comments || []);
    }
  }, [task, columns]);

  // Click outside to close calendar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!task) return null;

  const isNew = task.isNew;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const taskData = {
        title,
        description,
        priority,
        category,
        columnId,
        epicId,
        date: date ? format(date, 'yyyy-MM-dd') : null,
        updatedAt: serverTimestamp(),
        projectId: activeProjectId,
      };

      if (onSaveLocal) {
        onSaveLocal(taskData);
      } else {
        if (isNew) {
          await addDoc(collection(db, 'tasks'), {
            ...taskData,
            createdAt: serverTimestamp(),
            order: 999, // default to bottom
            assignees: 1,
            comments: []
          });
        } else {
          await updateDoc(doc(db, 'tasks', task.id), taskData);
        }
      }
      onClose();
    } catch (error) {
      console.error("Error saving task:", error);
      alert("Si è verificato un errore durante il salvataggio.");
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (confirm("Sei sicuro di voler eliminare definitivamente questo task?")) {
      try {
        if (task.meetingId && task.meetingTaskIdx !== undefined) {
          const meetingRef = doc(db, 'meetings', task.meetingId);
          const meetingSnap = await getDoc(meetingRef);
          if (meetingSnap.exists()) {
            const meetingData = meetingSnap.data();
            const newTasks = [...(meetingData.tasks || [])];
            if (newTasks[task.meetingTaskIdx] && newTasks[task.meetingTaskIdx].globalTaskId === task.id) {
              const updatedTask = { ...newTasks[task.meetingTaskIdx], isAssigned: false };
              delete updatedTask.globalTaskId;
              newTasks[task.meetingTaskIdx] = updatedTask;
              await updateDoc(meetingRef, { tasks: newTasks });
            }
          }
        }
        
        await deleteDoc(doc(db, 'tasks', task.id));
        onClose();
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || isNew) return;
    
    const commentData = {
      id: Date.now().toString(),
      text: newComment,
      author: user?.displayName || 'Utente',
      authorUid: user?.uid,
      createdAt: new Date().toISOString()
    };
    
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        comments: arrayUnion(commentData)
      });
      setComments([...comments, commentData]);
      setNewComment('');
    } catch(err) {
      console.error("Error adding comment", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo commento?")) return;
    
    const commentToDelete = comments.find(c => c.id === commentId);
    if (!commentToDelete) return;

    try {
      // Per Firestore arrayRemove, serve l'oggetto esatto o aggiornare tutto l'array
      const newComments = comments.filter(c => c.id !== commentId);
      await updateDoc(doc(db, 'tasks', task.id), {
        comments: newComments
      });
      setComments(newComments);
    } catch(err) {
      console.error("Error deleting comment", err);
    }
  };

  let blobColors = ['bg-blue-600/40', 'bg-transparent'];
  if (priority === 'High' || priority === 'Critical') {
    blobColors = ['bg-red-600/40', 'bg-transparent'];
  } else if (priority === 'Medium') {
    blobColors = ['bg-yellow-500/40', 'bg-transparent'];
  } else if (priority === 'Low') {
    blobColors = ['bg-blue-600/40', 'bg-transparent'];
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Background Blobs inside Modal */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[32px]">
          {blobColors[0] && (
            <div className="absolute top-[-50px] left-[-50px] w-64 h-64 opacity-20 blur-[80px]">
              <div className={`w-full h-full rounded-full ${blobColors[0]}`} />
            </div>
          )}
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <select 
                value={priority} 
                onChange={(e) => setPriority(e.target.value)}
                className={`appearance-none pr-8 pl-3 py-1.5 text-xs rounded-full border outline-none cursor-pointer ${priorityStyles[priority as keyof typeof priorityStyles] || 'text-white/60 border-white/20 bg-transparent'}`}
              >
                {availablePriorities.map(p => (
                  <option key={p} value={p} className="bg-black text-white">{p}</option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            
            <input 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Reparto"
              className="px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-sans outline-none focus:border-white/20 border border-transparent max-w-[120px]"
            />

            <div className="relative">
              <select 
                value={columnId} 
                onChange={(e) => setColumnId(e.target.value)}
                className="appearance-none pr-8 pl-4 py-1.5 rounded-full border border-blue-500/50 bg-blue-500/10 text-blue-400 text-xs font-medium cursor-pointer outline-none"
              >
                <option value="" disabled className="bg-black text-white/50">Seleziona colonna</option>
                {columns.map(col => (
                  <option key={col.id} value={col.id} className="bg-black text-white">{col.title}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            <div className="relative">
              <select 
                value={epicId} 
                onChange={(e) => setEpicId(e.target.value)}
                className="appearance-none pr-8 pl-4 py-1.5 rounded-full border border-purple-500/50 bg-purple-500/10 text-purple-400 text-xs font-medium cursor-pointer outline-none"
              >
                <option value="" className="bg-black text-white/50">Nessun Epic</option>
                {epics.map(epic => (
                  <option key={epic.id} value={epic.id} className="bg-black text-white">{epic.title}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>

          </div>
          <div className="flex items-center gap-3">
            {!isNew && (
              <button onClick={handleDelete} className="p-2 text-white/50 hover:text-red-500 transition-colors hover:bg-white/5 rounded-full" title="Elimina Task">
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors hover:bg-white/5 rounded-full">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-8 custom-scrollbar">
          
          <div className="flex flex-col gap-4">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-3xl font-halfre text-white bg-transparent border-none outline-none focus:ring-0 placeholder:text-white/30 w-full"
              placeholder="Titolo della Task"
            />
            
            <div className="flex items-center gap-6 text-sm text-white/50 font-sans">
              <div className="flex items-center gap-2 relative">
                <CalendarIcon size={16} />
                <span>Scadenza: </span>
                <button 
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="bg-transparent border-b border-white/20 text-white font-medium outline-none focus:border-[#006AFF] py-1 hover:border-white/40 transition-colors"
                >
                  {date ? format(date, 'dd MMM yyyy', { locale: it }) : 'Seleziona data'}
                </button>
                
                {isCalendarOpen && (
                  <div ref={calendarRef} className="absolute top-full left-0 mt-2 p-2 bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl z-50">
                    <style>{`
                      .rdp { --rdp-cell-size: 32px; --rdp-accent-color: #006AFF; --rdp-background-color: rgba(0, 106, 255, 0.2); margin: 0; }
                      .rdp-day_selected { background-color: #006AFF; font-weight: bold; }
                      .rdp-day_selected:hover { background-color: #0056d6; }
                      .rdp-day:hover:not(.rdp-day_selected) { background-color: rgba(255,255,255,0.1); }
                      .rdp-button { border-radius: 8px; color: white; }
                      .rdp-head_cell { color: rgba(255,255,255,0.5); font-weight: 500; font-size: 0.8rem; }
                      .rdp-caption_label { color: white; font-weight: 600; }
                      .rdp-nav_button { color: rgba(255,255,255,0.7); }
                      .rdp-nav_button:hover { background-color: rgba(255,255,255,0.1); color: white; }
                    `}</style>
                    <DayPicker
                      mode="single"
                      selected={date}
                      onSelect={(d) => { setDate(d); setIsCalendarOpen(false); }}
                      locale={it}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>Assegnato a:</span>
                <div className="flex items-center -space-x-2">
                  <div className="w-6 h-6 rounded-full border border-black bg-blue-600 overflow-hidden flex items-center justify-center text-white font-bold text-[10px]" title={user?.displayName || "Utente"}>
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover" />
                    ) : (
                      (user?.displayName ? user.displayName.charAt(0) : 'U').toUpperCase()
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 relative">
            <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Descrizione</h4>
            <textarea 
              ref={descRef}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescCursorPos(e.target.selectionStart || 0);
              }}
              onClick={(e) => setDescCursorPos(e.currentTarget.selectionStart || 0)}
              onKeyUp={(e) => setDescCursorPos(e.currentTarget.selectionStart || 0)}
              className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white/80 font-sans text-sm resize-y outline-none focus:border-white/20 transition-colors"
              placeholder="Aggiungi una descrizione dettagliata..."
            ></textarea>
            <MentionDropdown 
              value={description}
              cursorPosition={descCursorPos}
              anchorRef={descRef}
              onSelect={(val, pos) => {
                setDescription(val);
                setTimeout(() => {
                  descRef.current?.focus();
                  descRef.current?.setSelectionRange(pos, pos);
                }, 0);
              }}
            />
          </div>

          {!isNew && (
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Commenti</h4>
              <div className="flex flex-col gap-4">
                {comments.length === 0 ? (
                  <p className="text-white/30 text-sm italic">Nessun commento presente.</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {comment.author === 'Giacomo' ? 'GB' : comment.author.charAt(0)}
                      </div>
                      <div className="flex flex-col gap-1 bg-white/5 px-4 py-3 rounded-2xl rounded-tl-none border border-white/5 w-full relative group/comment">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-white">{comment.author}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-white/40">
                              {comment.createdAt ? format(new Date(comment.createdAt), 'dd MMM HH:mm', { locale: it }) : ''}
                            </span>
                            {(comment.authorUid === user?.uid || comment.author === user?.displayName) && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="opacity-0 group-hover/comment:opacity-100 text-white/40 hover:text-red-400 p-1 rounded-full transition-opacity"
                                title="Elimina commento"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed pr-6">{parseMentions(comment.text)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Comment Input / Footer actions */}
        <div className="relative z-10 p-4 border-t border-white/5 bg-black/40 flex flex-col md:flex-row justify-between items-center gap-4">
          {!isNew ? (
            <div className="flex items-center gap-3 w-full md:w-auto flex-1">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover" />
                ) : (
                  (user?.displayName ? user.displayName.charAt(0) : 'U').toUpperCase()
                )}
              </div>
              <div className="flex-1 relative max-w-md">
                <input 
                  ref={commentRef}
                  type="text" 
                  value={newComment}
                  onChange={(e) => {
                    setNewComment(e.target.value);
                    setCommentCursorPos(e.target.selectionStart || 0);
                  }}
                  onClick={(e) => setCommentCursorPos(e.currentTarget.selectionStart || 0)}
                  onKeyUp={(e) => setCommentCursorPos(e.currentTarget.selectionStart || 0)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                  placeholder="Scrivi un commento..." 
                  className="w-full bg-white/10 border border-white/10 rounded-full py-2.5 pl-4 pr-12 text-sm text-white outline-none focus:border-white/20 transition-colors"
                />
                <MentionDropdown 
                  value={newComment}
                  cursorPosition={commentCursorPos}
                  anchorRef={commentRef}
                  position="top"
                  onSelect={(val, pos) => {
                    setNewComment(val);
                    setTimeout(() => {
                      commentRef.current?.focus();
                      commentRef.current?.setSelectionRange(pos, pos);
                    }, 0);
                  }}
                />
                <button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-50 transition-colors bg-white/5 hover:bg-white/10 rounded-full"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1"></div>
          )}

          <div className="flex gap-3 shrink-0">
            <button onClick={onClose} className="px-5 py-2.5 rounded-full text-white/70 font-medium hover:text-white hover:bg-white/5 transition-colors">
              Annulla
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving || !title.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#006AFF] hover:bg-blue-600 disabled:bg-blue-600/50 text-white rounded-full font-medium transition-colors"
            >
              <CheckCircle2 size={18} />
              {isSaving ? 'Salvataggio...' : (isNew ? 'Crea Task' : 'Salva Modifiche')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
