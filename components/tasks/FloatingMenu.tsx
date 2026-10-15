'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Menu agganciato a un pulsante, disegnato sopra tutto (le schede della
 * bacheca tagliano quello che esce dai bordi). Si chiude cliccando fuori,
 * con Esc o scorrendo la pagina.
 */
export function FloatingMenu({ anchor, onClose, children, width = 240 }: {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const height = ref.current?.offsetHeight || 0;
    const below = rect.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setPosition({ top, left });
  }, [anchor, width]);

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !anchor?.contains(target)) onClose();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const onScroll = (event: Event) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  if (typeof document === 'undefined' || !anchor) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      onClick={e => e.stopPropagation()}
      style={{ top: position?.top ?? -9999, left: position?.left ?? -9999, width }}
      className="fixed z-[120] max-h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-[#111] p-1 shadow-2xl"
    >
      {children}
    </div>,
    document.body,
  );
}

export function MenuItem({ children, onClick, disabled, danger, title }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white/85 hover:bg-white/5'}`}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-[#858585]">{children}</div>;
}
