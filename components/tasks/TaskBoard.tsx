"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlusCircle, Plus, Layout, List, CalendarDays, GripVertical, Settings2, ChevronDown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskModal } from '@/components/tasks/TaskModal';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskTimeline } from '@/components/tasks/TaskTimeline';
import { WorkflowModal, type WorkflowTab } from '@/components/tasks/WorkflowModal';
import { TaskCard } from '@/components/tasks/TaskCard';
import { ColumnMenu } from '@/components/tasks/ColumnMenu';
import { StatusDot } from '@/components/tasks/StatusPicker';
import { columnColor } from '@/lib/statusColors';
import { SwimlaneBoard } from '@/components/tasks/SwimlaneBoard';
import { BoardFilterBar } from '@/components/tasks/BoardFilterBar';
import {
  COLUMN_CATEGORIES, columnCategory, completedAtUpdate, deleteColumnBlock, displayColumnId, firstColumnOf, toggleDoneTarget,
  type ColumnCategory,
} from '@/lib/taskWorkflow';
import {
  buildLanes, EMPTY_FILTERS, filterTasks, laneKey, laneUpdate, NO_EPIC, parseCellId, UNASSIGNED,
  type BoardFilters, type LaneMode,
} from '@/lib/boardFilters';
import { formatMessage } from '@/lib/i18n/formatMessage';
import { useToast } from '@/contexts/ToastContext';
import { useWorkflowGuard } from '@/hooks/useWorkflowGuard';
import { TaskService, ColumnService, EpicService } from '@/lib/services/taskService';
import { useProject } from '@/contexts/ProjectContext';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useIAM } from '@/contexts/IamContext';
import { useTranslation } from '@/contexts/TranslationContext';

