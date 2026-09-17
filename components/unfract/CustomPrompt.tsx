import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';

export function CustomPrompt({ 
  title, 
  placeholder, 
  onConfirm, 
  onClose,
  colors
}: { 
  title: string; 
  placeholder: string; 
  onConfirm: (val: string, color?: string) => void; 
  onClose: () => void;
  colors?: string[];
}) {
  const [value, setValue] = useState('');
  const [selectedColor, setSelectedColor] = useState(colors ? colors[0] : undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
          <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <input 
            type="text" 
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                onConfirm(value.trim(), selectedColor);
              }
            }}
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#006AFF] transition-colors"
          />

          {colors && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-[#858585]">Colore:</span>
              <div className="flex gap-2">
                {colors.map(color => (
                  <button 
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform ${selectedColor === color ? 'scale-125 ring-2 ring-white/50' : 'hover:scale-110'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium transition-colors">
            Annulla
          </button>
          <button 
            onClick={() => {
              if (value.trim()) onConfirm(value.trim(), selectedColor);
            }}
            disabled={!value.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#006AFF] hover:bg-blue-600 disabled:opacity-50 text-white rounded-full text-sm font-medium transition-colors"
          >
            <CheckCircle2 size={16} />
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
