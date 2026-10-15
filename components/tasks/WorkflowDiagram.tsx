'use client';

import React from 'react';
import { canTransition, columnCategory, sortColumns, type ColumnCategory, type WorkflowColumn } from '@/lib/taskWorkflow';

/**
 * Schema del flusso, come quello di Jira: le colonne in fila, una freccia
 * per ogni passaggio permesso (in avanti sopra, all'indietro sotto). Una
 * colonna raggiungibile da tutte le altre ha l'etichetta «da tutte» invece
 * delle frecce, altrimenti con il flusso libero lo schema sarebbe un groviglio.
 */

const NODE_W = 120;
const NODE_H = 36;
const GAP = 44;
const STROKE: Record<ColumnCategory, string> = { todo: '#858585', progress: '#FFB800', done: '#10B981' };

interface WorkflowDiagramProps {
  columns: (WorkflowColumn & { title: string })[];
  fromAnyLabel: string;
}

export function WorkflowDiagram({ columns, fromAnyLabel }: WorkflowDiagramProps) {
  const sorted = sortColumns(columns);
  const n = sorted.length;
  if (n === 0) return null;

  const fromAll = new Set(
    sorted
      .filter(target => n > 2 && sorted.every(from => from.id === target.id || canTransition(columns, from.id, target.id)))
      .map(c => c.id),
  );
  const arcs: { from: number; to: number }[] = [];
  sorted.forEach((from, i) => sorted.forEach((to, j) => {
    if (i !== j && !fromAll.has(to.id) && canTransition(columns, from.id, to.id)) arcs.push({ from: i, to: j });
  }));

  const maxSpan = arcs.reduce((m, a) => Math.max(m, Math.abs(a.to - a.from)), 1);
  const lift = (span: number) => 16 + 14 * span;
  const top = Math.max(lift(maxSpan), fromAll.size ? 30 : 0) + 8;
  const bottom = lift(maxSpan) + 8;
  const width = n * NODE_W + (n - 1) * GAP + 16;
  const height = top + NODE_H + bottom;
  const x = (i: number) => 8 + i * (NODE_W + GAP);
  const cx = (i: number) => x(i) + NODE_W / 2;
  // «da tutte» a sinistra: a destra partono le frecce in uscita.
  const pill = (i: number) => x(i) + 30;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-2">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" className="block">
        <defs>
          <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#4D9BFF" />
          </marker>
          <marker id="wf-arrow-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#858585" />
          </marker>
        </defs>

        {arcs.map(({ from, to }) => {
          const forward = to > from;
          // Si esce dal lato verso cui si va e si entra dall'altro: frecce in
          // entrata e in uscita dalla stessa colonna non si toccano.
          const x1 = cx(from) + (forward ? 14 : -14);
          const x2 = cx(to) + (forward ? -14 : 14);
          const y = forward ? top : top + NODE_H;
          const h = lift(Math.abs(to - from));
          const cy = forward ? y - h : y + h;
          return (
            <path
              key={`${from}-${to}`}
              d={`M ${x1} ${y} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y}`}
              fill="none"
              stroke={forward ? '#4D9BFF' : '#858585'}
              strokeOpacity={0.7}
              strokeWidth={1.5}
              markerEnd={`url(#${forward ? 'wf-arrow' : 'wf-arrow-back'})`}
            />
          );
        })}

        {sorted.map((column, i) => (
          <g key={column.id}>
            {fromAll.has(column.id) && (
              <g>
                <rect x={pill(i) - 34} y={top - 30} width={68} height={18} rx={9} fill="#002451" stroke="#003B80" />
                <text x={pill(i)} y={top - 17} textAnchor="middle" fontSize="10" fill="#4D9BFF">{fromAnyLabel}</text>
                <line x1={pill(i)} y1={top - 12} x2={pill(i)} y2={top - 1} stroke="#4D9BFF" strokeWidth={1.5} markerEnd="url(#wf-arrow)" />
              </g>
            )}
            <rect x={x(i)} y={top} width={NODE_W} height={NODE_H} rx={10} fill="#111" stroke={STROKE[columnCategory(column)]} strokeWidth={1.5} />
            <text x={cx(i)} y={top + NODE_H / 2 + 4} textAnchor="middle" fontSize="12" fill="#fff">
              {column.title.length > 16 ? `${column.title.slice(0, 15)}…` : column.title}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
