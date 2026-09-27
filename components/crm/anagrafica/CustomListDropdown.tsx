'use client';
import { useState, useRef, useEffect } from 'react';
import { ListPlus } from 'lucide-react';
import { useCrm } from '@/contexts/CrmContext';
import { updateCustomList } from '@/lib/crm/customLists';
import { useCloseOnEscape } from '@/hooks/useCloseOnEscape';

export function CustomListDropdown({ recordId }: { recordId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { customLists, ctx } = useCrm();

  useCloseOnEscape(() => setOpen(false));
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (customLists.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center gap-2 rounded-xl border border-[#00A6FF]/20 bg-[#00A6FF]/10 px-4 py-2.5 text-xs font-medium text-[#00A6FF] transition-colors hover:bg-[#00A6FF]/20 w-full"
      >
        <ListPlus size={14} /> Aggiungi a Lista
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-xl border border-[#1A1A1A] bg-[#0B0B0B] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          {customLists.map(list => {
            const isAdded = list.entityIds.includes(recordId);
            return (
              <button
                key={list.id}
                disabled={isAdded}
                onClick={() => {
                  if (ctx && !isAdded) {
                    updateCustomList(ctx, list.id, { entityIds: [...list.entityIds, recordId] });
                  }
                  setOpen(false);
                }}
                className={`flex w-full items-center px-3 py-2 text-[13px] rounded-lg transition-colors text-left ${isAdded ? 'text-[#858585] opacity-50 cursor-not-allowed' : 'text-[#E5E5E5] hover:bg-white/5'}`}
              >
                {list.name} {isAdded && ' (Già aggiunto)'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
