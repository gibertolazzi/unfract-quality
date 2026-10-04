"use client";
import { incrementStorageUsage, incrementAiUsage } from '@/lib/usage';
import { getWebLLMEngine, isWebLLMLoaded } from '@/lib/webllm';
import { GoogleGenerativeAI } from '@google/generative-ai';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Edit2, Lock, Link as LinkIcon, MoreHorizontal, MessageSquare, Clock, Plus, Trash2, Check, Star, Copy, Download, MonitorPlay, Link2 } from 'lucide-react';
import { Document, DocBlock, Comment } from './types';
import { useRouter, useSearchParams } from 'next/navigation';
import { HistoryModal } from './HistoryModal';
import { updateDocument, duplicateDocument, deleteDocument } from '@/lib/documentation';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/contexts/ToastContext';
import { useDialog } from '@/contexts/DialogContext';
import { DocToolbar } from './DocToolbar';
import { CustomPrompt } from '@/components/shared/CustomPrompt';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Extension } from '@tiptap/core';
import LinkExtension from '@tiptap/extension-link';
import Heading from '@tiptap/extension-heading';
import Underline from '@tiptap/extension-underline';
import ImageExtension from '@tiptap/extension-image';
import { Video, Audio } from './extensions';
import { ReferenceWidget } from './ReferenceWidget';
import { ItemSelectorModal } from './ItemSelectorModal';
import { marked } from 'marked';
import { collection, getDocs, query, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateDocContent } from '@/app/actions/aiActions';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import { SlashMenu } from './SlashMenu';

import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { CodeBlockComponent } from './CodeBlockComponent';
import 'highlight.js/styles/atom-one-dark.css';

const lowlight = createLowlight(common);


const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: element => element.getAttribute('id'),
        renderHTML: attributes => {
          if (!attributes.id) return {};
          return { id: attributes.id };
        },
      },
    };
  },
});

interface DocEditorProps {
  doc: Document;
}

