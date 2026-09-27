const fs = require('fs');
const path = '/Users/giacomobertolazzi/unfractmvp/components/unfract/crm/opportunita/OpportunityBoard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Import useState and useEffect
if (!content.includes('useState') && !content.includes('useEffect')) {
  content = content.replace(
    "import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';",
    "import React, { useState, useEffect } from 'react';\nimport { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';"
  );
}

// Add isMounted check
const functionStart = `export function OpportunityBoard({
  columns, counterpartyName, ownerName, onOpen, onMove, onReorder, onRefused,
}: OpportunityBoardProps) {`;

const newStart = `export function OpportunityBoard({
  columns, counterpartyName, ownerName, onOpen, onMove, onReorder, onRefused,
}: OpportunityBoardProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);`;

content = content.replace(functionStart, newStart);

const returnStart = `  return (
    <DragDropContext onDragEnd={handleDragEnd}>`;

const newReturn = `  if (!isMounted) return null;\n\n  return (
    <DragDropContext onDragEnd={handleDragEnd}>`;

content = content.replace(returnStart, newReturn);

fs.writeFileSync(path, content, 'utf8');
