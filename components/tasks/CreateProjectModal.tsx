import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Folder, Users } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, organizationIds?: string[]) => void;
}

export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const { organizations } = useOrganization();
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), selectedOrgIds.length > 0 ? selectedOrgIds : undefined);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
          <h2 className="text-lg font-semibold text-white/90">Nuovo Progetto</h2>
          <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-white/70 flex items-center gap-2">
              <Folder size={14} className="text-[#006AFF]" /> Nome del Progetto
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="es. Direzio MVP"
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#006AFF] transition-colors"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-white/70 flex items-center gap-2">
              <Users size={14} className="text-[#006AFF]" /> Organizzazione
            </label>
            <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-white/5 border border-white/10 rounded-xl">
              {organizations.length === 0 ? (
                <div className="flex items-center justify-center py-4 px-2 text-center">
                  <span className="text-[#858585] text-xs">Nessuna organizzazione collegata.</span>
                </div>
              ) : (
                organizations.map(org => (
                  <label key={org.id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="accent-[#006AFF] w-4 h-4 rounded"
                      checked={selectedOrgIds.includes(org.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrgIds([...selectedOrgIds, org.id]);
                        } else {
                          setSelectedOrgIds(selectedOrgIds.filter(id => id !== org.id));
                        }
                      }}
                    />
                    <span className="text-sm text-white/90">{org.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium transition-colors">
              Annulla
            </button>
            <button 
              type="submit" 
              disabled={!name.trim()}
              className="px-5 py-2.5 bg-[#006AFF] hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-[#006AFF] text-white rounded-full text-sm font-medium transition-colors"
            >
              Crea Progetto
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
