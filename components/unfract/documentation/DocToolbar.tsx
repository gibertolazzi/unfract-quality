import React from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link, Image as ImageIcon, Type, Code, Quote, CheckSquare, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

export function DocToolbar({ 
  onPromptRequest, 
  activeBlockType = 'p', 
  onBlockTypeChange 
}: { 
  onPromptRequest: (type: 'link' | 'image') => void,
  activeBlockType?: string,
  onBlockTypeChange?: (type: 'p' | 'h2' | 'h3') => void
}) {
  const preventFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="sticky top-0 z-50 bg-[#0A0A0A] border-b border-white/10 p-2 flex items-center gap-1.5 mb-8 rounded-b-2xl shadow-xl overflow-x-auto custom-scrollbar whitespace-nowrap">
      
      <div className="flex items-center gap-1 bg-[#1A1A1A] rounded-lg px-2 py-1 mr-2">
        <Type size={14} className="text-white/50" />
        <span className="text-sm text-white/80 font-medium px-2 border-r border-white/10">Testo normale</span>
        <select 
          value={activeBlockType}
          onChange={(e) => onBlockTypeChange?.(e.target.value as any)}
          className="bg-transparent text-white/50 text-xs outline-none cursor-pointer"
        >
          <option value="p">Paragrafo</option>
          <option value="h2">Titolo 1</option>
          <option value="h3">Titolo 2</option>
        </select>
      </div>

      <div className="h-6 w-px bg-white/10 mx-1" />

      <button onMouseDown={preventFocus} onClick={() => document.execCommand('bold', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Grassetto">
        <Bold size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => document.execCommand('italic', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Corsivo">
        <Italic size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => document.execCommand('underline', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Sottolineato">
        <Underline size={16} />
      </button>

      <div className="h-6 w-px bg-white/10 mx-1" />

      <button onMouseDown={preventFocus} onClick={() => document.execCommand('justifyLeft', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Allinea a sinistra">
        <AlignLeft size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => document.execCommand('justifyCenter', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Allinea al centro">
        <AlignCenter size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => document.execCommand('justifyRight', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Allinea a destra">
        <AlignRight size={16} />
      </button>

      <div className="h-6 w-px bg-white/10 mx-1" />

      <button onMouseDown={preventFocus} onClick={() => document.execCommand('insertUnorderedList', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Elenco puntato">
        <List size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => document.execCommand('insertOrderedList', false, '')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Elenco numerato">
        <ListOrdered size={16} />
      </button>

      <div className="h-6 w-px bg-white/10 mx-1" />

      <button 
        onMouseDown={preventFocus}
        onClick={() => onPromptRequest('link')}
        className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Inserisci link"
      >
        <Link size={16} />
      </button>
      <button 
        onMouseDown={preventFocus}
        onClick={() => onPromptRequest('image')}
        className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Immagine"
      >
        <ImageIcon size={16} />
      </button>
      <button onMouseDown={preventFocus} onClick={() => document.execCommand('formatBlock', false, 'BLOCKQUOTE')} className="p-1.5 hover:bg-white/10 rounded-md text-white/70 transition-colors" title="Citazione">
        <Quote size={16} />
      </button>
      
    </div>
  );
}