export function DocEditor({ doc: initialDoc }: DocEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { activeProjectId } = useProject();
  const { activeWorkspaceId } = useWorkspace();
  const [doc, setDoc] = useState<Document>(initialDoc);
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');
  const [isSaving, setIsSaving] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const toast = useToast();
  const dialog = useDialog();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [slashMenu, setSlashMenu] = useState<{ top: number; bottom: number; left: number } | null>(null);
  const [itemSelectorConfig, setItemSelectorConfig] = useState<{ isOpen: boolean; type: 'task' | 'event' | 'meeting' | 'document' } | null>(null);

  const [promptConfig, setPromptConfig] = useState<{ isOpen: boolean; type: 'link' | 'image' | 'ai' } | null>(null);
  const [savedSelection, setSavedSelection] = useState<any>(null);

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor || !activeProjectId) return;
    
    setIsUploadingMedia(true);
    toast.success("Caricamento file in corso...");
    try {
      const storageRef = ref(storage, `documentation/${activeProjectId}/${doc.id}/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      if (activeWorkspaceId) {
        await incrementStorageUsage(activeWorkspaceId, file.size);
      }
      
      const type = file.type;
      if (type.startsWith('image/')) {
        editor.chain().focus().setImage({ src: url }).run();
      } else if (type.startsWith('video/')) {
        (editor.chain().focus() as any).setVideo({ src: url }).run();
      } else if (type.startsWith('audio/')) {
        (editor.chain().focus() as any).setAudio({ src: url }).run();
      } else {
        toast.error("Formato file non supportato.");
      }
      toast.success("Media caricato con successo!");
    } catch (error) {
      console.error(error);
      toast.error("Errore durante il caricamento del file.");
    } finally {
      setIsUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [headingsList, setHeadingsList] = useState<{ level: number; text: string; id: string; pos: number }[]>([]);

  // Modale Link
  const [linkUrl, setLinkUrl] = useState('');

  const generateId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const initialHtml = doc.blocks.map(b => {
    if (b.type === 'h2') return `<h2 id="${generateId(b.content)}">${b.content}</h2>`;
    if (b.type === 'h3') return `<h3 id="${generateId(b.content)}">${b.content}</h3>`;
    return `<p>${b.content || ''}</p>`;
  }).join('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      CustomHeading,
      TextStyle,
      FontFamily,
      FontSize,


      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent)
        },
      }).configure({ lowlight }),

      Underline,
      ImageExtension.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full my-4 cursor-pointer',
        },
      }),
      Video,
      Audio,
      ReferenceWidget,

      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[#006AFF] underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: "Inizia a scrivere o premi '/' per i comandi...",
      }),
    ],
    content: initialHtml,
    editable: isEditing,
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[400px]',
      },
      handleKeyDown: (view, event) => {
        if (event.key === '/') {
          const { left, bottom, top } = view.coordsAtPos(view.state.selection.from);
          setSlashMenu({ left, top, bottom });
        } else if (event.key === 'Backspace' || event.key === 'Escape' || event.key === ' ') {
          setSlashMenu(null);
        }
        return false;
      }
    },
    onUpdate: ({ editor }) => {
      const newHeadings: any[] = [];
      let transactionNeeded = false;
      const { tr } = editor.state;

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const text = node.textContent;
          const id = node.attrs.id || generateId(text) || `heading-${pos}`;
          
          if (node.attrs.id !== id) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id });
            transactionNeeded = true;
          }

          newHeadings.push({
            level: node.attrs.level,
            text,
            id,
            pos
          });
        }
      });
      
      if (transactionNeeded) {
        editor.view.dispatch(tr);
      }
      
      setHeadingsList(newHeadings);
    },
    onCreate: ({ editor }) => {
      // populate initially
      const newHeadings: any[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') {
          const id = node.attrs.id || generateId(node.textContent) || `heading-${pos}`;
          newHeadings.push({ level: node.attrs.level, text: node.textContent, id, pos });
        }
      });
      setHeadingsList(newHeadings);
    }
  });

  useEffect(() => {
    if (editor) editor.setEditable(isEditing);
  }, [isEditing, editor]);

  const handleSlashSelect = (type: string) => {
    if (!editor) return;
    
    editor.commands.deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from });
    
    if (type === 'ai') {
      setPromptConfig({ isOpen: true, type: 'ai' });
    }
    else if (type === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
    else if (type === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
    else if (type === 'list') editor.chain().focus().toggleBulletList().run();
    else if (['task', 'event', 'meeting', 'document'].includes(type)) {
      setItemSelectorConfig({ isOpen: true, type: type as 'task' | 'event' | 'meeting' | 'document' });
    }
    else if (type === 'p') editor.chain().focus().setParagraph().run();
    
    setSlashMenu(null);
  };

  const toggleEdit = async () => {
    if (isEditing) {
      setIsSaving(true);
      const authorName = user?.displayName || 'Utente';
      const newHistory = [
        { id: Math.random().toString(36).substr(2, 9), author: authorName, action: 'Ha modificato il documento', timestamp: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) },
        ...(doc.history || [])
      ];

      const htmlContent = editor?.getHTML() || '';
      const updatedBlocks: DocBlock[] = [
        { id: doc.blocks[0]?.id || Math.random().toString(36).substr(2, 9), type: 'p', content: htmlContent, comments: doc.blocks[0]?.comments || [] }
      ];

      setDoc(prev => ({ ...prev, lastUpdate: 'proprio ora', history: newHistory, blocks: updatedBlocks }));
      
      const success = await updateDocument(doc.id, { title: doc.title, blocks: updatedBlocks, history: newHistory }, authorName);

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

  const handlePromptConfirm = (url: string) => {
    if (promptConfig?.type === 'image' && editor) {
      // Inserisci immagine. In TipTap serve Image extension (qui usiamo un link semplice per ora se non c'è)
      editor.chain().focus().insertContent(`<img src="${url}" />`).run();
    }
    setPromptConfig(null);
  };

  const insertLink = (url: string) => {
    if (editor) {
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }
    }
    setPromptConfig(null);
    setLinkUrl('');
  };

  const scrollToHeading = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col min-h-full font-sans max-w-[1000px] mx-auto w-full pb-32">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/documentation')} className="p-3 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-2xl text-white/70 transition-colors">
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-3">
          <button onClick={toggleEdit} disabled={isSaving} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${isEditing ? 'bg-[#006AFF] text-white border-transparent' : 'bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 text-white/70'}`}>
            {isSaving ? 'Salvataggio...' : isEditing ? <><Check size={14} /> Salva</> : <><Edit2 size={14} /> Modifica</>}
          </button>
          
          <button onClick={() => setIsHistoryOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-full text-sm font-medium text-white/70 transition-colors">
            <Clock size={14} />
          </button>

          <div className="relative">
            <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className="p-2.5 bg-[#0E0E0E] hover:bg-[#1A1A1A] border border-white/10 rounded-full text-white/70 transition-colors">
              <MoreHorizontal size={14} />
            </button>
            {isMoreMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#111] border border-white/10 rounded-xl shadow-xl overflow-hidden z-[100] py-1">
                <button onClick={() => { setIsDeleteModalOpen(true); setIsMoreMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2">
                  <Trash2 size={14} /> Elimina
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditing && editor && (
        <DocToolbar 
          editor={editor}
          onPromptRequest={(type) => {
            if (type === 'image') {
              fileInputRef.current?.click();
            } else if (type === 'link') {
              const previousUrl = editor.getAttributes('link').href;
              setLinkUrl(previousUrl || '');
              setPromptConfig({ isOpen: true, type: 'link' });
            } else {
              setPromptConfig({ isOpen: true, type: type });
            }
          }} 
        />
      )}


      {/* Hidden File Input for Media */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleMediaUpload} 
        className="hidden" 
        accept="image/*,video/*,audio/*" 
      />

      {/* Header */}
      <div className="flex flex-col mb-12">
        {isEditing ? (
          <input type="text" value={doc.title} onChange={e => setDoc(prev => ({ ...prev, title: e.target.value }))} className="text-[32px] font-medium text-white tracking-wide mb-2 bg-transparent outline-none border-b border-white/20 pb-1" />
        ) : (
          <h1 className="text-[32px] font-medium text-white tracking-wide mb-2">{doc.title}</h1>
        )}
        <p className="text-[#858585] text-[15px]">Manager: {doc.manager} - {doc.date} - {doc.company}</p>
      </div>

      {/* Riepilogo (Table of Contents) */}
      {!isEditing && headingsList.length > 0 && (
        <div className="mb-16">
          <h2 className="text-[24px] font-medium text-white mb-6">Riepilogo</h2>
          <ul className="flex flex-col gap-2 pl-4 border-l-2 border-[#006AFF]/20">
            {headingsList.map(h => (
              <li key={`toc-${h.id}`} className="text-[#006AFF] flex items-center before:content-['•'] before:mr-2 before:text-[#006AFF]">
                <button 
                  onClick={() => scrollToHeading(h.id)}
                  className="hover:underline text-[15px] underline-offset-4 decoration-[#006AFF]/30 text-left"
                >
                  {h.text || "Senza titolo"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Table of contents also visible in edit mode for ease of navigation */}
      {isEditing && headingsList.length > 0 && (
        <div className="mb-12 bg-white/5 p-4 rounded-xl border border-white/10">
          <h3 className="text-[16px] font-medium text-white/70 mb-4 flex items-center gap-2"><Link2 size={16}/> Sommario (Aggiornato in tempo reale)</h3>
          <ul className="flex flex-col gap-2 pl-4 border-l-2 border-white/10">
            {headingsList.map(h => (
              <li key={`toc-edit-${h.id}`} className="text-white/60 text-sm">
                <span className="opacity-50 mr-2">H{h.level}</span> {h.text || "Senza titolo"}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tiptap Editor */}
      <div className="w-full border-none outline-none">
        <EditorContent editor={editor} />
      </div>

      {slashMenu && (
        <SlashMenu position={slashMenu} onClose={() => setSlashMenu(null)} onSelect={handleSlashSelect} />
      )}

      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={doc.history || []} />

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-medium text-white mb-2">Elimina Documento</h3>
            <p className="text-white/60 text-sm mb-6">Sei sicuro di voler eliminare definitivamente "{doc.title}"? Questa azione non può essere annullata.</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setIsDeleteModalOpen(false)} className="px-5 py-2.5 rounded-full text-sm font-medium text-white hover:bg-white/10">Annulla</button>
              <button onClick={handleDelete} className="px-5 py-2.5 rounded-full text-sm font-medium bg-red-500 hover:bg-red-600 text-white flex items-center gap-2"><Trash2 size={16} /> Elimina</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Link Prompt that supports internal headings */}
      {promptConfig?.isOpen && promptConfig.type === 'link' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-medium text-white mb-4">Inserisci Link</h3>
            
            <label className="text-sm text-[#858585] mb-1 block">URL Esterno o Elemento della pagina</label>
            <input 
              type="text" 
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://..." 
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#006AFF] transition-colors mb-4"
              autoFocus
            />
            
            {headingsList.length > 0 && (
              <div className="mb-6">
                <label className="text-sm text-[#858585] mb-2 block">Oppure seleziona un titolo della pagina:</label>
                <div className="max-h-40 overflow-y-auto bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col gap-1 custom-scrollbar">
                  {headingsList.map(h => (
                    <button 
                      key={h.id}
                      onClick={() => setLinkUrl(`#${h.id}`)}
                      className="text-left px-3 py-2 rounded-lg hover:bg-[#006AFF]/20 hover:text-[#00A6FF] text-white/70 text-sm transition-colors truncate"
                    >
                      <span className="opacity-50 mr-2">H{h.level}</span> {h.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setPromptConfig(null)} className="px-5 py-2.5 rounded-full text-sm font-medium text-white hover:bg-white/10">Annulla</button>
              <button onClick={() => insertLink(linkUrl)} className="px-5 py-2.5 rounded-full text-sm font-medium bg-[#006AFF] hover:bg-blue-600 text-white">Conferma</button>
            </div>
          </div>
        </div>
      )}


      {/* AI Assist prompt */}
      {promptConfig?.isOpen && promptConfig.type === 'ai' && (
        <CustomPrompt 
          title="Genera con IA"
          placeholder="Es. Fai un riassunto dei meeting di oggi..."
          showCloudToggle={true}
          onConfirm={async (prompt, _color, useCloud) => {
            setPromptConfig(null);
            toast.info("Raccolta del contesto e generazione in corso...");
            
            try {
              let contextText = "";
              if (activeProjectId) {
                try {
                  const tasksSnap = await getDocs(query(collection(db, 'tasks'), where('projectId', '==', activeProjectId), limit(50)));
                  const meetingsSnap = await getDocs(query(collection(db, 'meetings'), where('projectId', '==', activeProjectId), limit(20)));
                  const columnsSnap = await getDocs(query(collection(db, 'columns'), where('projectId', '==', activeProjectId)));
                  const docsSnap = await getDocs(query(collection(db, 'documentation'), where('projectId', '==', activeProjectId), limit(10)));
                  
                  let eventsList: any[] = [];
                  if (user) {
                    const eventsSnap = await getDocs(query(collection(db, 'users', user.uid, 'events'), limit(20)));
                    eventsList = eventsSnap.docs.map(d => ({ titolo: d.data().title, data: d.data().date }));
                  }
                  
                  const columnsList = columnsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                  const getColumnName = (colId: string) => {
                    const col = columnsList.find(c => c.id === colId) as any;
                    return col ? col.title : 'Senza Colonna';
                  };

                  const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                  const meetings = meetingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                  const docs = docsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                  
                  contextText = `
Ecco il CONTESTO INTERNO della piattaforma (i dati del progetto attuale).
ATTENZIONE: L'utente si aspetta che tu capisca i collegamenti logici. Usa questi dati per espandere concetti, correlare eventi, meeting e task. Analizza accuratamente lo "stato" (la colonna: To Do, Doing, Done) e la "priorita" delle task.
---
TASK (Attive e Completate):
${JSON.stringify(tasks.map((t: any) => ({ titolo: t.title, stato: getColumnName(t.columnId), priorita: t.priority || 'Nessuna', descrizione: t.description })))}

MEETING TRASCRITTI:
${JSON.stringify(meetings.map((m: any) => ({ titolo: m.title, data: m.date, riassunto: m.summary })))}

DOCUMENTAZIONE (Titoli recenti):
${JSON.stringify(docs.map((d: any) => ({ titolo: d.title })))}

EVENTI IN CALENDARIO:
${JSON.stringify(eventsList)}
---
`;
                } catch (e) {
                  console.warn("Failed to fetch context", e);
                }
              }

              const systemPromptText = `Sei un eccellente assistente AI integrato in un editor documentale aziendale.
Devi generare il contenuto usando ESCLUSIVAMENTE codice Markdown (es. ## Titoli, **grassetto**, * liste).
NON formattare mai in HTML.
Usa SEMPRE Markdown per creare elenchi, intestazioni e testi.
NON racchiudere la risposta in backtick.
${contextText}`;

              let response = "";
              
              if (!useCloud) {
                if (typeof window !== 'undefined' && 'ai' in window && 'languageModel' in (window as any).ai) {
                  try {
                    const session = await (window as any).ai.languageModel.create({ systemPrompt: systemPromptText });
                    response = await session.prompt(prompt);
                    session.destroy();
                  } catch (localErr) {
                    console.warn("Gemini Nano failed, trying WebLLM...", localErr);
                  }
                }
                
                if (!response && typeof navigator !== 'undefined' && (navigator as any).gpu) {
                  try {
                    if (!isWebLLMLoaded()) {
                      toast.info("Caricamento WebLLM (può richiedere 1 min se primo avvio)...");
                    } else {
                      toast.info("Generazione in corso...");
                    }
                    const engine = await getWebLLMEngine((progress) => {
                      console.log("WebLLM Progress:", progress);
                    });
                    const reply = await engine.chat.completions.create({
                      messages: [
                        { role: "system", content: systemPromptText },
                        { role: "user", content: prompt }
                      ]
                    });
                    response = reply.choices[0].message.content || '';
                  } catch (webllmErr) {
                    console.warn("WebLLM failed, falling back to Cloud AI...", webllmErr);
                  }
                }
              }
              
              if (!response || useCloud) {
                toast.info("Generazione in corso...");
                response = await generateDocContent(prompt, systemPromptText);
              }
              
              // Clean markdown backticks
              response = response.replace(/^\s*```(markdown|md|html)?/g, '').replace(/```\s*$/g, '').trim();

              // Convert Markdown to HTML
              const htmlContent = await marked.parse(response);

              if (editor) editor.commands.insertContent(htmlContent);
              toast.success("Contenuto generato con successo!");
            } catch (e) {
              console.error(e);
              toast.error("Errore della generazione AI.");
            }
          }}
          onClose={() => setPromptConfig(null)}
        />
      )
}

      {/* Fallback image prompt */}
      {promptConfig?.isOpen && promptConfig.type === 'image' && (
        <CustomPrompt 
          title="Inserisci URL Immagine"
          placeholder="https://..."
          onConfirm={handlePromptConfirm}
          onClose={() => setPromptConfig(null)}
        />
      )}

      {itemSelectorConfig?.isOpen && (
        <ItemSelectorModal
          isOpen={true}
          type={itemSelectorConfig.type}
          projectId={activeProjectId || undefined}
          onClose={() => setItemSelectorConfig(null)}
          onSelect={(item) => {
            if (editor) {
              editor.commands.insertContent({
                type: 'referenceWidget',
                attrs: {
                  type: item.type,
                  id: item.id,
                  title: item.title
                }
              });
              // Insert a space after the widget to allow typing
              editor.commands.insertContent(' ');
            }
          }}
        />
      )}
    </div>
  );
}
