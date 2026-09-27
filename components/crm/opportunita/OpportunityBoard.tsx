'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { CrmOpportunity } from '@/components/crm/types';
import {
  OpportunityPhase, OPPORTUNITY_PHASES, OPPORTUNITY_PHASE_LABELS, OPPORTUNITY_PHASE_COLORS,
  OPPORTUNITY_TRANSITIONS, canTransition,
} from '@/components/crm/constants';
import { PhaseSummary } from '@/lib/crm/opportunityFilters';
import { formatEuro } from '../shared/TableUtils';
import { OpportunityCard } from './OpportunityCard';

interface OpportunityBoardProps {
  columns: PhaseSummary[];
  counterpartyName: (opportunity: CrmOpportunity) => string;
  ownerName: (uid: string) => string;
  onOpen: (opportunity: CrmOpportunity) => void;
  /** Spostamento fra fasi: la transizione è già stata verificata qui. */
  onMove: (opportunity: CrmOpportunity, to: OpportunityPhase, index: number) => void;
  /** Riordino dentro la stessa fase. */
  onReorder: (phase: OpportunityPhase, orderedIds: string[]) => void;
  /** Rilascio su una colonna che la macchina a stati non ammette. */
  onRefused: (from: OpportunityPhase, to: OpportunityPhase) => void;
}

/**
 * Pipeline come lavagna.
 *
 * La macchina a stati è applicata al RILASCIO, non durante il trascinamento, e
 * non per comodità: in @hello-pangea/dnd qualunque ri-render fra `onDragStart`
 * e il rilascio fa abortire il movimento. Provato — spegnere le colonne non
 * ammesse (con `isDropDisabled` o anche solo cambiando una classe da uno stato
 * React) riporta la scheda al punto di partenza e il gesto si perde.
 *
 * Perciò le colonne ammesse sono indicate in modo statico nell'intestazione, e
 * un rilascio su una colonna non ammessa viene rifiutato spiegando il perché.
 */
export function OpportunityBoard({
  columns, counterpartyName, ownerName, onOpen, onMove, onReorder, onRefused,
}: OpportunityBoardProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  const handleDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const from = source.droppableId as OpportunityPhase;
    const to = destination.droppableId as OpportunityPhase;
    const column = columns.find(c => c.phase === from);
    const opportunity = column?.items.find(item => item.id === draggableId);
    if (!opportunity) return;

    if (from === to) {
      if (source.index === destination.index) return;
      const ids = column!.items.map(item => item.id);
      const [moved] = ids.splice(source.index, 1);
      ids.splice(destination.index, 0, moved);
      onReorder(from, ids);
      return;
    }

    if (!canTransition(OPPORTUNITY_TRANSITIONS, from, to)) {
      onRefused(from, to);
      return;
    }
    onMove(opportunity, to, destination.index);
  };

  if (!isMounted) return null;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map(column => {
          // Da dove si può arrivare in questa fase: scritto una volta, non
          // ricalcolato durante il trascinamento.
          const from = OPPORTUNITY_PHASES.filter(
            phase => phase !== column.phase && canTransition(OPPORTUNITY_TRANSITIONS, phase, column.phase)
          );

          return (
            <div
              key={column.phase}
              className="flex w-[260px] shrink-0 flex-col gap-3 rounded-2xl border border-[#1A1A1A] bg-black/20 p-3"
            >
              <header className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-white">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: OPPORTUNITY_PHASE_COLORS[column.phase] }}
                    />
                    {OPPORTUNITY_PHASE_LABELS[column.phase]}
                  </span>
                  <span className="text-[11px] font-medium text-[#C4C4C4]">
                    {formatEuro(column.value)} ({column.count})
                  </span>
                </div>
                <span
                  className="text-[10px] text-[#3F3F3F]"
                  title="Le sole fasi da cui la macchina a stati ammette il passaggio"
                >
                  {from.length > 0
                    ? `da ${from.map(phase => OPPORTUNITY_PHASE_LABELS[phase]).join(', ')}`
                    : 'fase iniziale'}
                </span>
              </header>

              <Droppable droppableId={column.phase}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex min-h-[80px] flex-col gap-2 rounded-xl transition-colors ${
                      snapshot.isDraggingOver ? 'bg-white/[0.03]' : ''
                    }`}
                  >
                    {column.items.map((opportunity, index) => (
                      <Draggable
                        key={opportunity.id}
                        draggableId={opportunity.id}
                        index={index}
                        isDragDisabled={opportunity.archived}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                          >
                            <OpportunityCard
                              opportunity={opportunity}
                              counterpartyName={counterpartyName(opportunity)}
                              ownerName={ownerName(opportunity.ownerUid)}
                              dragging={dragSnapshot.isDragging}
                              onOpen={() => onOpen(opportunity)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {column.items.length === 0 && (
                      <p className="px-1 py-4 text-center text-[11px] text-[#3F3F3F]">Nessuna opportunità</p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
