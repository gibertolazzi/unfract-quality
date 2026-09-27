import { useState, useEffect, useRef } from 'react';

export interface DragPhysicsState {
  isDragging: boolean;
  item: any | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tiltX: number;
  tiltY: number;
  hoveredZone: string | null;
}

export function useDragPhysics(zones: { id: string; rect: () => DOMRect | null }[]) {
  const [state, setState] = useState<DragPhysicsState>({
    isDragging: false,
    item: null,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tiltX: 0,
    tiltY: 0,
    hoveredZone: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const lastPos = useRef({ x: 0, y: 0, time: 0 });

  const startDrag = (e: React.PointerEvent, item: any) => {
    if ((e.target as HTMLElement).closest('button, a, input, [role="button"]')) return;
    e.preventDefault();
    
    lastPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    
    setState({
      isDragging: true,
      item,
      x: e.clientX,
      y: e.clientY,
      vx: 0,
      vy: 0,
      tiltX: 0,
      tiltY: 0,
      hoveredZone: null,
    });
  };

  useEffect(() => {
    if (!state.isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const now = Date.now();
      const dt = now - lastPos.current.time || 16;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      
      const vx = dx / dt;
      const vy = dy / dt;

      lastPos.current = { x: e.clientX, y: e.clientY, time: now };

      // Calcola il tilt (fino a 20 gradi) in base alla velocità
      const maxTilt = 20;
      // Il tiltY (rotazione su asse Y) è basato sulla velocità orizzontale
      let tiltY = (vx * 10);
      if (tiltY > maxTilt) tiltY = maxTilt;
      if (tiltY < -maxTilt) tiltY = -maxTilt;
      
      // Il tiltX (rotazione su asse X) è basato sulla velocità verticale invertita
      let tiltX = -(vy * 10);
      if (tiltX > maxTilt) tiltX = maxTilt;
      if (tiltX < -maxTilt) tiltX = -maxTilt;

      // Hit testing per le zone
      let hoveredZone: string | null = null;
      for (const zone of zones) {
        const rect = zone.rect();
        if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          hoveredZone = zone.id;
          break;
        }
      }

      setState(s => ({
        ...s,
        x: e.clientX,
        y: e.clientY,
        vx,
        vy,
        tiltX,
        tiltY,
        hoveredZone,
      }));
    };

    const handleUp = () => {
      setState(s => ({ ...s, isDragging: false }));
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [state.isDragging, zones]);

  return { state, startDrag };
}
