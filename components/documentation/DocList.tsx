"use client";

import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Document } from './types';
import { DocCard } from './DocCard';

import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/contexts/TranslationContext';

interface DocListProps {
  documents: Document[];
}

export function DocList({ documents }: DocListProps) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const toast = useToast();
  const { activeProjectId } = useProject();
  const { user } = useAuth();
  const { t } = useTranslation();

  const getAllDescendantIds = (parentId: string): string[] => {
    let ids: string[] = [];
    const children = documents.filter(d => d.parentId === parentId);
    children.forEach(c => {
      ids.push(c.id);
      ids = ids.concat(getAllDescendantIds(c.id));
    });
    return ids;
  };

  const toggleNodeDeep = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => {
      const isCurrentlyExpanded = !!prev[id];
      const newState = !isCurrentlyExpanded;
      const updates: Record<string, boolean> = { [id]: newState };
      
      const descendants = getAllDescendantIds(id);
      descendants.forEach(dId => updates[dId] = newState);
      
      return { ...prev, ...updates };
    });
  };

  const handleCreateNew = async () => {
    if (!activeProjectId || !user) {
      toast.error(t.documentation.userOrProjectNotFound);
      return;
    }
    setIsCreating(true);
    const { createDocument } = await import('@/lib/documentation');
    try {
      const newId = await createDocument(activeProjectId, user.displayName || "User");
      if (newId) {
        router.push(`/documentation/${newId}?edit=true`);
      } else {
        setIsCreating(false);
        toast.error(t.documentation.createDocError);
      }
    } catch (error) {
      console.error(error);
      setIsCreating(false);
      toast.error(t.documentation.createDocError);
    }
  };

  const renderTree = (parentId: string | null = null, level: number = 0) => {
    const children = documents.filter(d => (d.parentId || null) === parentId);
    if (children.length === 0) return null;

    return (
      <div className="flex flex-col gap-4 w-full">
        {children.map(doc => {
          const hasChildren = documents.some(d => d.parentId === doc.id);
          const isExpanded = expandedNodes[doc.id];
          return (
            <div key={doc.id} className="flex flex-col gap-2 w-full">
              <div className="w-full" style={{ paddingLeft: `${level * 2}rem` }}>
                <div className="relative w-full group">
                   <DocCard doc={doc} />
                   {hasChildren && (
                     <button 
                       onClick={(e) => toggleNodeDeep(doc.id, e)} 
                       className="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded-full border border-white/10 transition-colors z-10 opacity-0 group-hover:opacity-100 sm:opacity-100"
                     >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                     </button>
                   )}
                </div>
              </div>
              {isExpanded && renderTree(doc.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full font-sans max-w-[1229px] mx-auto w-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={handleCreateNew}
          disabled={isCreating}
          className="flex items-center gap-2 px-4 py-2 bg-[#002451] border border-[#003B80] text-[#00A6FF] rounded-full font-medium transition-colors hover:bg-[#003B80]/80 text-sm disabled:opacity-50"
        >
          {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {t.documentation.newDocument}
        </button>

        <button className="flex items-center gap-2 border border-white/10 bg-transparent text-[#858585] hover:text-white transition-colors px-4 py-2.5 rounded-xl text-sm font-medium">
          {t.documentation.sortByRecent}
          <ChevronDown size={16} />
        </button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-10">
        {documents.length === 0 ? (
          <div className="text-center text-[#858585] mt-10">
            {t.documentation.noDocsFound}
          </div>
        ) : (
          renderTree(null, 0)
        )}
      </div>
    </div>
  );
}
