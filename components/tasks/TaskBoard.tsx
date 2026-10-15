"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, PlusCircle, Trash2, Layout, List, CalendarDays, GripVertical, Settings2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskTimeline } from '@/components/tasks/TaskTimeline';
import { WorkflowModal } from '@/components/tasks/WorkflowModal';
import { columnCategory, displayColumnId, firstColumnOf, toggleDoneTarget } from '@/lib/taskWorkflow';
import { useWorkflowGuard } from '@/hooks/useWorkflowGuard';
import { TaskService, ColumnService, EpicService } from '@/lib/services/taskService';
import { useProject } from '@/contexts/ProjectContext';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useIAM } from '@/contexts/IamContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { safeFormat } from '@/lib/dateUtils';

const priorityStyles = {
  High: 'text-[#FF2200] border-[#FF2200]',
  Medium: 'text-[#FFAE00] border-[#FFAE00]',
  Low: 'text-[#006AFF] border-[#006AFF]',
  Critical: 'text-[#FF0004] border-[#FF0004]'
};

export function TaskCard({ 
  task, 
  index, 
  onClick,
  membersMap
}: { 
  task: any; 
  index: number; 
  onClick: () => void;
  membersMap?: Map<string, { displayName: string; photoURL?: string }>;
}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const priorityLabels: Record<string, string> = {
    Critical: t.tasks.priorityCritical,
    High: t.tasks.priorityHigh,
    Medium: t.tasks.priorityMedium,
    Low: t.tasks.priorityLow,
  };
  let blobColors = ['bg-blue-600/40', 'bg-transparent'];
  if (task.priority === 'High' || task.priority === 'Critical') {
    blobColors = ['bg-red-600/40', 'bg-transparent'];
  } else if (task.priority === 'Medium') {
    blobColors = ['bg-yellow-500/40', 'bg-transparent'];
  } else if (task.priority === 'Low') {
    blobColors = ['bg-blue-600/40', 'bg-transparent'];
  }

  const assignee = task.assigneeUid && membersMap ? membersMap.get(task.assigneeUid) : null;
  const isMine = task.assigneeUid === user?.uid;
  const avatarSrc = assignee?.photoURL || (isMine ? user?.photoURL : undefined);
  const avatarName = assignee?.displayName || task.assignee || (isMine ? (user?.displayName || user?.email) : undefined) || 'Unassigned';
  
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          id={`task-${task.id}`}
          className={`relative min-h-[185px] w-full shrink-0 overflow-hidden flex flex-col gap-5 p-6 bg-black border rounded-3xl group transition-all ${snapshot.isDragging ? 'border-white/20 shadow-xl scale-[1.02]' : 'border-white/5 hover:border-white/10'} transition-all duration-500`}
        >
          {/* Animated Blobs */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute top-[-20px] left-[-20px] w-40 h-40 opacity-40 blur-[50px] animate-blob">
              <div className={`w-full h-full rounded-full ${blobColors[0]}`} />
            </div>
            {blobColors[1] && blobColors[1] !== 'bg-transparent' && (
              <div className="absolute top-[20px] right-[-20px] w-32 h-32 opacity-30 blur-[40px] animate-blob" style={{animationDelay: '2s'}}>
                <div className={`w-full h-full rounded-full ${blobColors[1]}`} />
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#858585]">
                <Calendar size={16} />
                <span className="text-[13px] font-sans font-medium">{typeof task.date === 'string' && task.date.trim() ? task.date : (safeFormat(task.date, 'yyyy-MM-dd') || t.tasks.noDate)}</span>
              </div>
              <div className={`px-3 py-1 text-xs rounded-full border ${priorityStyles[task.priority as keyof typeof priorityStyles] || 'text-white/60 border-white/20'}`}>
                {priorityLabels[task.priority] || t.tasks.priorityMedium}
              </div>
            </div>
            <h3 className="break-words text-[22px] text-white font-halfre tracking-wide">{task.title || t.tasks.untitled}</h3>
          </div>
          
          <div className="relative z-10 flex items-center justify-between mt-2">
            <div className="flex items-center -space-x-2" title={avatarName ? `${t.tasks.assignedTo} ${avatarName}` : undefined}>
              <UserAvatar
                src={avatarSrc}
                name={avatarName}
                className="w-8 h-8 rounded-full border border-black bg-blue-600 overflow-hidden flex items-center justify-center text-white font-bold text-xs"
                imageClassName="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="px-4 py-1.5 rounded-full bg-white/10 text-white/60 text-xs font-sans">
                {task.category || t.tasks.general}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export function TaskColumn({ 
  column, 
  tasks, 
  index, 
  onTaskClick, 
  onColumnTitleChange, 
  onColumnTitleBlur, 
  onDeleteColumn,
  onNewTask,
  hasTasksWrite,
  canEditWorkflow,
  dropBlock,
  membersMap
}: { 
  column: any; 
  tasks: any[]; 
  index: number; 
  onTaskClick: (task: any) => void; 
  onColumnTitleChange: (id: string, newTitle: string) => void;
  onColumnTitleBlur: (id: string, title: string) => void;
  onDeleteColumn: (id: string) => void;
  onNewTask: (colId: string) => void;
  hasTasksWrite: boolean;
  /** Rinominare, spostare ed eliminare colonne: solo gli admin del progetto. */
  canEditWorkflow: boolean;
  /** Mentre si trascina un'attività: perché qui non può entrare (regole del flusso). */
  dropBlock?: string | null;
  membersMap?: Map<string, { displayName: string; photoURL?: string }>;
}) {
  const { t } = useTranslation();
  const category = columnCategory(column);
  return (
    <Draggable draggableId={column.id} index={index} isDragDisabled={!canEditWorkflow}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex h-fit w-[min(380px,calc(100vw-3rem))] min-w-[280px] shrink-0 flex-col gap-4 sm:min-w-[340px] sm:gap-6 ${snapshot.isDragging ? 'opacity-80' : ''}`}
        >
          <div className="flex flex-col gap-2 relative group px-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center w-full">
                <div 
                  {...provided.dragHandleProps} 
                  className={`${canEditWorkflow ? 'opacity-0 group-hover:opacity-100' : 'hidden'} transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center pr-2 shrink-0`}
                >
                  <GripVertical size={20} className="text-[#858585] hover:text-white" />
                </div>
                <span
                  title={category}
                  className={`mr-2 h-2.5 w-2.5 shrink-0 rounded-full ${category === 'done' ? 'bg-[#10B981]' : category === 'progress' ? 'bg-[#FFB800]' : 'bg-[#858585]'}`}
                />
                <input 
                  value={column.title}
                  onChange={(e) => onColumnTitleChange(column.id, e.target.value)}
                  onBlur={() => onColumnTitleBlur(column.id, column.title)}
                  readOnly={!canEditWorkflow}
                  className={`text-xl font-bold text-white font-sans bg-transparent outline-none w-full mr-4 ${canEditWorkflow ? 'focus:border-b focus:border-white/20' : ''}`}
                />
              </div>
              {hasTasksWrite && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => onNewTask(column.id)} className="flex items-center gap-2 text-[#858585] hover:text-white transition-colors shrink-0">
                    <PlusCircle size={16} />
                  </button>
                  {canEditWorkflow && (
                    <button onClick={() => onDeleteColumn(column.id)} className="text-[#858585] hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <Droppable droppableId={column.id} type="task" isDropDisabled={!!dropBlock}>
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`relative flex min-h-[500px] flex-col gap-4 rounded-[32px] border bg-[#0C0C0C] p-3 transition-colors sm:p-5 ${dropBlock ? 'border-dashed border-red-500/30 opacity-60' : snapshot.isDraggingOver ? 'border-white/10 bg-[#111]' : 'border-white/5'}`}
                title={dropBlock || undefined}
              >
                {dropBlock && (
                  <div className="pointer-events-none sticky top-0 z-20 rounded-2xl border border-red-500/20 bg-black/80 px-3 py-2 text-center text-xs text-red-300">
                    {t.tasks.dropNotAllowed} · {dropBlock}
                  </div>
                )}
                {tasks.map((task, idx) => (
                  <TaskCard key={task.id} task={task} index={idx} onClick={() => onTaskClick(task)} membersMap={membersMap} />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </Draggable>
  );
}

export function TaskBoard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organizations } = useOrganization();
  const [columns, setColumns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [activeView, setActiveView] = useState<'board' | 'tasklist' | 'timeline'>('board');
  const [compactViews, setCompactViews] = useState(false);
  const [compactActions, setCompactActions] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // Finestra del flusso: aperta (null = chiusa), con l'eventuale colonna da eliminare.
  const [workflow, setWorkflow] = useState<{ deleteId: string | null } | null>(null);
  // L'attività che si sta trascinando: le colonne dove non può entrare si spengono.
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const { activeProjectId } = useProject();
  const { canRead, canWrite, loading: iamLoading } = useIAM();
  const searchParams = useSearchParams();
  const highlightTask = searchParams?.get('highlightTask');

  const membersMap = useMemo(() => {
    const map = new Map<string, { displayName: string; photoURL?: string }>();
    organizations.forEach(org => {
      (org.members || []).forEach(m => {
        map.set(m.uid, { displayName: m.displayName || m.email, photoURL: m.photoURL });
      });
    });
    if (user) {
      map.set(user.uid, { displayName: user.displayName || user.email || 'Tu', photoURL: user.photoURL || undefined });
    }
    return map;
  }, [organizations, user]);

  useEffect(() => {
    if (highlightTask && tasks.length > 0) {
      const targetTask = tasks.find(t => t.id === highlightTask);
      
      const el = document.getElementById(`task-${highlightTask}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Pulse effect
        el.style.boxShadow = '0 0 0 2px #006AFF, 0 0 20px rgba(0, 106, 255, 0.4)';
        setTimeout(() => {
          el.style.boxShadow = 'none';
        }, 2500);
        
        // Remove from URL without refresh to avoid infinite scroll loop
        window.history.replaceState(null, '', '/');
      }
    }
  }, [highlightTask, tasks]);

  const hasTasksRead = canRead('tasks');
  const hasTasksWrite = canWrite('tasks');
  // Il flusso di lavoro lo cambiano gli admin del progetto (permesso «Impostazioni»).
  const canEditWorkflow = canWrite('settings');
  const guard = useWorkflowGuard(columns);
  const draggingTask = draggingTaskId ? tasks.find(task => task.id === draggingTaskId) : null;
  const dropBlockFor = (columnId: string) => {
    if (!draggingTask || displayColumnId(draggingTask, columns) === columnId) return null;
    const block = guard.blockOf(draggingTask, columnId);
    return block ? guard.message(block, draggingTask, columnId) : null;
  };

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || typeof ResizeObserver === 'undefined') return;

    const updateToolbarLayout = () => {
      const width = toolbar.getBoundingClientRect().width;
      setCompactViews(width < 860);
      setCompactActions(width < 600);
    };
    const observer = new ResizeObserver(updateToolbarLayout);
    observer.observe(toolbar);
    updateToolbarLayout();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeProjectId || !hasTasksRead) {
      setColumns([]);
      setTasks([]);
      setEpics([]);
      return;
    }

    let isInitialColLoad = true;
    const unsubCols = ColumnService.subscribe(activeProjectId, async (fetchedCols) => {
      if (isInitialColLoad && fetchedCols.length === 0 && hasTasksWrite) {
        isInitialColLoad = false;
        try {
          await Promise.all([
            ColumnService.create(activeProjectId, 'To Do', 0, 'todo'),
            ColumnService.create(activeProjectId, 'Doing', 1, 'progress'),
            ColumnService.create(activeProjectId, 'Done', 2, 'done')
          ]);
        } catch (e) {
          console.error("Error creating default columns:", e);
        }
      } else {
        isInitialColLoad = false;
        setColumns(fetchedCols);
      }
    });

    const unsubTasks = TaskService.subscribeTasks(activeProjectId, (fetchedTasks) => {
      setTasks(fetchedTasks);
    });

    const unsubEpics = EpicService.subscribe(activeProjectId, (fetchedEpics) => {
      setEpics(fetchedEpics);
    });

    return () => {
      unsubCols();
      unsubTasks();
      unsubEpics();
    };
  }, [activeProjectId, hasTasksRead, hasTasksWrite]);

  // Il cestino sulla colonna apre il flusso di lavoro sull'eliminazione:
  // lì si sceglie dove spostare le attività (lib/taskWorkflow.ts).
  const deleteColumn = (columnId: string) => setWorkflow({ deleteId: columnId });

  const onDragStart = (start: any) => {
    if (start.type === 'task') setDraggingTaskId(start.draggableId);
  };

  const onDragEnd = async (result: any) => {
    setDraggingTaskId(null);
    const { destination, source, draggableId, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    if (type === "column") {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);
      
      setColumns(newColumns);
      
      await ColumnService.batchUpdateOrder(newColumns.map((col, idx) => ({ id: col.id, order: idx })));
      return;
    }

    if (type === "task") {
      const sourceColId = source.droppableId;
      const destColId = destination.droppableId;
      
      const draggedTask = tasks.find(t => t.id === draggableId);
      if (!draggedTask) return;

      const sourceTasks = tasks.filter(t => displayColumnId(t, columns) === sourceColId).sort((a, b) => (a.order || 0) - (b.order || 0));
      const destTasks = sourceColId === destColId ? sourceTasks : tasks.filter(t => displayColumnId(t, columns) === destColId).sort((a, b) => (a.order || 0) - (b.order || 0));

      if (sourceColId === destColId) {
        const newTasks = Array.from(sourceTasks);
        newTasks.splice(source.index, 1);
        newTasks.splice(destination.index, 0, draggedTask);
        
        const otherTasks = tasks.filter(t => displayColumnId(t, columns) !== sourceColId);
        setTasks([...otherTasks, ...newTasks]);
        
        await TaskService.batchUpdate(newTasks.map((task, index) => ({ id: task.id, order: index })));
      } else {
        // Transizioni e condizioni del flusso (lib/taskWorkflow.ts).
        if (!guard.check(draggedTask, destColId)) return;
        const sTasks = Array.from(sourceTasks);
        sTasks.splice(source.index, 1);
        
        const dTasks = Array.from(destTasks);
        draggedTask.columnId = destColId;
        dTasks.splice(destination.index, 0, draggedTask);
        
        const otherTasks = tasks.filter(t => displayColumnId(t, columns) !== sourceColId && displayColumnId(t, columns) !== destColId);
        setTasks([...otherTasks, ...sTasks, ...dTasks]);
        
        await TaskService.batchUpdate([
          ...sTasks.map((task, index) => ({ id: task.id, order: index })),
          ...dTasks.map((task, index) => ({ id: task.id, order: index, ...(task.id === draggableId ? { columnId: destColId } : {}) }))
        ]);
      }
    }
  };

  const handleColumnTitleChange = (id: string, newTitle: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleColumnTitleBlur = async (id: string, title: string) => {
    // Con il nome si fissa la categoria: una colonna vecchia la ricavava dal nome.
    await ColumnService.update(id, { title, category: columnCategory(columns.find(c => c.id === id)) });
  };

  const openNewTaskModal = (columnId?: string) => {
    setSelectedTask({ isNew: true, columnId: columnId || (firstColumnOf(columns, 'todo') || columns[0])?.id || '' });
  };

  const toggleTaskDone = async (task: any) => {
    // In «Completato» o di nuovo in «Da fare», dalle categorie delle colonne.
    const target = toggleDoneTarget(task, columns);
    if (!target || !guard.check(task, target.columnId)) return;
    await TaskService.update(task.id, {
      columnId: target.columnId,
      completedAt: target.done ? new Date().toISOString() : null
    });
  };

  if (iamLoading) {
    return <div className="flex h-full items-center justify-center text-[#858585] text-sm">{t.tasks.verifyingPermissions}</div>;
  }

  if (!hasTasksRead) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t.tasks.accessDenied}</h2>
        <p className="text-[#858585] text-sm mb-6">
          {t.tasks.noPermissions}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col font-sans">
      <div className="relative z-10 mb-4 mt-2 min-w-0 shrink-0 sm:mb-8">
        <div ref={toolbarRef} className="flex w-full min-w-0 items-center justify-between gap-1 sm:gap-3">
        <nav className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <button 
            onClick={() => setActiveView('board')} 
            aria-label={t.tasks.board}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-[14px] ${activeView === 'board' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Layout size={16} />
            {!compactViews && <span className="whitespace-nowrap">{t.tasks.board}</span>}
          </button>
          <button 
            onClick={() => setActiveView('tasklist')} 
            aria-label={t.tasks.tasklist}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-[14px] ${activeView === 'tasklist' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <List size={16} />
            {!compactViews && <span className="whitespace-nowrap">{t.tasks.tasklist}</span>}
          </button>
          <button 
            onClick={() => setActiveView('timeline')} 
            aria-label={t.tasks.timeline}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-[14px] ${activeView === 'timeline' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <CalendarDays size={16} />
            {!compactViews && <span className="whitespace-nowrap">{t.tasks.timeline}</span>}
          </button>
        </nav>
        
        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-3">
          {hasTasksWrite && (
            <>
              <button onClick={() => openNewTaskModal()} aria-label={t.tasks.newTask} title={t.tasks.newTask} className={`flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#003B80] bg-[#002451] text-sm font-medium text-[#00A6FF] transition-colors hover:bg-[#003B80]/80 ${compactActions ? 'p-2' : 'px-4 py-2'}`}>
                <PlusCircle size={16} className="text-[#00A6FF]" />{!compactActions && <span className="whitespace-nowrap">{t.tasks.newTask}</span>}
              </button>
            </>
          )}
          {canEditWorkflow && (
            <button onClick={() => setWorkflow({ deleteId: null })} aria-label={t.tasks.manageWorkflow} title={t.tasks.manageWorkflow} className={`flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white ${compactActions ? 'p-2' : 'px-4 py-2'}`}>
              <Settings2 size={16} />{!compactActions && <span className="whitespace-nowrap">{t.tasks.workflowShort}</span>}
            </button>
          )}
        </div>
        </div>
      </div>
      
      {activeView === 'board' && (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <Droppable droppableId="board" direction="horizontal" type="column">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex min-h-0 flex-1 items-start gap-4 overflow-auto pb-2 sm:gap-8 sm:pb-4"
              >
                {columns.map((col, index) => {
                  // Un'attività senza una colonna valida compare nella prima «Da fare».
                  const columnTasks = tasks
                    .filter(t => displayColumnId(t, columns) === col.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                    
                  return (
                    <TaskColumn 
                      key={col.id} 
                      column={col} 
                      tasks={columnTasks} 
                      index={index} 
                      hasTasksWrite={hasTasksWrite}
                      canEditWorkflow={canEditWorkflow}
                      dropBlock={dropBlockFor(col.id)}
                      onTaskClick={setSelectedTask}
                      onColumnTitleChange={handleColumnTitleChange}
                      onColumnTitleBlur={handleColumnTitleBlur}
                      onDeleteColumn={deleteColumn}
                      onNewTask={openNewTaskModal}
                      membersMap={membersMap}
                    />
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {activeView === 'tasklist' && (
        <div className="flex-1 overflow-y-auto">
          <TaskList tasks={tasks} columns={columns} onTaskClick={setSelectedTask} onToggleDone={toggleTaskDone} membersMap={membersMap} />
        </div>
      )}

      {activeView === 'timeline' && (
        <div className="flex-1 overflow-y-auto">
          <TaskTimeline 
            tasks={tasks} 
            epics={epics} 
            columns={columns} 
            onTaskClick={setSelectedTask} 
            onToggleDone={toggleTaskDone} 
          />
        </div>
      )}

      {workflow && activeProjectId && (
        <WorkflowModal
          projectId={activeProjectId}
          columns={columns}
          tasks={tasks}
          initialDeleteId={workflow.deleteId}
          onClose={() => setWorkflow(null)}
        />
      )}

      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} columns={columns} epics={epics} />
    </div>
  );
}