export function TaskColumn({ 
  column, 
  columns,
  tasks, 
  index, 
  onTaskClick, 
  onColumnTitleChange, 
  onColumnTitleBlur, 
  onColumnAction,
  onCategory,
  onColor,
  onNewTask,
  onMove,
  hasTasksWrite,
  canEditWorkflow,
  dropBlock,
  membersMap
}: { 
  column: any; 
  columns: any[];
  tasks: any[]; 
  index: number; 
  onTaskClick: (task: any) => void; 
  onColumnTitleChange: (id: string, newTitle: string) => void; 
  onColumnTitleBlur: (id: string, title: string) => void; 
  /** Dal menu ⋯: apre il flusso di lavoro su questa colonna. */
  onColumnAction: (action: 'rules' | 'transitions' | 'delete', columnId: string) => void;
  onCategory: (columnId: string, category: ColumnCategory) => void;
  onColor: (columnId: string, color: string | null) => void;
  onNewTask: (colId: string) => void;
  onMove: (task: any, columnId: string) => void;
  hasTasksWrite: boolean;
  /** Rinominare, spostare ed eliminare colonne: solo gli admin del progetto. */
  canEditWorkflow: boolean;
  /** Mentre si trascina un'attività: perché qui non può entrare (regole del flusso). */
  dropBlock?: string | null;
  membersMap?: Map<string, { displayName: string; photoURL?: string }>;
}) {
  const { t } = useTranslation();
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <Draggable draggableId={column.id} index={index} isDragDisabled={!canEditWorkflow}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex h-fit w-[calc(100vw-3.75rem)] max-w-[340px] min-w-[260px] shrink-0 flex-col gap-3 sm:w-[340px] sm:min-w-[340px] lg:w-[360px] sm:gap-6 ${snapshot.isDragging ? 'opacity-80' : ''}`}
        >
          <div className="flex flex-col gap-2 relative group px-2">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center w-full">
                <div 
                  {...provided.dragHandleProps} 
                  className={`${canEditWorkflow ? 'opacity-0 group-hover:opacity-100' : 'hidden'} transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center pr-2 shrink-0`}
                >
                  <GripVertical size={20} className="text-[#858585] hover:text-white" />
                </div>
                <span className="mr-2 flex"><StatusDot color={columnColor(column)} className="h-2.5 w-2.5" /></span>
                <input 
                  ref={titleRef}
                  value={column.title}
                  onChange={(e) => onColumnTitleChange(column.id, e.target.value)}
                  onBlur={() => onColumnTitleBlur(column.id, column.title)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  readOnly={!canEditWorkflow}
                  className={`min-w-0 text-lg sm:text-xl font-bold text-white font-sans bg-transparent outline-none w-full mr-2 ${canEditWorkflow ? 'focus:border-b focus:border-white/20' : ''}`}
                />
                <span className="mr-2 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] sm:text-[11px] text-white/60">{tasks.length}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasTasksWrite && (
                  <button onClick={() => onNewTask(column.id)} aria-label={t.tasks.newTask} title={t.tasks.newTask} className="rounded-md p-1 text-[#858585] hover:bg-white/10 hover:text-white transition-colors">
                    <PlusCircle size={16} />
                  </button>
                )}
                <ColumnMenu
                  column={column}
                  canEditWorkflow={canEditWorkflow}
                  canAddTask={false}
                  onNewTask={() => onNewTask(column.id)}
                  onRename={() => { titleRef.current?.focus(); titleRef.current?.select(); }}
                  onCategory={(next) => onCategory(column.id, next)}
                  onColor={(color) => onColor(column.id, color)}
                  onRules={() => onColumnAction('rules', column.id)}
                  onTransitions={() => onColumnAction('transitions', column.id)}
                  onDelete={() => onColumnAction('delete', column.id)}
                />
              </div>
            </div>
          </div>
          
          <Droppable droppableId={column.id} type="task" isDropDisabled={!!dropBlock}>
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`relative flex min-h-[360px] flex-col gap-3 rounded-2xl border bg-[#0C0C0C] p-2.5 transition-colors sm:min-h-[500px] sm:gap-4 sm:rounded-[32px] sm:p-5 ${dropBlock ? 'border-dashed border-red-500/30 opacity-60' : snapshot.isDraggingOver ? 'border-white/10 bg-[#111]' : 'border-white/5'}`}
                title={dropBlock || undefined}
              >
                {dropBlock && (
                  <div className="pointer-events-none sticky top-0 z-20 rounded-2xl border border-red-500/20 bg-black/80 px-3 py-2 text-center text-xs text-red-300">
                    {t.tasks.dropNotAllowed} · {dropBlock}
                  </div>
                )}
                {tasks.map((task, idx) => (
                  <TaskCard key={task.id} task={task} index={idx} onClick={() => onTaskClick(task)} membersMap={membersMap} columns={columns} onMove={onMove} />
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

/** «+ Aggiungi colonna» in fondo alla bacheca, come in Jira. */
function AddColumnCard({ onAdd }: { onAdd: (title: string, category: ColumnCategory) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ColumnCategory>('todo');
  const [busy, setBusy] = useState(false);
  const categoryLabel: Record<ColumnCategory, string> = {
    todo: t.tasks.categoryTodo,
    progress: t.tasks.categoryProgress,
    done: t.tasks.categoryDone,
  };
  const close = () => { setOpen(false); setTitle(''); setCategory('todo'); };
  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const ok = await onAdd(title.trim(), category);
    setBusy(false);
    if (ok) close();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-14 w-[220px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 text-sm text-[#858585] transition-colors hover:border-white/25 hover:text-white"
      >
        <Plus size={16} />{t.tasks.addColumn}
      </button>
    );
  }
  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-[#0C0C0C] p-3">
      <input
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close(); }}
        placeholder={t.tasks.newColumnTitle}
        className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-[#555] focus:border-white/25"
      />
      <div className="relative">
        <select
          value={category}
          onChange={e => setCategory(e.target.value as ColumnCategory)}
          className="w-full appearance-none rounded-lg border border-white/10 bg-[#111] pl-3 pr-8 py-1.5 text-xs text-white outline-none focus:border-white/25 cursor-pointer"
        >
          {COLUMN_CATEGORIES.map(c => <option key={c} value={c} className="bg-[#141414] text-white">{categoryLabel[c]}</option>)}
        </select>
        <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50" />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close} className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white">{t.tasks.cancel}</button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !title.trim()}
          className="rounded-full bg-[#006AFF] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          {t.tasks.addColumn}
        </button>
      </div>
    </div>
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
  // Finestra del flusso: aperta (null = chiusa), sulla scheda e la colonna scelte dal menu ⋯.
  const [workflow, setWorkflow] = useState<{ deleteId?: string | null; tab?: WorkflowTab; rulesId?: string | null } | null>(null);
  // Filtri rapidi (bacheca, elenco, cronologia) e corsie (solo bacheca).
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [laneMode, setLaneMode] = useState<LaneMode>('none');
  const toast = useToast();
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
  const visibleTasks = useMemo(() => filterTasks(tasks, filters, user?.uid), [tasks, filters, user?.uid]);
  const lanesOn = activeView === 'board' && laneMode !== 'none';

  const priorityLabels: Record<string, string> = {
    Critical: t.tasks.priorityCritical,
    High: t.tasks.priorityHigh,
    Medium: t.tasks.priorityMedium,
    Low: t.tasks.priorityLow,
  };
  const nameOf = (uid: string) =>
    membersMap.get(uid)?.displayName || tasks.find(task => task.assigneeUid === uid)?.assignee || uid;
  const assignees = useMemo(() => {
    const uids = [...new Set(tasks.map(task => task.assigneeUid).filter(Boolean) as string[])];
    return uids.map(uid => ({ uid, name: membersMap.get(uid)?.displayName || tasks.find(task => task.assigneeUid === uid)?.assignee || uid }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks, membersMap]);
  const laneLabel = (key: string) => {
    if (laneMode === 'assignee') {
      if (key === UNASSIGNED) return t.tasks.filterUnassigned;
      return key === user?.uid ? formatMessage(t.tasks.laneMe, { name: nameOf(key) }) : nameOf(key);
    }
    if (laneMode === 'epic') return key === NO_EPIC ? t.tasks.filterNoEpic : epics.find(e => e.id === key)?.title || key;
    return priorityLabels[key] || key;
  };
  const lanes = lanesOn
    ? buildLanes(visibleTasks, laneMode, { uid: user?.uid, nameOf, epics }).map(lane => ({ ...lane, label: laneLabel(lane.key) }))
    : [];

  // Mentre si trascina: le colonne (o le celle) dove l'attività non può entrare, con il motivo.
  const draggingTask = draggingTaskId ? tasks.find(task => task.id === draggingTaskId) : null;
  const dropBlockFor = (columnId: string, lane: string | null = null) => {
    if (!draggingTask || displayColumnId(draggingTask, columns) === columnId) return null;
    const moved = lane !== null && lane !== laneKey(draggingTask, laneMode)
      ? { ...draggingTask, ...laneUpdate(laneMode, lane, nameOf) }
      : draggingTask;
    const block = guard.blockOf(moved, columnId);
    return block ? guard.message(block, moved, columnId) : null;
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

  // Il menu ⋯ della colonna apre il flusso di lavoro lì dove serve: per
  // eliminarla si sceglie dove spostare le attività (lib/taskWorkflow.ts).
  const columnAction = (action: 'rules' | 'transitions' | 'delete', columnId: string) => {
    if (action === 'delete') setWorkflow({ deleteId: columnId });
    else if (action === 'rules') setWorkflow({ tab: 'columns', rulesId: columnId });
    else setWorkflow({ tab: 'transitions' });
  };

  const changeColumnCategory = async (columnId: string, category: ColumnCategory) => {
    const column = columns.find(c => c.id === columnId);
    if (!column || columnCategory(column) === category) return;
    const block = deleteColumnBlock(columns, columnId);
    if (block) {
      toast.error(block === 'last-todo' ? t.tasks.deleteColumnLastTodo : t.tasks.deleteColumnLastDone);
      return;
    }
    try {
      await ColumnService.update(columnId, { category });
    } catch (error) {
      console.error('Category change failed:', error);
      toast.error(t.tasks.workflowSaveError);
    }
  };

  const changeColumnColor = async (columnId: string, color: string | null) => {
    try {
      await ColumnService.update(columnId, { color });
    } catch (error) {
      console.error('Color change failed:', error);
      toast.error(t.tasks.workflowSaveError);
    }
  };

  const addColumn = async (title: string, category: ColumnCategory) => {
    if (!activeProjectId) return false;
    try {
      await ColumnService.create(activeProjectId, title, columns.length, category);
      return true;
    } catch (error) {
      console.error('Add column failed:', error);
      toast.error(t.tasks.workflowSaveError);
      return false;
    }
  };

  // «Sposta in» dalla scheda o dall'elenco: in fondo alla colonna scelta.
  const moveTask = async (task: any, columnId: string) => {
    if (!guard.check(task, columnId)) return;
    const last = tasks
      .filter(other => displayColumnId(other, columns) === columnId)
      .reduce((max, other) => Math.max(max, other.order || 0), -1);
    try {
      await TaskService.update(task.id, { columnId, order: last + 1, ...completedAtUpdate(task, columnId, columns) });
    } catch (error) {
      console.error('Move failed:', error);
      toast.error(t.tasks.saveError);
    }
  };

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
      // Con le corsie l'ID è «corsia::colonna» (lib/boardFilters.ts).
      const from = parseCellId(source.droppableId);
      const to = parseCellId(destination.droppableId);
      const draggedTask = tasks.find(task => task.id === draggableId);
      if (!draggedTask) return;

      const laneChange = to.lane !== null && to.lane !== from.lane ? laneUpdate(laneMode, to.lane, nameOf) : {};
      const columnChanged = from.columnId !== to.columnId;
      const moved = { ...draggedTask, ...laneChange };
      // Transizioni e condizioni del flusso (lib/taskWorkflow.ts).
      if (columnChanged && !guard.check(moved, to.columnId)) return;

      // Le attività visibili di una cella, in ordine.
      const cell = (lane: string | null, columnId: string) => visibleTasks
        .filter(task => displayColumnId(task, columns) === columnId && (lane === null || laneKey(task, laneMode) === lane))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const sourceTasks = cell(from.lane, from.columnId);
      const sameCell = source.droppableId === destination.droppableId;
      const destTasks = sameCell ? sourceTasks : cell(to.lane, to.columnId);
      sourceTasks.splice(source.index, 1);
      const changes = {
        ...laneChange,
        ...(columnChanged ? { columnId: to.columnId, ...completedAtUpdate(draggedTask, to.columnId, columns) } : {}),
      };
      destTasks.splice(destination.index, 0, { ...draggedTask, ...changes });

      const orders = new Map<string, number>();
      if (!sameCell) sourceTasks.forEach((task, index) => orders.set(task.id, index));
      destTasks.forEach((task, index) => orders.set(task.id, index));
      setTasks(prev => prev.map(task => {
        if (task.id === draggableId) return { ...task, ...changes, order: orders.get(task.id) };
        return orders.has(task.id) ? { ...task, order: orders.get(task.id) } : task;
      }));

      try {
        const rest = [...orders].filter(([id]) => id !== draggableId).map(([id, order]) => ({ id, order }));
        if ('assigneeUid' in laneChange) {
          // Nuovo assegnatario: passa da TaskService.update, che gli manda la notifica.
          await TaskService.update(draggableId, { ...changes, order: orders.get(draggableId) } as any);
          if (rest.length) await TaskService.batchUpdate(rest);
        } else {
          await TaskService.batchUpdate([...rest, { id: draggableId, ...changes, order: orders.get(draggableId) }]);
        }
      } catch (error) {
        console.error('Move failed:', error);
        toast.error(t.tasks.saveError);
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
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setActiveView('board')} 
            aria-label={t.tasks.board}
            title={t.tasks.board}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-2 md:gap-2 md:px-4 md:text-[14px] ${activeView === 'board' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <Layout size={16} className="shrink-0" />
            {!compactViews && <span className="hidden sm:inline whitespace-nowrap">{t.tasks.board}</span>}
          </button>
          <button 
            onClick={() => setActiveView('tasklist')} 
            aria-label={t.tasks.tasklist}
            title={t.tasks.tasklist}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-2 md:gap-2 md:px-4 md:text-[14px] ${activeView === 'tasklist' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <List size={16} className="shrink-0" />
            {!compactViews && <span className="hidden sm:inline whitespace-nowrap">{t.tasks.tasklist}</span>}
          </button>
          <button 
            onClick={() => setActiveView('timeline')} 
            aria-label={t.tasks.timeline}
            title={t.tasks.timeline}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-2 md:gap-2 md:px-4 md:text-[14px] ${activeView === 'timeline' ? 'bg-[#0D6EFD]/50 text-white' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
          >
            <CalendarDays size={16} className="shrink-0" />
            {!compactViews && <span className="hidden sm:inline whitespace-nowrap">{t.tasks.timeline}</span>}
          </button>
        </nav>
        
        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-3">
          {hasTasksWrite && (
            <button 
              onClick={() => openNewTaskModal()} 
              aria-label={t.tasks.newTask} 
              title={t.tasks.newTask} 
              className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#003B80] bg-[#002451] text-xs sm:text-sm font-medium text-[#00A6FF] transition-colors hover:bg-[#003B80]/80 ${compactActions ? 'p-2' : 'p-2 sm:px-4 sm:py-2'}`}
            >
              <PlusCircle size={16} className="shrink-0 text-[#00A6FF]" />
              {!compactActions && <span className="hidden sm:inline whitespace-nowrap">{t.tasks.newTask}</span>}
            </button>
          )}
          {canEditWorkflow && (
            <button 
              onClick={() => setWorkflow({})} 
              aria-label={t.tasks.manageWorkflow} 
              title={t.tasks.manageWorkflow} 
              className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/10 text-xs sm:text-sm font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white ${compactActions ? 'p-2' : 'p-2 sm:px-4 sm:py-2'}`}
            >
              <Settings2 size={16} className="shrink-0" />
              {!compactActions && <span className="hidden sm:inline whitespace-nowrap">{t.tasks.workflowShort}</span>}
            </button>
          )}
        </div>
        </div>
        <div className="mt-3">
          <BoardFilterBar
            filters={filters}
            onFilters={setFilters}
            laneMode={laneMode}
            onLaneMode={setLaneMode}
            showLanes={activeView === 'board'}
            assignees={assignees}
            epics={epics}
            shown={visibleTasks.length}
            total={tasks.length}
          />
        </div>
      </div>
      
      {activeView === 'board' && lanesOn && (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <SwimlaneBoard
            columns={columns}
            lanes={lanes}
            onTaskClick={setSelectedTask}
            onMove={moveTask}
            dropBlockFor={(lane, columnId) => dropBlockFor(columnId, lane)}
            membersMap={membersMap}
          />
        </DragDropContext>
      )}

      {activeView === 'board' && !lanesOn && (
        <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <Droppable droppableId="board" direction="horizontal" type="column">
            {(provided) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex min-h-0 flex-1 items-start gap-3.5 sm:gap-6 md:gap-8 overflow-x-auto overflow-y-hidden pb-3 sm:pb-4 scroll-smooth"
              >
                {columns.map((col, index) => {
                  // Un'attività senza una colonna valida compare nella prima «Da fare».
                  const columnTasks = visibleTasks
                    .filter(t => displayColumnId(t, columns) === col.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                    
                  return (
                    <TaskColumn 
                      key={col.id} 
                      column={col} 
                      columns={columns}
                      tasks={columnTasks} 
                      index={index} 
                      hasTasksWrite={hasTasksWrite}
                      canEditWorkflow={canEditWorkflow}
                      dropBlock={dropBlockFor(col.id)}
                      onTaskClick={setSelectedTask}
                      onColumnTitleChange={handleColumnTitleChange}
                      onColumnTitleBlur={handleColumnTitleBlur}
                      onColumnAction={columnAction}
                      onCategory={changeColumnCategory}
                      onColor={changeColumnColor}
                      onNewTask={openNewTaskModal}
                      onMove={moveTask}
                      membersMap={membersMap}
                    />
                  );
                })}
                {provided.placeholder}
                {canEditWorkflow && <AddColumnCard onAdd={addColumn} />}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {activeView !== 'board' && tasks.length > 0 && visibleTasks.length === 0 && (
        <p className="py-8 text-center text-sm text-[#858585]">{t.tasks.noFilteredTasks}</p>
      )}

      {activeView === 'tasklist' && (
        <div className="flex-1 overflow-y-auto">
          <TaskList tasks={visibleTasks} columns={columns} onTaskClick={setSelectedTask} onToggleDone={toggleTaskDone} onMove={moveTask} membersMap={membersMap} />
        </div>
      )}

      {activeView === 'timeline' && (
        <div className="flex-1 overflow-y-auto">
          <TaskTimeline 
            tasks={visibleTasks} 
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
          initialTab={workflow.tab}
          initialRulesId={workflow.rulesId}
          onClose={() => setWorkflow(null)}
        />
      )}

      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} columns={columns} epics={epics} />
    </div>
  );
}
