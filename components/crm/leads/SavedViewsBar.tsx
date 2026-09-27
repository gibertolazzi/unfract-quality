'use client';

import { useState } from 'react';
import { Bookmark, BookmarkPlus, Trash2, Users2 } from 'lucide-react';
import { CrmSavedView } from '@/components/crm/types';

interface SavedViewsBarProps {
  views: CrmSavedView[];
  activeViewId: string | null;
  /** Filtri correnti diversi da quelli della vista attiva. */
  dirty: boolean;
  onApply: (view: CrmSavedView) => void;
  onCreate: (name: string, shared: boolean) => void;
  onUpdate: (view: CrmSavedView) => void;
  onDelete: (view: CrmSavedView) => void;
  currentUid: string;
}

export function SavedViewsBar({
  views, activeViewId, dirty, onApply, onCreate, onUpdate, onDelete, currentUid,
}: SavedViewsBarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const activeView = views.find(v => v.id === activeViewId) || null;

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, shared);
    setName('');
    setShared(false);
    setCreating(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Bookmark size={14} className="text-[#5A5A5A]" />

      {views.length === 0 && !creating && (
        <span className="text-xs text-[#5A5A5A]">Nessuna vista salvata</span>
      )}

      {views.map(view => {
        const isActive = view.id === activeViewId;
        return (
          <div
            key={view.id}
            className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              isActive
                ? 'border-[#2A2A2A] bg-white/10 text-white'
                : 'border-[#1A1A1A] text-[#858585] hover:text-white'
            }`}
          >
            <button type="button" onClick={() => onApply(view)} className="flex items-center gap-1.5">
              {view.shared && <Users2 size={11} className="opacity-60" />}
              {view.name}
            </button>
            {view.ownerUid === currentUid && (
              <button
                type="button"
                onClick={() => onDelete(view)}
                title="Elimina vista"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 size={11} className="text-[#5A5A5A] hover:text-[#EF4444]" />
              </button>
            )}
          </div>
        );
      })}

      {activeView && dirty && activeView.ownerUid === currentUid && (
        <button
          type="button"
          onClick={() => onUpdate(activeView)}
          className="rounded-full border border-[#2A2A2A] px-2.5 py-1 text-[11px] text-[#F59E0B] hover:bg-white/5"
        >
          Aggiorna «{activeView.name}»
        </button>
      )}

      {creating ? (
        <div className="flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-black/30 px-2 py-1">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setCreating(false);
            }}
            placeholder="Nome della vista"
            className="w-36 bg-transparent text-[11px] text-white placeholder:text-[#5A5A5A] focus:outline-none"
          />
          <label className="flex cursor-pointer items-center gap-1 text-[10px] text-[#858585]">
            <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} className="accent-white" />
            condivisa
          </label>
          <button type="button" onClick={submit} className="text-[11px] text-white hover:underline">
            Salva
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-[#2A2A2A] px-2.5 py-1 text-[11px] text-[#5A5A5A] hover:text-white"
        >
          <BookmarkPlus size={11} />
          Salva vista
        </button>
      )}
    </div>
  );
}
