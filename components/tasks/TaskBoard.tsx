"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, PlusCircle, Trash2, Layout, List, CalendarDays, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskTimeline } from '@/components/tasks/TaskTimeline';
import { CustomPrompt } from '@/components/shared/CustomPrompt';
import { TaskService, ColumnService, EpicService } from '@/lib/services/taskService';
import { useProject } from '@/contexts/ProjectContext';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/contexts/DialogContext';
import { useIAM } from '@/contexts/IamContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { UserAvatar } from '@/components/shared/UserAvatar';

const priorityStyles = {
  High: 'text-[#FF2200] border-[#FF2200]',
  Medium: 'text-[#FFAE00] border-[#FFAE00]',
  Low: 'text-[#006AFF] border-[#006AFF]',
  Critical: 'text-[#FF0004] border-[#FF0004]'
};

export function TaskCard({ task, index, onClick }: { task: any; index: number; onClick: () => void }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  let blobColors = ['bg-blue-600/40', 'bg-transparent'];
  if (task.priority === 'High' || task.priority === 'Critical') {
    blobColors = ['bg-red-600/40', 'bg-transparent'];
  } else if (task.priority === 'Medium') {
    blobColors = ['bg-yellow-500/40', 'bg-transparent'];
  } else if (task.priority === 'Low') {
    blobColors = ['bg-blue-600/40', 'bg-transparent'];
  }
  
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          id={`task-${task.id}`}
          className={`relative overflow-hidden flex flex-col gap-5 p-6 bg-black border rounded-3xl w-full group transition-all ${snapshot.isDragging ? 'border-white/20 shadow-xl scale-[1.02]' : 'border-white/5 hover:border-white/10'} transition-all duration-500`}
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
                <span className="text-[13px] font-sans font-medium">{task.date || t.tasks.noDate}</span>
              </div>
              <div className={`px-3 py-1 text-xs rounded-full border ${priorityStyles[task.priority as keyof typeof priorityStyles] || 'text-white/60 border-white/20'}`}>
                {task.priority || 'Medium'}
              </div>
            </div>
            <h3 className="text-[22px] text-white font-halfre tracking-wide">{task.title || t.tasks.untitled}</h3>
          </div>
          
          <div className="relative z-10 flex items-center justify-between mt-2">
            <div className="flex items-center -space-x-2">
              <UserAvatar
                src={user?.photoURL}
                name={user?.displayName || user?.email}
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
  hasTasksWrite
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
}) {
  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex h-full min-h-0 w-full min-w-[280px] max-w-[380px] flex-col gap-4 sm:min-w-[340px] sm:gap-6 ${snapshot.isDragging ? 'opacity-80' : ''}`}
        >
          <div className="flex flex-col gap-2 relative group px-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center w-full">
                <div 
                  {...provided.dragHandleProps} 
                  className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center pr-2 shrink-0"
                >
                  <GripVertical size={20} className="text-[#858585] hover:text-white" />
                </div>
                <input 
                  value={column.title}
                  onChange={(e) => onColumnTitleChange(column.id, e.target.value)}
                  onBlur={() => onColumnTitleBlur(column.id, column.title)}
                  readOnly={!hasTasksWrite}
                  className={`text-xl font-bold text-white font-sans bg-transparent outline-none w-full mr-4 ${hasTasksWrite ? 'focus:border-b focus:border-white/20' : ''}`}
                />
              </div>
              {hasTasksWrite && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => onNewTask(column.id)} className="flex items-center gap-2 text-[#858585] hover:text-white transition-colors shrink-0">
                    <PlusCircle size={16} />
                  </button>
                  <button onClick={() => onDeleteColumn(column.id)} className="text-[#858585] hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <Droppable droppableId={column.id} type="task">
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-[32px] border bg-[#0C0C0C] p-3 transition-colors sm:p-5 ${snapshot.isDraggingOver ? 'border-white/10 bg-[#111]' : 'border-white/5'}`}
              >
                {tasks.map((t, idx) => (
                  <TaskCard key={t.id} task={t} index={idx} onClick={() => onTaskClick(t)} />
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
  const [columns, setColumns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [activeView, setActiveView] = useState<'board' | 'tasklist' | 'timeline'>('board');
  const [compactToolbar, setCompactToolbar] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [showColumnPrompt, setShowColumnPrompt] = useState(false);
  const { activeProjectId } = useProject();
  const dialog = useDialog();
  const { canRead, canWrite, loading: iamLoading } = useIAM();
  const searchParams = useSearchParams();
  const highlightTask = searchParams?.get('highlightTask');

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

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || typeof ResizeObserver === 'undefined') return;

    const updateToolbarLayout = () => {
      setCompactToolbar(toolbar.getBoundingClientRect().width < 900);
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
            ColumnService.create(activeProjectId, 'To Do', 0),
            ColumnService.create(activeProjectId, 'Doing', 1),
            ColumnService.create(activeProjectId, 'Done', 2)
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

  const addColumn = async (title: string) => {
    if (!activeProjectId) return;
    try {
      await ColumnService.create(activeProjectId, title, columns.length);
    } catch (e) {
      console.error("Error creating column:", e);
    }
    setShowColumnPrompt(false);
  };

  const deleteColumn = async (columnId: string) => {
    const isConfirmed = await dialog.confirm({
      title: t.tasks.deleteColumn,
      message: t.tasks.deleteColumnConfirm,
      isDestructive: true,
      confirmText: t.tasks.delete
    });
    
    if (isConfirmed) {
      await ColumnService.delete(columnId);
    }
  };

  const onDragEnd = async (result: any) => {
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

      const sourceTasks = tasks.filter(t => t.columnId === sourceColId).sort((a, b) => (a.order || 0) - (b.order || 0));
      const destTasks = sourceColId === destColId ? sourceTasks : tasks.filter(t => t.columnId === destColId).sort((a, b) => (a.order || 0) - (b.order || 0));

      if (sourceColId === destColId) {
        const newTasks = Array.from(sourceTasks);
        newTasks.splice(source.index, 1);
        newTasks.splice(destination.index, 0, draggedTask);
        
        const otherTasks = tasks.filter(t => t.columnId !== sourceColId);
        setTasks([...otherTasks, ...newTasks]);
        
        await TaskService.batchUpdate(newTasks.map((task, index) => ({ id: task.id, order: index })));
      } else {
        const sTasks = Array.from(sourceTasks);
        sTasks.splice(source.index, 1);
        
        const dTasks = Array.from(destTasks);
        draggedTask.columnId = destColId;
        dTasks.splice(destination.index, 0, draggedTask);
        
        const otherTasks = tasks.filter(t => t.columnId !== sourceColId && t.columnId !== destColId);
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
    await ColumnService.update(id, { title });
  };

  const openNewTaskModal = (columnId?: string) => {
    setSelectedTask({ isNew: true, columnId: columnId || columns[0]?.id || '' });
  };

  const toggleTaskDone = async (task: any) => {
    const doneCol = columns.find(c => c.title.toLowerCase() === 'done');
    const todoCol = columns.find(c => c.title.toLowerCase().includes('to do') || c.title.toLowerCase() === 'todo') || columns[0];
    
    if (!doneCol || !todoCol) return;
    
    const isDone = task.columnId === doneCol.id;
    const newColId = isDone ? todoCol.id : doneCol.id;
    
    await TaskService.update(task.id, { 
      columnId: newColId,
      completedAt: isDone ? null : new Date().toISOString()
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
        <nav className="flex min-w-0 shrink items-center gap-0.5 sm:gap-2">
          <button 
            onClick={() => setActiveView('board')} 
            aria-label={t.tasks.board}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-[14px] ${activeView === 'board' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Layout size={16} />
            {!compactToolbar && <span className="whitespace-nowrap">{t.tasks.board}</span>}
          </button>
          <button 
            onClick={() => setActiveView('tasklist')} 
            aria-label={t.tasks.tasklist}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-[14px] ${activeView === 'tasklist' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <List size={16} />
            {!compactToolbar && <span className="whitespace-nowrap">{t.tasks.tasklist}</span>}
          </button>
          <button 
            onClick={() => setActiveView('timeline')} 
            aria-label={t.tasks.timeline}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-[14px] ${activeView === 'timeline' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <CalendarDays size={16} />
            {!compactToolbar && <span className="whitespace-nowrap">{t.tasks.timeline}</span>}
          </button>
        </nav>
        
        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-3">
          {hasTasksWrite && (
            <>
              <button onClick={() => openNewTaskModal()} aria-label={t.tasks.newTask} title={t.tasks.newTask} className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#003B80] bg-[#002451] px-4 py-2 text-sm font-medium text-[#00A6FF] transition-colors hover:bg-[#003B80]/80">
                <PlusCircle size={16} className="text-[#00A6FF]" /><span className="whitespace-nowrap">{t.tasks.newTask}</span>
              </button>
              {activeView === 'board' && (
                <button onClick={() => setShowColumnPrompt(true)} aria-label={t.tasks.addColumn} title={t.tasks.addColumn} className="flex shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white">
                  <PlusCircle size={16} /><span className="whitespace-nowrap">{t.tasks.addColumn}</span>
                </button>
              )}
            </>
          )}
        </div>
        </div>
      </div>
      
      {activeView === 'board' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="board" direction="horizontal" type="column">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden pb-2 sm:gap-8 sm:pb-4"
              >
                {columns.map((col, index) => {
                  const columnTasks = tasks
                    .filter(t => t.columnId === col.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                    
                  return (
                    <TaskColumn 
                      key={col.id} 
                      column={col} 
                      tasks={columnTasks} 
                      index={index} 
                      hasTasksWrite={hasTasksWrite}
                      onTaskClick={setSelectedTask}
                      onColumnTitleChange={handleColumnTitleChange}
                      onColumnTitleBlur={handleColumnTitleBlur}
                      onDeleteColumn={deleteColumn}
                      onNewTask={openNewTaskModal}
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
          <TaskList tasks={tasks} columns={columns} onTaskClick={setSelectedTask} onToggleDone={toggleTaskDone} />
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

      {showColumnPrompt && (
        <CustomPrompt 
          title={t.tasks.addNewColumn} 
          placeholder={t.tasks.newColumnPlaceholder} 
          onConfirm={addColumn} 
          onClose={() => setShowColumnPrompt(false)} 
        />
      )}

      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} columns={columns} epics={epics} />
    </div>
  );
}
