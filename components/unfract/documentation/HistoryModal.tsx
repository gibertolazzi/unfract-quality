import React from 'react';
import { X, Clock, User } from 'lucide-react';
import { DocHistory } from './types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: DocHistory[];
}

export function HistoryModal({ isOpen, onClose, history }: HistoryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-[32px]">
           <div className="absolute top-[-50px] right-[-50px] w-64 h-64 opacity-10 blur-[80px] rounded-full bg-white" />
        </div>

        <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5">
          <h3 className="text-xl font-medium text-white flex items-center gap-2">
            <Clock size={20} className="text-[#858585]" />
            Cronologia Modifiche
          </h3>
          <button onClick={onClose} className="p-2 text-[#858585] hover:text-white transition-colors hover:bg-white/5 rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="relative z-10 p-6 md:p-8 flex flex-col gap-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-[#858585] text-center py-8">
              Nessuna modifica recente
            </div>
          ) : (
            <div className="relative border-l border-white/10 ml-4 flex flex-col gap-8">
              {history.map((item, idx) => (
                <div key={item.id} className="relative pl-6">
                  {/* Timeline dot */}
                  <div className="absolute left-[-5px] top-1 w-[9px] h-[9px] rounded-full bg-[#0E0E0E] border-2 border-[#006AFF]" />
                  
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                        <User size={10} className="text-white/70" />
                      </div>
                      <span className="text-[14px] font-medium text-white">{item.author}</span>
                      <span className="text-[12px] text-[#858585] ml-auto">{item.timestamp}</span>
                    </div>
                    <p className="text-[14px] text-white/70 mt-1">
                      {item.action}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
