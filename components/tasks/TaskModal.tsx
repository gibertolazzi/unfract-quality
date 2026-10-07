import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, X, Send, Trash2, CheckCircle2, Paperclip, FileText, Image as ImageIcon, Video } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, arrayUnion, getDoc } from 'firebase/firestore';
import { TaskService } from '@/lib/services/taskService';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { deleteStoredFile, trackUpload } from '@/lib/usage';
import { useTranslation } from '@/contexts/TranslationContext';
import { parseMentions } from '@/components/shared/parseMentions';
import { MentionDropdown } from '@/components/shared/MentionDropdown';
import { UserAvatar } from '@/components/shared/UserAvatar';

const priorityStyles = {
  High: 'text-[#FF2200] border-[#FF2200] bg-[#FF2200]/10',
  Medium: 'text-[#FFAE00] border-[#FFAE00] bg-[#FFAE00]/10',
  Low: 'text-[#006AFF] border-[#006AFF] bg-[#006AFF]/10',
  Critical: 'text-[#FF0004] border-[#FF0004] bg-[#FF0004]/10'
};

const availablePriorities = ['Critical', 'High', 'Medium', 'Low'];

export function TaskModal({ task, onClose, columns, epics = [], onSaveLocal }: { task: any; onClose: () => void; columns: any[]; epics?: any[]; onSaveLocal?: (taskData: any) => void }) {
  const { user } = useAuth();
  const { t, locale } = useTranslation();
  const priorityLabels: Record<string, string> = {
    Critical: t.tasks.priorityCritical,
    High: t.tasks.priorityHigh,
    Medium: t.tasks.priorityMedium,
    Low: t.tasks.priorityLow,
  };
  const toast = useToast();
  const dialog = useDialog();
  const { activeProjectId } = useProject();
  const { activeWorkspaceId } = useWorkspace();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [category, setCategory] = useState('General');
  const [columnId, setColumnId] = useState('');
  const [epicId, setEpicId] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sessionUploadedPaths, setSessionUploadedPaths] = useState<string[]>([]);
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [descriptionMentions, setDescriptionMentions] = useState<any[]>([]);
  const [commentMentions, setCommentMentions] = useState<any[]>([]);
  const [descCursorPos, setDescCursorPos] = useState(0);
  const [commentCursorPos, setCommentCursorPos] = useState(0);
  
  const calendarRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setDescriptionMentions(task.mentions || []);
      setPriority(task.priority || 'Medium');
      setCategory(task.category || 'General');
      setColumnId(task.columnId || (columns[0]?.id || ''));
      setEpicId(task.epicId || '');
      setDate(task.date ? new Date(task.date) : undefined);
      setComments(task.comments || []);
      setAttachments(task.attachments || []);
      setSessionUploadedPaths([]);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const newAttachments = [...attachments];
    const newPaths = [...sessionUploadedPaths];
    const newlyUploadedPaths: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const storageRef = ref(storage, `tasks/attachments/${Date.now()}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress);
            },
            reject,
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                newAttachments.push({
                  id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
                  name: file.name,
                  url: downloadURL,
                  type: file.type,
                  size: file.size,
                  refPath: uploadTask.snapshot.ref.fullPath,
                  usageTracked: false,
                });
                newPaths.push(uploadTask.snapshot.ref.fullPath);
                newlyUploadedPaths.push(uploadTask.snapshot.ref.fullPath);
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          );
        });
      }

      const tracked = new Map<string, boolean>();
      for (const path of newlyUploadedPaths) tracked.set(path, await trackUpload(activeWorkspaceId, path));
      newAttachments.forEach(attachment => {
        if (newlyUploadedPaths.includes(attachment.refPath)) {
          attachment.usageTracked = tracked.get(attachment.refPath) === true;
          attachment.workspaceId = activeWorkspaceId || null;
        }
      });
      setAttachments(newAttachments);
      setSessionUploadedPaths(newPaths);
    } catch (error) {
      console.error('Upload failed', error);
      await Promise.all(newlyUploadedPaths.map(path => deleteObject(ref(storage, path)).catch(cleanupError => console.error('Error cleaning up file', cleanupError))));
      toast.error('Impossibile caricare il file. Verifica la connessione e riprova.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = async (attachment: any) => {
    const isConfirmed = await dialog.confirm({
      title: t.tasks.deleteAttachment,
      message: t.tasks.deleteAttachmentConfirm,
      isDestructive: true,
      confirmText: t.tasks.delete
    });
    if (!isConfirmed) return;
    
    // Remove from UI first for responsiveness
    const updatedAttachments = attachments.filter(a => a.id !== attachment.id);
    setAttachments(updatedAttachments);

    try {
      // If it has a refPath, we can delete it from storage
      if (attachment.refPath) {
        await deleteStoredFile(attachment.refPath, {
          workspaceId: attachment.workspaceId || activeWorkspaceId || undefined,
          bytes: attachment.size,
          usageTracked: attachment.usageTracked,
        });
        setSessionUploadedPaths(paths => paths.filter(path => path !== attachment.refPath));
      }
      
      // If the task already exists, update the db right away
      if (!isNew) {
        await TaskService.update(task.id, {
          attachments: updatedAttachments
        });
      }
    } catch (err) {
      console.error("Error removing attachment", err);
    }
  };

  const handleClose = async () => {
    if (isUploading || isSaving) return;
    // If we have uploaded files in this session but we are cancelling (not saving),
    // let's try to delete them to avoid orphans.
    if (sessionUploadedPaths.length > 0) {
      for (const path of sessionUploadedPaths) {
        try {
          const uploadedAttachment = attachments.find(attachment => attachment.refPath === path);
          await deleteStoredFile(path, {
            workspaceId: uploadedAttachment?.workspaceId || activeWorkspaceId || undefined,
            bytes: uploadedAttachment?.size,
            usageTracked: uploadedAttachment?.usageTracked,
          });
        } catch(e) { console.error("Error cleaning up file", e); }
      }
      setSessionUploadedPaths([]);
    }
    onClose();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const taskData: any = {
        title,
        description,
        priority,
        category,
        columnId: columnId || null,
        epicId: epicId || null,
        date: date ? format(date, 'yyyy-MM-dd') : null,
        updatedAt: serverTimestamp(),
        attachments,
        mentions: descriptionMentions,
      };
      if (task.requesterUid || (isNew && user?.uid)) taskData.requesterUid = task.requesterUid || user?.uid;
      if (task.assigneeUid || (isNew && user?.uid)) taskData.assigneeUid = task.assigneeUid || user?.uid;
      if (task.createdBy || (isNew && user?.uid)) taskData.createdBy = task.createdBy || user?.uid;
      if (activeProjectId) {
        taskData.projectId = activeProjectId;
      }
      if (activeWorkspaceId) taskData.workspaceId = activeWorkspaceId;

      if (onSaveLocal) {
        onSaveLocal(taskData);
      } else {
        if (isNew) {
          await TaskService.create(taskData);
        } else {
          await TaskService.update(task.id, taskData);
        }
      }
      setSessionUploadedPaths([]);
      toast.success(t.tasks.taskUpdated);
      onClose();
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error(t.tasks.saveError);
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (isNew) return;
    const isConfirmed = await dialog.confirm({
      title: t.tasks.deleteTask,
      message: t.tasks.deleteTaskConfirm,
      isDestructive: true,
      confirmText: t.tasks.delete
    });
    if (isConfirmed) {
      try {
        await TaskService.delete(task.id, task.meetingId, task.meetingTaskIdx);
        // The task service removes already-saved attachment objects. Clean up files uploaded
        // during this unsaved edit session as well, without saving those attachments to task.
        for (const path of sessionUploadedPaths) {
          const attachment = attachments.find(item => item.refPath === path);
          try {
            await deleteStoredFile(path, {
              workspaceId: attachment?.workspaceId || activeWorkspaceId || undefined,
              bytes: attachment?.size,
              usageTracked: attachment?.usageTracked,
            });
          } catch (error) {
            console.error('Error cleaning up deleted task attachment:', error);
          }
        }
        setSessionUploadedPaths([]);
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
      author: user?.displayName || t.tasks.user,
      authorUid: user?.uid,
      mentions: commentMentions,
      createdAt: new Date().toISOString()
    };
    
    try {
      await TaskService.addComment(task.id, commentData);
      setComments([...comments, commentData]);
      setNewComment('');
      setCommentMentions([]);
    } catch(err) {
      console.error("Error adding comment", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const isConfirmed = await dialog.confirm({
      title: t.tasks.deleteComment,
      message: t.tasks.deleteCommentConfirm,
      isDestructive: true,
      confirmText: t.tasks.delete
    });
    if (!isConfirmed) return;
    
    const commentToDelete = comments.find(c => c.id === commentId);
    if (!commentToDelete) return;

    try {
      // Per Firestore arrayRemove, serve l'oggetto esatto o aggiornare tutto l'array
      const newComments = comments.filter(c => c.id !== commentId);
      await TaskService.updateComments(task.id, newComments);
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-2 backdrop-blur-sm sm:p-4" onClick={handleClose}>
      <div 
        className="relative flex max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0A0A0A] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[32px]"
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
        <div className="relative z-10 flex shrink-0 items-center gap-2 border-b border-white/5 p-3 sm:gap-3 sm:p-4">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex w-max min-w-full flex-nowrap items-center gap-2 sm:gap-3">
              <div className="relative shrink-0">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={`shrink-0 appearance-none rounded-full border py-1.5 pl-3 pr-8 text-xs outline-none cursor-pointer ${priorityStyles[priority as keyof typeof priorityStyles] || 'text-white/60 border-white/20 bg-transparent'}`}
                >
                  {availablePriorities.map(p => (
                    <option key={p} value={p} className="bg-black text-white">{priorityLabels[p]}</option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>

              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={t.tasks.department}
                className="w-24 shrink-0 rounded-full border border-transparent bg-white/10 px-3 py-1.5 font-sans text-xs text-white/80 outline-none focus:border-white/20 sm:w-[120px]"
              />

              <div className="relative shrink-0">
                <select
                  value={columnId}
                  onChange={(e) => setColumnId(e.target.value)}
                  className="max-w-[125px] shrink-0 appearance-none truncate rounded-full border border-blue-500/50 bg-blue-500/10 py-1.5 pl-3 pr-7 text-xs font-medium text-blue-400 outline-none cursor-pointer sm:max-w-[160px]"
                >
                  <option value="" disabled className="bg-black text-[#858585]">{t.tasks.selectColumn}</option>
                  {columns.map(col => (
                    <option key={col.id} value={col.id} className="bg-black text-white">{col.title}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              <div className="relative shrink-0">
                <select
                  value={epicId}
                  onChange={(e) => setEpicId(e.target.value)}
                  className="max-w-[125px] shrink-0 appearance-none truncate rounded-full border border-purple-500/50 bg-purple-500/10 py-1.5 pl-3 pr-7 text-xs font-medium text-purple-400 outline-none cursor-pointer sm:max-w-[160px]"
                >
                  <option value="" className="bg-black text-[#858585]">{t.tasks.noEpic}</option>
                  {epics.map(epic => (
                    <option key={epic.id} value={epic.id} className="bg-black text-white">{epic.title}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {!isNew && (
              <button onClick={handleDelete} className="p-2 text-[#858585] hover:text-red-500 transition-colors hover:bg-white/5 rounded-full" title={t.tasks.deleteTask}>
                <Trash2 size={20} />
              </button>
            )}
            <button onClick={handleClose} disabled={isSaving || isUploading} className="p-2 text-[#858585] hover:text-white transition-colors hover:bg-white/5 rounded-full disabled:opacity-50">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content (Scrollable) */}
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 sm:gap-8 custom-scrollbar">
          
          <div className="flex flex-col gap-4">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-3xl font-halfre text-white bg-transparent border-none outline-none focus:ring-0 placeholder:text-[#858585] w-full"
              placeholder={t.tasks.taskTitlePlaceholder}
            />
            
            <div className="flex items-center gap-6 text-sm text-[#858585] font-sans">
              <div className="flex items-center gap-2 relative">
                <CalendarIcon size={16} />
                <span>{t.tasks.deadlineLabel}</span>
                <button 
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="bg-transparent border-b border-white/20 text-white font-medium outline-none focus:border-[#006AFF] py-1 hover:border-white/40 transition-colors"
                >
                  {date ? format(date, 'dd MMM yyyy', { locale: locale === 'it' ? it : undefined }) : t.tasks.selectDate}
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
                      locale={locale === 'it' ? it : undefined}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>{t.tasks.assignedTo}</span>
                <div className="flex items-center -space-x-2">
                  <UserAvatar
                    src={user?.photoURL}
                    name={user?.displayName || user?.email}
                    className="w-6 h-6 rounded-full border border-black bg-blue-600 overflow-hidden flex items-center justify-center text-white font-bold text-[10px]"
                    imageClassName="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 relative">
            <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider">{t.tasks.description}</h4>
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
              placeholder={t.tasks.descriptionPlaceholder}
            ></textarea>
            <MentionDropdown 
              value={description}
              cursorPosition={descCursorPos}
              anchorRef={descRef}
              onSelect={(val, pos, rawTag) => {
                setDescription(val);
                if (rawTag) {
                  try {
                    const parsed = JSON.parse(rawTag);
                    if (parsed.type === 'user') setDescriptionMentions(current => [...current.filter(item => item.id !== parsed.id), { type: 'user', id: parsed.id, name: parsed.name }]);
                  } catch { /* ignore malformed mention metadata */ }
                }
                setTimeout(() => {
                  descRef.current?.focus();
                  descRef.current?.setSelectionRange(pos, pos);
                }, 0);
              }}
            />
          </div>

          {/* Attachments Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider">{t.tasks.attachments}</h4>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/80 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Paperclip size={14} />
                {t.tasks.addFile}
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                multiple
                accept="image/*,video/*"
              />
            </div>

            {isUploading && (
              <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-2">
                {attachments.map((file) => (
                  <div key={file.id} className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 aspect-square flex flex-col items-center justify-center">
                    {file.type?.startsWith('image/') ? (
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                    ) : file.type?.startsWith('video/') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#858585] bg-black/40">
                        <Video size={32} className="mb-2" />
                        <span className="text-[10px] px-2 truncate w-full text-center">{file.name}</span>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#858585] bg-black/40">
                        <FileText size={32} className="mb-2" />
                        <span className="text-[10px] px-2 truncate w-full text-center">{file.name}</span>
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      </a>
                      <button 
                        onClick={() => handleRemoveAttachment(file)}
                        className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isNew && (
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-white/70 uppercase tracking-wider">{t.tasks.comments}</h4>
              <div className="flex flex-col gap-4">
                {comments.length === 0 ? (
                  <p className="text-[#858585] text-sm italic">{t.tasks.noComments}</p>
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
                            <span className="text-[11px] text-[#858585]">
                              {comment.createdAt ? format(new Date(comment.createdAt), 'dd MMM HH:mm', { locale: locale === 'it' ? it : undefined }) : ''}
                            </span>
                            {(comment.authorUid === user?.uid || comment.author === user?.displayName) && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="opacity-0 group-hover/comment:opacity-100 text-[#858585] hover:text-red-400 p-1 rounded-full transition-opacity"
                                title={t.tasks.deleteCommentTooltip}
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
              <UserAvatar
                src={user?.photoURL}
                name={user?.displayName || user?.email}
                className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden"
                imageClassName="w-full h-full object-cover"
              />
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
                  placeholder={t.tasks.writeComment}
                  className="w-full bg-white/10 border border-white/10 rounded-full py-2.5 pl-4 pr-12 text-sm text-white outline-none focus:border-white/20 transition-colors"
                />
                <MentionDropdown 
                  value={newComment}
                  cursorPosition={commentCursorPos}
                  anchorRef={commentRef}
                  position="top"
                  onSelect={(val, pos, rawTag) => {
                    setNewComment(val);
                    if (rawTag) {
                      try {
                        const parsed = JSON.parse(rawTag);
                        if (parsed.type === 'user') setCommentMentions(current => [...current.filter(item => item.id !== parsed.id), { type: 'user', id: parsed.id, name: parsed.name }]);
                      } catch { /* ignore malformed mention metadata */ }
                    }
                    setTimeout(() => {
                      commentRef.current?.focus();
                      commentRef.current?.setSelectionRange(pos, pos);
                    }, 0);
                  }}
                />
                <button 
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#858585] hover:text-white disabled:opacity-50 transition-colors bg-white/5 hover:bg-white/10 rounded-full"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1"></div>
          )}

          <div className="flex gap-3 shrink-0">
            <button onClick={handleClose} disabled={isSaving || isUploading} className="px-5 py-2.5 rounded-full text-white/70 font-medium hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50">
              {t.tasks.cancel}
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving || isUploading || !title.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#006AFF] hover:bg-blue-600 disabled:bg-blue-600/50 text-white rounded-full font-medium transition-colors"
            >
              <CheckCircle2 size={18} />
              {isSaving ? t.tasks.saving : (isNew ? t.tasks.createTask : t.tasks.saveChanges)}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
