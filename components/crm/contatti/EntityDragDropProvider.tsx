'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, Target, Building2, Handshake } from 'lucide-react';

interface DragState {
  isDragging: boolean;
  type: 'lead' | 'account' | 'contact' | 'customer';
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tiltX: number;
  tiltY: number;
  hoveredZone: string | null;
  startX: number;
  startY: number;
}

const ICONS = {
  lead: Target,
  account: Building2,
  contact: Users,
  customer: Handshake,
};

const LABELS = {
  lead: 'Lead',
  account: 'Azienda',
  contact: 'Contatto',
  customer: 'Cliente',
};

// Quali tipi possono essere droppati su quali tab?
const ALLOWED_DROPS: Record<string, string[]> = {
  lead: ['tab-contact', 'tab-customer'],
  contact: ['tab-lead', 'tab-customer'],
  account: ['tab-customer'],
  customer: ['tab-lead', 'tab-contact'],
};

export function EntityDragDropProvider({ onDrop }: { onDrop: (id: string, type: string, targetTab: string) => void }) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const lastPos = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // Ignora click su bottoni o link (se ci sono nella riga)
      if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) return;

      const draggable = (e.target as HTMLElement).closest('[data-drag-id]') as HTMLElement;
      if (!draggable) return;

      e.preventDefault();

      const type = draggable.getAttribute('data-drag-type') as any;
      const id = draggable.getAttribute('data-drag-id') as string;
      const name = draggable.getAttribute('data-drag-name') || LABELS[type as keyof typeof LABELS];

      lastPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };

      setDrag({
        isDragging: true,
        type,
        id,
        name,
        x: e.clientX,
        y: e.clientY,
        vx: 0,
        vy: 0,
        tiltX: 0,
        tiltY: 0,
        hoveredZone: null,
        startX: e.clientX,
        startY: e.clientY,
      });
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current?.isDragging) return;

      const now = Date.now();
      const dt = now - lastPos.current.time || 16;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      
      // Smoothing per le velocità per evitare tremolii
      const vx = (dx / dt) * 0.5 + (dragRef.current.vx * 0.5);
      const vy = (dy / dt) * 0.5 + (dragRef.current.vy * 0.5);

      lastPos.current = { x: e.clientX, y: e.clientY, time: now };

      const maxTilt = 25;
      let tiltY = vx * 12;
      let tiltX = -(vy * 12);

      if (tiltY > maxTilt) tiltY = maxTilt;
      if (tiltY < -maxTilt) tiltY = -maxTilt;
      if (tiltX > maxTilt) tiltX = maxTilt;
      if (tiltX < -maxTilt) tiltX = -maxTilt;

      // Hit test per drop zone usando document.elementsFromPoint
      // L'overlay deve avere pointer-events: none!
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const zoneElement = elements.find(el => el.hasAttribute('data-drop-zone'));
      let hoveredZone = zoneElement ? zoneElement.getAttribute('data-drop-zone') : null;

      // Verifica se il drop è permesso
      if (hoveredZone) {
        const allowed = ALLOWED_DROPS[dragRef.current.type];
        if (!allowed || !allowed.includes(hoveredZone)) {
          hoveredZone = null;
        }
      }

      // Evidenziazione globale della drop zone
      document.querySelectorAll('[data-drop-zone]').forEach(el => {
        if (el.getAttribute('data-drop-zone') === hoveredZone) {
          el.classList.add('bg-white/20', 'ring-2', 'ring-white/50');
        } else {
          el.classList.remove('bg-white/20', 'ring-2', 'ring-white/50');
        }
      });

      setDrag(s => s ? { ...s, x: e.clientX, y: e.clientY, vx, vy, tiltX, tiltY, hoveredZone } : null);
    };

    const handlePointerUp = () => {
      if (dragRef.current?.isDragging) {
        // Pulisci stili
        document.querySelectorAll('[data-drop-zone]').forEach(el => {
          el.classList.remove('bg-white/20', 'ring-2', 'ring-white/50');
        });

        // Trigger onDrop se c'è una zona
        if (dragRef.current.hoveredZone) {
          onDrop(dragRef.current.id, dragRef.current.type, dragRef.current.hoveredZone);
        }
      }
      setDrag(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [onDrop]);

  if (!drag?.isDragging || typeof window === 'undefined') return null;

  const Icon = ICONS[drag.type];

  // Distanza calcolata per capire se siamo in vero drag o solo un piccolo movimento
  const dist = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
  if (dist < 5) return null; // threshold

  const overlay = (
    <div
      className="fixed top-0 left-0 z-[9999] pointer-events-none"
      style={{
        transform: `translate3d(${drag.x + 15}px, ${drag.y + 15}px, 0)`,
        perspective: '1000px',
      }}
    >
      <div
        className="flex items-center gap-3 rounded-xl border border-white/20 bg-[#1A1A1A] px-4 py-3 shadow-2xl transition-transform duration-75"
        style={{
          transform: `rotateX(${drag.tiltX}deg) rotateY(${drag.tiltY}deg) scale(1.05)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white shadow-inner">
          <Icon size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-white truncate max-w-[200px]">
            {drag.name}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#858585]">
            Trascina in una nuova sezione
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
