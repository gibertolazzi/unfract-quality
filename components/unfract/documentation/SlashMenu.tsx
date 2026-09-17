import React, { useEffect, useRef } from 'react';
import { Type, Heading1, Heading2, List, CheckSquare, Image as ImageIcon, Link } from 'lucide-react';
import { DocBlock } from './types';

interface SlashMenuProps {
  onSelect: (type: DocBlock['type']) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function SlashMenu({ onSelect, onClose, position }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const options = [
    { type: 'p' as const, label: 'Paragrafo', icon: Type, desc: 'Testo normale' },
    { type: 'h2' as const, label: 'Titolo 1', icon: Heading1, desc: 'Titolo principale della sezione' },
    { type: 'h3' as const, label: 'Titolo 2', icon: Heading2, desc: 'Sottotitolo' },
  ];

  return (
    <div 
      ref={menuRef}
      className="absolute z-50 w-64 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-2"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 pb-2 text-xs font-medium text-[#858585] border-b border-white/5 mb-1">
        Blocchi di base
      </div>
      {options.map(opt => (
        <button
          key={opt.type}
          onClick={() => onSelect(opt.type)}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#006AFF]/10 hover:text-[#00A6FF] transition-colors text-left"
        >
          <div className="p-2 bg-white/5 rounded-lg text-[#858585] group-hover:text-[#00A6FF] group-hover:bg-[#006AFF]/20 transition-colors">
            <opt.icon size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white/90">{opt.label}</span>
            <span className="text-xs text-[#858585]">{opt.desc}</span>
          </div>
        </button>
      ))}
      
      <div className="px-3 pt-3 pb-2 text-xs font-medium text-[#858585] border-b border-white/5 border-t mt-1 mb-1">
        Avanzati
      </div>
      
      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left" onClick={onClose}>
        <div className="p-2 bg-white/5 rounded-lg text-[#858585]"><List size={16} /></div>
        <span className="text-sm font-medium text-white/90">Elenco puntato</span>
      </button>
      
      <button className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left" onClick={onClose}>
        <div className="p-2 bg-white/5 rounded-lg text-[#858585]"><CheckSquare size={16} /></div>
        <span className="text-sm font-medium text-white/90">Attività</span>
      </button>
      
    </div>
  );
}
