import React, { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Project } from '@/contexts/ProjectContext';

export function DeleteProjectModal({ 
  project, 
  onConfirm, 
  onClose
}: { 
  project: Project; 
  onConfirm: () => void; 
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const isValid = value === project.name;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-md bg-[#0A0A0A] border border-red-500/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-red-500/5">
          <h3 className="text-sm font-semibold text-red-500">Elimina Progetto</h3>
          <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Questa azione è <strong className="text-white">irreversibile</strong>. Eliminerà permanentemente il progetto <strong className="text-white">{project.name}</strong>.
          </p>
          <p className="text-xs text-[#858585]">
            Per confermare, digita il nome del progetto di seguito:
          </p>
          
          <input 
            type="text" 
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValid) {
                onConfirm();
              }
            }}
            placeholder={project.name}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500 transition-colors"
          />
        </div>
        
        <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium transition-colors">
            Annulla
          </button>
          <button 
            onClick={() => {
              if (isValid) onConfirm();
            }}
            disabled={!isValid}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-full text-sm font-medium transition-colors"
          >
            <Trash2 size={16} />
            Elimina progetto
          </button>
        </div>
      </div>
    </div>
  );
}
