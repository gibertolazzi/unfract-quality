const fs = require('fs');

const content = `
"use client";

import React, { useState } from 'react';
import { Calendar, PlusCircle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskModal } from './unfract/TaskModal';

const initialColumns = [
  { id: 'col-1', title: 'To Do' },
  { id: 'col-2', title: 'In Progress' },
  { id: 'col-3', title: 'Done' },
  { id: 'col-4', title: 'To Be Tested' },
];

const initialTasks = [
  {
    id: '1',
    title: 'Market Analysis',
    columnId: 'col-1',
    date: 'Tomorrow, 23 July',
    priority: 'Medium',
    category: 'Sales',
    categoryColor: 'bg-[#FFEE00]',
    assignees: 4,
    blobColors: ['bg-yellow-500/40', 'bg-blue-600/30']
  },
  {
    id: '2',
    title: 'UI Layouts',
    columnId: 'col-1',
    date: 'Friday, 14 August',
    priority: 'Low',
    category: 'Design',
    categoryColor: 'bg-[#00A6FF]',
    assignees: 4,
    blobColors: ['bg-blue-600/40', 'bg-transparent']
  },
  {
    id: '3',
    title: 'Fix Compliance Issues',
    columnId: 'col-2',
    date: 'Today, 22 July',
    priority: 'High',
    category: 'Legal',
    categoryColor: 'bg-[#FF0004]',
    assignees: 4,
    blobColors: ['bg-red-600/40', 'bg-transparent']
  },
  {
    id: '4',
    title: 'UI Wireframing',
    columnId: 'col-2',
    date: 'Friday, 14 August',
    priority: 'Low',
    category: 'Design',
    categoryColor: 'bg-[#00A6FF]',
    assignees: 4,
    blobColors: ['bg-blue-600/40', 'bg-transparent']
  }
];

const priorityStyles = {
  High: 'text-[#FF2200] border-[#FF2200]',
  Medium: 'text-[#FFAE00] border-[#FFAE00]',
  Low: 'text-[#006AFF] border-[#006AFF]'
};

export function TaskCard({ task, index, onClick }: { task: any; index: number; onClick: () => void }) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={\`relative overflow-hidden flex flex-col gap-5 p-6 bg-black border rounded-3xl w-full group transition-all \${snapshot.isDragging ? 'border-white/20 shadow-xl scale-[1.02]' : 'border-white/5 hover:border-white/10'}\`}
        >
          {/* Animated Blobs */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl">
            <div className="absolute top-[-20px] left-[-20px] w-40 h-40 opacity-40 blur-[50px] animate-blob">
              <div className={\`w-full h-full rounded-full \${task.blobColors[0]}\`} />
            </div>
            {task.blobColors[1] !== 'bg-transparent' && (
              <div className="absolute top-[20px] right-[-20px] w-32 h-32 opacity-30 blur-[40px] animate-blob" style={{animationDelay: '2s'}}>
                <div className={\`w-full h-full rounded-full \${task.blobColors[1]}\`} />
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/50">
                <Calendar size={16} />
                <span className="text-[13px] font-sans font-medium">{task.date}</span>
              </div>
              <div className={\`px-3 py-1 text-xs rounded-full border \${priorityStyles[task.priority as keyof typeof priorityStyles] || 'text-white/60 border-white/20'}\`}>
                {task.priority}
              </div>
            </div>
            <h3 className="text-[22px] text-white font-halfre tracking-wide">{task.title}</h3>
          </div>
          
          <div className="relative z-10 flex items-center justify-between mt-2">
            <div className="flex items-center -space-x-2">
              <div className="w-8 h-8 rounded-full border border-black bg-orange-400 overflow-hidden">
                 <img src="https://i.pravatar.cc/100?img=11" alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="w-8 h-8 rounded-full border border-black bg-blue-400 overflow-hidden">
                 <img src="https://i.pravatar.cc/100?img=12" alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="w-8 h-8 rounded-full border border-black bg-white/20 flex items-center justify-center text-white text-[10px] font-medium backdrop-blur-md">
                +{task.assignees}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="px-4 py-1.5 rounded-full bg-white/10 text-white/60 text-xs font-sans">
                {task.category}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}

export function TaskColumn({ column, tasks, index, onTaskClick, onColumnTitleChange }: { column: any; tasks: any[]; index: number; onTaskClick: (task: any) => void; onColumnTitleChange: (id: string, newTitle: string) => void }) {
  return (
    <Draggable draggableId={column.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={\`flex flex-col gap-6 w-full min-w-[340px] max-w-[380px] \${snapshot.isDragging ? 'opacity-80' : ''}\`}
        >
          <div className="flex items-center justify-between px-2" {...provided.dragHandleProps}>
            <input 
              value={column.title}
              onChange={(e) => onColumnTitleChange(column.id, e.target.value)}
              className="text-xl font-bold text-white font-sans bg-transparent outline-none focus:border-b focus:border-white/20 w-full mr-4"
            />
            {index === 0 && (
              <button className="flex items-center gap-2 text-white/40 hover:text-white transition-colors shrink-0">
                <PlusCircle size={16} />
                <span className="text-sm font-medium">Nuova task</span>
              </button>
            )}
          </div>
          
          <Droppable droppableId={column.id} type="task">
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={\`flex flex-col gap-4 p-5 bg-[#0C0C0C] border rounded-[32px] min-h-[500px] transition-colors \${snapshot.isDraggingOver ? 'border-white/10 bg-[#111]' : 'border-white/5'}\`}
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
  const [columns, setColumns] = useState(initialColumns);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "column") {
      const newColumns = Array.from(columns);
      const [removed] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, removed);
      setColumns(newColumns);
      return;
    }

    if (type === "task") {
      const sourceColId = source.droppableId;
      const destColId = destination.droppableId;

      const sourceTasks = tasks.filter(t => t.columnId === sourceColId);
      const destTasks = sourceColId === destColId ? sourceTasks : tasks.filter(t => t.columnId === destColId);
      
      const draggedTask = tasks.find(t => t.id === draggableId);
      if (!draggedTask) return;

      const newTasks = [...tasks];
      
      if (sourceColId === destColId) {
        // Reordering in same column
        const colTasks = [...sourceTasks];
        colTasks.splice(source.index, 1);
        colTasks.splice(destination.index, 0, draggedTask);
        
        // Update main tasks array by completely replacing tasks in this col
        const withoutColTasks = newTasks.filter(t => t.columnId !== sourceColId);
        setTasks([...withoutColTasks, ...colTasks]);
      } else {
        // Moving to a different column
        draggedTask.columnId = destColId;
        const sTasks = [...sourceTasks];
        sTasks.splice(source.index, 1);
        
        const dTasks = [...destTasks];
        dTasks.splice(destination.index, 0, draggedTask);
        
        const withoutSourceAndDest = newTasks.filter(t => t.columnId !== sourceColId && t.columnId !== destColId);
        setTasks([...withoutSourceAndDest, ...sTasks, ...dTasks]);
      }
    }
  };

  const handleColumnTitleChange = (id: string, newTitle: string) => {
    setColumns(columns.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  return (
    <div className="flex flex-col h-full font-sans">
      <div className="flex items-center gap-8 mb-8 mt-2">
        <button className="flex items-center gap-2 text-[#006AFF] font-semibold text-lg border-b-2 border-[#006AFF] pb-1">
          Board
        </button>
        <button className="flex items-center gap-2 text-white/50 hover:text-white font-semibold text-lg pb-1 transition-colors">
          Timeline
        </button>
      </div>
      
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="column">
          {(provided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex items-start gap-8 overflow-x-auto pb-8 h-full"
            >
              {columns.map((col, index) => {
                const columnTasks = tasks.filter(t => t.columnId === col.id);
                return (
                  <TaskColumn 
                    key={col.id} 
                    column={col} 
                    tasks={columnTasks} 
                    index={index} 
                    onTaskClick={setSelectedTask}
                    onColumnTitleChange={handleColumnTitleChange}
                  />
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
`;

fs.writeFileSync('/Users/giacomobertolazzi/unfractmvp/components/TaskBoard.tsx', content);
