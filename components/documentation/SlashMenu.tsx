import React, { useEffect, useRef, useState } from 'react';
import { Type, Heading1, Heading2, List, CheckSquare, Calendar, Users, Sparkles, FileText } from 'lucide-react';

interface SlashMenuProps {
  onSelect: (type: string) => void;
  onClose: () => void;
  position: { top: number; bottom: number; left: number };
}

export function SlashMenu({ onSelect, onClose, position }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    // Calculate if it should open upwards
    const maxMenuHeight = 180;
    const isUpwards = position.bottom + maxMenuHeight > window.innerHeight;
    
    if (isUpwards) {
      // Open upwards (place bottom of menu just above the cursor's top)
      setStyle({
        bottom: window.innerHeight - position.top + 4,
        left: position.left
      });
    } else {
      // Open downwards (place top of menu just below the cursor's bottom)
      setStyle({
        top: position.bottom + 4,
        left: position.left
      });
    }
  }, [position]);

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
    { type: 'p', label: 'Paragrafo', icon: Type, desc: 'Testo normale' },
    { type: 'h2', label: 'Titolo 1', icon: Heading1, desc: 'Titolo principale della sezione' },
    { type: 'h3', label: 'Titolo 2', icon: Heading2, desc: 'Sottotitolo' },
  ];
  
  const advanced = [
    { type: 'ai', label: 'Genera con AI', icon: Sparkles },
    { type: 'list', label: 'Elenco puntato', icon: List },
    { type: 'task', label: 'Attività', icon: CheckSquare },
    { type: 'event', label: 'Evento', icon: Calendar },
    { type: 'meeting', label: 'Meeting', icon: Users },
    { type: 'document', label: 'Documento', icon: FileText },
  ];

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 w-64 bg-[#111] border border-white/10 rounded-xl shadow-2xl overflow-y-auto max-h-[180px] py-2 custom-scrollbar"
      style={style}
    >
      <div className="px-3 pb-2 text-xs font-medium text-[#858585] border-b border-white/5 mb-1">
        Blocchi di base
      </div>
      {options.map(opt => (
        <button
          key={opt.type}
          onClick={() => onSelect(opt.type)}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#006AFF]/10 hover:text-[#00A6FF] transition-colors text-left group"
        >
          <div className="p-2 bg-white/5 rounded-lg text-[#858585] group-hover:text-[#00A6FF] group-hover:bg-[#006AFF]/20 transition-colors">
            <opt.icon size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white/90 group-hover:text-[#00A6FF]">{opt.label}</span>
            <span className="text-xs text-[#858585] group-hover:text-[#00A6FF]/70">{opt.desc}</span>
          </div>
        </button>
      ))}
      
      <div className="px-3 pt-3 pb-2 text-xs font-medium text-[#858585] border-b border-white/5 border-t mt-1 mb-1">
        Avanzati
      </div>
      
      {advanced.map(opt => (
        <button 
          key={opt.type}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left group" 
          onClick={() => onSelect(opt.type)}
        >
          <div className="p-2 bg-white/5 rounded-lg text-[#858585] group-hover:text-white transition-colors">
             <opt.icon size={16} />
          </div>
          <span className="text-sm font-medium text-white/90 group-hover:text-white">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
