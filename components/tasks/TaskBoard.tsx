"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, PlusCircle, Trash2, Layout, List, CalendarDays } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskTimeline } from '@/components/tasks/TaskTimeline';
import { CustomPrompt } from '@/components/shared/CustomPrompt';
import { TaskService, ColumnService, EpicService } from '@/lib/services/taskService';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDialog } from '@/contexts/DialogContext';

const priorityStyles = {
  High: 'text-[#FF2200] border-[#FF2200]',
  Medium: 'text-[#FFAE00] border-[#FFAE00]',
  Low: 'text-[#006AFF] border-[#006AFF]',
  Critical: 'text-[#FF0004] border-[#FF0004]'
};

export function TaskCard({ task, index, onClick }: { task: any; index: number; onClick: () => void }) {
  const { user } = useAuth();
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
          className={`relative overflow-hidden flex flex-col gap-5 p-6 bg-black border rounded-3xl w-full group transition-all ${snapshot.isDragging ? 'border-white/20 shadow-xl scale-[1.02]' : 'border-white/5 hover:border-white/10'}`}
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
                <span className="text-[13px] font-sans font-medium">{task.date || 'No Date'}</span>
              </div>
              <div className={`px-3 py-1 text-xs rounded-full border ${priorityStyles[task.priority as keyof typeof priorityStyles] || 'text-white/60 border-white/20'}`}>
                {task.priority || 'Medium'}
              </div>
            </div>
            <h3 className="text-[22px] text-white font-halfre tracking-wide">{task.title || 'Untitled'}</h3>
          </div>
          
          <div className="relative z-10 flex items-center justify-between mt-2">
            <div className="flex items-center -space-x-2">
              <div className="w-8 h-8 rounded-full border border-black bg-blue-600 overflow-hidden flex items-center justify-center text-white font-bold text-xs" title={user?.displayName || "Utente"}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover" />
                ) : (
                  (user?.displayName ? user.displayName.charAt(0) : 'U').toUpperCase()
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="px-4 py-1.5 rounded-full bg-white/10 text-white/60 text-xs font-sans">
                {task.category || 'General'}
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
  onNewTask
}: { 
  column: any; 
  tasks: any[]; 
  index: number; 
  onTaskClick: (task: any) => void; 
  onColumnTitleChange: (id: string, newTitle: string) => void;
  onColumnTitleBlur: (id: string, title: string) => void;
  onDeleteColumn: (id: string) => void;
  onNewTask: (colId: string) => void;
}) {
  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex flex-col gap-6 w-full min-w-[340px] max-w-[380px] ${snapshot.isDragging ? 'opacity-80' : ''}`}
        >
          <div className="flex items-center justify-between px-2" {...provided.dragHandleProps}>
            <input 
              value={column.title}
              onChange={(e) => onColumnTitleChange(column.id, e.target.value)}
              onBlur={() => onColumnTitleBlur(column.id, column.title)}
              className="text-xl font-bold text-white font-sans bg-transparent outline-none focus:border-b focus:border-white/20 w-full mr-4"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => onNewTask(column.id)} className="flex items-center gap-2 text-[#858585] hover:text-white transition-colors shrink-0">
                <PlusCircle size={16} />
              </button>
              <button onClick={() => onDeleteColumn(column.id)} className="text-[#858585] hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          
          <Droppable droppableId={column.id} type="task">
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-4 p-5 bg-[#0C0C0C] border rounded-[32px] min-h-[500px] transition-colors ${snapshot.isDraggingOver ? 'border-white/10 bg-[#111]' : 'border-white/5'}`}
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
  const [columns, setColumns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [epics, setEpics] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [activeView, setActiveView] = useState<'board' | 'tasklist' | 'timeline'>('board');
  const [showColumnPrompt, setShowColumnPrompt] = useState(false);
  const { activeProjectId } = useProject();
  const dialog = useDialog();

  useEffect(() => {
    if (!activeProjectId) {
      setColumns([]);
      setTasks([]);
      setEpics([]);
      return;
    }

    const unsubCols = ColumnService.subscribe(activeProjectId, (fetchedCols) => {
      setColumns(fetchedCols);
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
  }, [activeProjectId]);

  const addColumn = async (title: string) => {
    if (!activeProjectId) return;
    await ColumnService.create(activeProjectId, title, columns.length);
    setShowColumnPrompt(false);
  };

  const deleteColumn = async (columnId: string) => {
    const isConfirmed = await dialog.confirm({
      title: "Elimina Colonna",
      message: "Sei sicuro di voler eliminare questa colonna? I task al suo interno non verranno eliminati ma rimarranno senza colonna assegnata.",
      isDestructive: true,
      confirmText: "Elimina"
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

  return (
    <div className="flex flex-col h-full font-sans">
      <div className="relative z-10 flex items-center justify-between mb-8 mt-2">
        <nav className="flex items-center gap-2">
          <button 
            onClick={() => setActiveView('board')} 
            className={`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium ${activeView === 'board' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Layout size={16} />
            Board
          </button>
          <button 
            onClick={() => setActiveView('tasklist')} 
            className={`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium ${activeView === 'tasklist' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <List size={16} />
            Tasklist
          </button>
          <button 
            onClick={() => setActiveView('timeline')} 
            className={`flex items-center gap-2 px-4 py-2 text-[14px] rounded-xl transition-colors font-medium ${activeView === 'timeline' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <CalendarDays size={16} />
            Timeline
          </button>
        </nav>
        
        <div className="ml-auto flex items-center gap-4">
          <button onClick={() => openNewTaskModal()} className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm">
            <PlusCircle size={16} className="text-[#00A6FF]" /> Nuova Task
          </button>
          {activeView === 'board' && (
            <button onClick={() => setShowColumnPrompt(true)} className="flex items-center gap-2 px-4 py-2 text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-full font-medium transition-colors text-sm">
              <PlusCircle size={16} /> Aggiungi Colonna
            </button>
          )}
        </div>
      </div>
      
      {activeView === 'board' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="board" direction="horizontal" type="column">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex items-start gap-8 overflow-x-auto pb-8 h-full"
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
          title="Aggiungi nuova colonna" 
          placeholder="Nome della nuova colonna..." 
          onConfirm={addColumn} 
          onClose={() => setShowColumnPrompt(false)} 
        />
      )}

      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} columns={columns} epics={epics} />
    </div>
  );
}
