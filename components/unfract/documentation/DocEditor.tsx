"use client";

import React, { useState, useRef } from 'react';
import { ChevronLeft, Edit2, Lock, Link as LinkIcon, MoreHorizontal, MessageSquare, Clock, Plus, Trash2, Check, Star, Copy, Download, MonitorPlay } from 'lucide-react';
import { Document, DocBlock, Comment } from './types';
import { useRouter, useSearchParams } from 'next/navigation';
import { HistoryModal } from './HistoryModal';
import { CommentPanel } from './CommentPanel';
import { updateDocument, duplicateDocument, deleteDocument } from '@/lib/documentation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';
import { DocToolbar } from './DocToolbar';
import { SlashMenu } from './SlashMenu';
import { CustomPrompt } from '@/components/unfract/shared/CustomPrompt';
import { ContentEditableBlock } from './ContentEditableBlock';
import { compressAndUploadImage } from '@/lib/storage';

interface DocEditorProps {
  doc: Document;
}

export function DocEditor({ doc: initialDoc }: DocEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [doc, setDoc] = useState<Document>(initialDoc);
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; top: number; left: number } | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const toast = useToast();
  const dialog = useDialog();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Prompt state
  const [promptConfig, setPromptConfig] = useState<{ isOpen: boolean; type: 'link' | 'image' } | null>(null);
  const [savedSelection, setSavedSelection] = useState<Range | null>(null);

  // Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [activeCommentBlockId, setActiveCommentBlockId] = useState<string | null>(null);

  const headings = doc.blocks.filter(b => b.type === 'h2' || b.type === 'h3');
  const activeBlockForComments = doc.blocks.find(b => b.id === activeCommentBlockId);

  const scrollToBlock = (id: string) => {
    const el = document.getElementById(`block-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleBlockInput = (id: string, content: string, e?: React.FormEvent<HTMLDivElement>) => {
    // Check for slash menu trigger
    if (e && content.endsWith('/')) {
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setSlashMenu({
        blockId: id,
        top: rect.bottom + window.scrollY - 100,
        left: rect.left + window.scrollX
      });
    } else {
      setSlashMenu(null);
    }
  };

  const handleBlockBlur = (id: string, content: string) => {
    setDoc(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === id ? { ...b, content } : b)
    }));
  };

  const handlePromptRequest = (type: 'link' | 'image') => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSavedSelection(selection.getRangeAt(0));
    } else {
      setSavedSelection(null);
    }
    setPromptConfig({ isOpen: true, type: 'link' });
  };

  const handleImageUploadRequest = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSavedSelection(selection.getRangeAt(0));
    } else {
      setSavedSelection(null);
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const path = `documentation/images/${doc.id}/${Date.now()}_${file.name}`;
      const url = await compressAndUploadImage(file, path);
      
      if (savedSelection) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedSelection);
      }
      document.execCommand('insertImage', false, url);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Errore durante il caricamento dell'immagine: ${error.message || 'Errore sconosciuto. Assicurati che lo Storage sia attivo nel progetto Firebase.'}`);
    } finally {
      if (e.target) e.target.value = '';
      setSavedSelection(null);
    }
  };

  const handlePromptConfirm = (url: string) => {
    if (promptConfig) {
      // Restore selection to apply command
      if (savedSelection) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedSelection);
      }
      
      if (promptConfig.type === 'link') {
        document.execCommand('createLink', false, url);
      }
    }
    setPromptConfig(null);
    setSavedSelection(null);
  };

  const handleSlashSelect = (type: DocBlock['type']) => {
    if (!slashMenu) return;
    setDoc(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === slashMenu.blockId ? { ...b, type, content: b.content.endsWith('/') ? b.content.slice(0, -1) : b.content } : b)
    }));
    setSlashMenu(null);
  };

  const handleToolbarBlockTypeChange = (type: DocBlock['type']) => {
    if (!activeBlockId) return;
    setDoc(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === activeBlockId ? { ...b, type } : b)
    }));
  };

  const addBlock = (afterId: string) => {
    const newBlock: DocBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'p',
      content: '',
      comments: []
    };
    setDoc(prev => {
      const idx = prev.blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...prev.blocks];
      newBlocks.splice(idx + 1, 0, newBlock);
      return { ...prev, blocks: newBlocks };
    });
  };

  const deleteBlock = (id: string) => {
    setDoc(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== id)
    }));
  };

  const addComment = (text: string) => {
    if (!activeCommentBlockId) return;
    
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      author: 'Giacomo Bertolazzi',
      text,
      timestamp: 'Adesso'
    };

    setDoc(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => {
        if (b.id === activeCommentBlockId) {
          return { ...b, comments: [...(b.comments || []), newComment] };
        }
        return b;
      })
    }));
  };

  const toggleEdit = async () => {
    if (isEditing) {
      setIsSaving(true);
      const authorName = user?.displayName || 'Utente';
      const newHistory = [
        {
          id: Math.random().toString(36).substr(2, 9),
          author: authorName,
          action: 'Ha modificato il documento',
          timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        },
        ...(doc.history || [])
      ];

      setDoc(prev => ({ ...prev, lastUpdate: 'proprio ora', history: newHistory }));
      
      const success = await updateDocument(doc.id, {
        title: doc.title,
        blocks: doc.blocks,
        history: newHistory
      }, authorName);

      setIsSaving(false);
      
      if (!success) {
        toast.error("Errore durante il salvataggio.");
        return;
      }
    }
    setIsEditing(!isEditing);
  };

  const handleDuplicate = async () => {
    const authorName = user?.displayName || 'Utente';
    try {
      const newId = await duplicateDocument(doc.id, authorName);
      if (newId) {
        router.push(`/documentation/${newId}`);
        toast.success("Documento duplicato!");
      } else {
        toast.error("Errore durante la duplicazione.");
      }
    } catch (error) {
      console.error("Error duplicating doc:", error);
      toast.error("Errore durante la duplicazione.");
    }
  };

  const handleExport = () => {
    const textContent = doc.title + '\n\n' + doc.blocks.map(b => b.content).join('\n\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title}.txt`;
    a.click();
  };

  const handleDelete = async () => {
    const isConfirmed = await dialog.confirm({
      title: "Elimina Documento",
      message: "Sei sicuro di voler eliminare questo documento?",
      isDestructive: true,
      confirmText: "Elimina"
    });
    if (isConfirmed) {
      const success = await deleteDocument(doc.id);
      if (success) {
        router.push('/documentation');
        toast.success("Documento eliminato.");
      } else {
        toast.error("Errore durante l'eliminazione.");
      }
    }
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="flex flex-col min-h-full font-sans max-w-[1000px] mx-auto w-full pb-32">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => router.push('/documentation')}
          className="p-3 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-2xl text-white/70 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleEdit}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${isEditing ? 'bg-[#006AFF] text-white border-transparent' : 'bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 text-white/70'}`}
          >
            {isSaving ? 'Salvataggio...' : isEditing ? <><Check size={14} /> Salva</> : <><Edit2 size={14} /> Modifica</>}
          </button>
          
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-full text-sm font-medium text-white/70 transition-colors"
          >
            <Clock size={14} />
          </button>

          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link del documento copiato negli appunti!");
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-full text-sm font-medium text-white/70 transition-colors"
          >
            <Lock size={14} /> Condividi
          </button>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast.success("Link del documento copiato negli appunti!");
            }}
            className="p-2.5 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-full text-white/70 transition-colors"
          >
            <LinkIcon size={14} />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="p-2.5 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-full text-white/70 transition-colors"
            >
              <MoreHorizontal size={14} />
            </button>
            
            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-xl shadow-xl overflow-hidden z-[100] py-1">
                <button 
                  onClick={() => { setIsFavorite(!isFavorite); setIsMoreMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Star size={14} className={isFavorite ? 'fill-yellow-400 text-yellow-400' : ''} /> Segna come preferito
                </button>
                <button 
                  onClick={() => { handleDuplicate(); setIsMoreMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Copy size={14} /> Crea una copia
                </button>
                <button 
                  onClick={() => { handleExport(); setIsMoreMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <Download size={14} /> Esporta
                </button>
                <button 
                  onClick={() => { toast.info("Modalità presentazione non ancora implementata!"); setIsMoreMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <MonitorPlay size={14} /> Presenta
                </button>
                <div className="h-px bg-white/10 my-1" />
                <button 
                  onClick={() => { setIsDeleteModalOpen(true); setIsMoreMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                >
                  <Trash2 size={14} /> Elimina
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileUpload}
      />

      {isEditing && (
        <DocToolbar 
          onPromptRequest={type => type === 'image' ? handleImageUploadRequest() : handlePromptRequest(type)} 
          activeBlockType={doc.blocks.find(b => b.id === activeBlockId)?.type || 'p'}
          onBlockTypeChange={handleToolbarBlockTypeChange}
        />
      )}

      {/* Header */}
      <div className="flex flex-col mb-12">
        {isEditing ? (
          <input 
            type="text"
            value={doc.title}
            onChange={e => setDoc(prev => ({ ...prev, title: e.target.value }))}
            className="text-[32px] font-medium text-white tracking-wide mb-2 bg-transparent outline-none border-b border-white/20 pb-1"
          />
        ) : (
          <h1 className="text-[32px] font-medium text-white tracking-wide mb-2">
            {doc.title}
          </h1>
        )}
        <p className="text-[#858585] text-[15px]">
          Manager: {doc.manager} - {doc.date} - {doc.company}
        </p>
        <p className="text-[#858585] text-[15px]">
          Last update: {doc.lastUpdate}
        </p>
      </div>

      {/* Riepilogo (Table of Contents) */}
      {!isEditing && headings.length > 0 && (
        <div className="mb-16">
          <h2 className="text-[24px] font-medium text-white mb-6">
            Riepilogo
          </h2>
          <ul className="flex flex-col gap-2 pl-4 border-l-2 border-[#006AFF]/20">
            {headings.map(h => (
              <li key={`toc-${h.id}`} className="text-[#006AFF] flex items-center before:content-['•'] before:mr-2 before:text-[#006AFF]">
                <button 
                  onClick={() => scrollToBlock(h.id)}
                  className="hover:underline text-[15px] underline-offset-4 decoration-[#006AFF]/30 text-left"
                >
                  {h.content || "Senza titolo"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocks Content */}
      <div className="flex flex-col gap-4">
        {doc.blocks.map((block) => (
          <div 
            key={block.id} 
            id={`block-${block.id}`}
            onMouseEnter={() => setHoveredBlockId(block.id)}
            onMouseLeave={() => setHoveredBlockId(null)}
            className={`group relative flex items-start -mx-4 px-4 py-2 rounded-xl transition-colors ${isEditing ? 'hover:bg-white/5' : 'hover:bg-white/[0.02]'}`}
          >
            <div className="flex-1 relative">
              {isEditing ? (
                <div className="flex gap-2">
                  <ContentEditableBlock
                    id={block.id}
                    type={block.type}
                    initialContent={block.content}
                    onChange={handleBlockInput}
                    onBlur={handleBlockBlur}
                    onFocus={() => setActiveBlockId(block.id)}
                    className={`editor-block w-full bg-transparent focus:bg-white/[0.02] border-l-2 border-transparent focus:border-[#006AFF] rounded-r-md px-3 py-1 custom-scrollbar transition-colors
                    ${block.type === 'h2' ? 'text-[24px] font-medium text-white min-h-[44px] mt-4' : block.type === 'h3' ? 'text-[20px] font-medium text-white/90 min-h-[38px] mt-2' : 'text-[15px] text-white/80 min-h-[40px] leading-relaxed'}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        const content = e.currentTarget.innerHTML;
                        setDoc(prev => ({
                          ...prev,
                          blocks: prev.blocks.map(b => b.id === block.id ? { ...b, content } : b)
                        }));
                        addBlock(block.id);
                      }
                    }}
                  />
                </div>
              ) : (
                <>
                  {block.type === 'h2' && (
                    <div className="flex items-center gap-3 mt-6 mb-2">
                      <h2 className="text-[24px] font-medium text-white" dangerouslySetInnerHTML={{ __html: block.content || 'Titolo 1' }} />
                      <button className="text-[#858585] hover:text-white/60 transition-colors">
                        <LinkIcon size={16} />
                      </button>
                    </div>
                  )}
                  {block.type === 'h3' && (
                    <h3 className="text-[20px] font-medium text-white/90 mt-4 mb-2" dangerouslySetInnerHTML={{ __html: block.content || 'Titolo 2' }} />
                  )}
                  {block.type === 'p' && (
                    <div className="editor-block text-[15px] text-white/80 leading-relaxed font-sans min-h-[24px]" dangerouslySetInnerHTML={{ __html: block.content || '' }} />
                  )}
                </>
              )}
            </div>

            {/* Actions Panel */}
            <div className={`absolute right-4 top-2 flex items-center gap-2 transition-opacity duration-200 ${(hoveredBlockId === block.id || activeCommentBlockId === block.id || isEditing) ? 'opacity-100' : 'opacity-0'}`}>
              {isEditing ? (
                <>
                  <button 
                    onClick={() => addBlock(block.id)}
                    className="p-1.5 bg-[#1A1A1A] border border-white/10 rounded-md text-[#858585] hover:text-white transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    onClick={() => deleteBlock(block.id)}
                    className="p-1.5 bg-[#1A1A1A] border border-white/10 rounded-md text-red-500/50 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setActiveCommentBlockId(activeCommentBlockId === block.id ? null : block.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[12px] font-medium transition-colors shadow-lg ${activeCommentBlockId === block.id || (block.comments && block.comments.length > 0) ? 'bg-[#006AFF] border-transparent text-white' : 'bg-[#1A1A1A] border-white/10 text-[#858585] hover:text-white'}`}
                >
                  <MessageSquare size={14} />
                  {block.comments && block.comments.length > 0 && (
                    <span>{block.comments.length}</span>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {isEditing && doc.blocks.length === 0 && (
          <button 
            onClick={() => {
              setDoc(prev => ({
                ...prev,
                blocks: [{ id: '1', type: 'p', content: '', comments: [] }]
              }));
            }}
            className="p-4 border border-dashed border-white/20 rounded-xl text-[#858585] hover:text-white hover:border-white/40 transition-colors text-center"
          >
            Aggiungi il primo blocco
          </button>
        )}

        {slashMenu && (
          <SlashMenu 
            position={{ top: slashMenu.top, left: slashMenu.left }} 
            onClose={() => setSlashMenu(null)}
            onSelect={handleSlashSelect}
          />
        )}
      </div>

      <HistoryModal 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        history={doc.history || []} 
      />

      <CommentPanel 
        isOpen={activeCommentBlockId !== null}
        onClose={() => setActiveCommentBlockId(null)}
        comments={activeBlockForComments?.comments || []}
        onAddComment={addComment}
        blockTextPreview={activeBlockForComments?.content.replace(/<[^>]+>/g, '')}
      />

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-medium text-white mb-2">Elimina Documento</h3>
            <p className="text-white/60 text-sm mb-6">
              Sei sicuro di voler eliminare definitivamente "{doc.title}"? Questa azione non può essere annullata.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2.5 rounded-full text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Annulla
              </button>
              <button 
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-full text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} /> Elimina
              </button>
            </div>
          </div>
        </div>
      )}

      {promptConfig?.isOpen && (
        <CustomPrompt 
          title={promptConfig.type === 'link' ? "Inserisci Link" : "Inserisci URL Immagine"}
          placeholder="https://..."
          onConfirm={handlePromptConfirm}
          onClose={() => {
            setPromptConfig(null);
            setSavedSelection(null);
          }}
        />
      )}
    </div>
  );
}
