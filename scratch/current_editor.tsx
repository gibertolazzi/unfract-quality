'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Undo2, Redo2, Monitor, Smartphone, LayoutTemplate, Palette,
  Type, AlignLeft, Image as ImageIcon, Youtube, MousePointerClick, 
  Code, Hexagon, Share2, PlusSquare, SplitSquareHorizontal, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { updateCampaign } from '@/lib/services/marketingService';
import { useToast } from '@/contexts/ToastContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const BLOCKS = [
  { id: 'title', icon: Type, label: 'Titolo' },
  { id: 'text', icon: AlignLeft, label: 'Testo' },
  { id: 'image', icon: ImageIcon, label: 'Immagine' },
  { id: 'button', icon: MousePointerClick, label: 'Pulsante' },
  { id: 'divider', icon: SplitSquareHorizontal, label: 'Separatore' }
];

const SECTIONS = [
  { id: 'header', label: 'Intestazione (Logo)', type: 'image', content: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=50&fit=crop' },
  { id: 'text_image', label: 'Testo + Immagine', type: 'text_image' },
  { id: 'signature', label: 'Firma', type: 'text', content: 'Cordiali saluti,\nIl team di Meyou' }
];

export function EmailEditorView({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorType = searchParams.get('type') || 'dnd';
  const toast = useToast();

  const [activeMainTab, setActiveMainTab] = useState<'content' | 'style'>('content');
  const [activeSubTab, setActiveSubTab] = useState<'blocks' | 'sections' | 'saved'>('blocks');

  // Simple blocks state
  const [blocks, setBlocks] = useState<any[]>([
    { id: '1', type: 'title', content: 'Questo è il tuo titolo.' },
    { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&q=80&w=400' },
    { id: '3', type: 'text', content: 'Scrivi qui il tuo messaggio...' },
    { id: '4', type: 'button', content: 'Clicca qui' }
  ]);

  const [simpleHtml, setSimpleHtml] = useState('<p>Caro cliente,</p><p>Questo è un messaggio semplice.</p>');
  const [customHtml, setCustomHtml] = useState('<html>\n  <body>\n    <h1>Hello World</h1>\n  </body>\n</html>');

  const addBlock = (type: string, content?: string) => {
    if (type === 'text_image') {
      setBlocks([...blocks, 
        { id: Math.random().toString(), type: 'text', content: 'Testo della sezione...' },
        { id: Math.random().toString(), type: 'image', content: 'https://images.unsplash.com/photo-1455390582262-044cdead27d8?auto=format&fit=crop&q=80&w=400' }
      ]);
    } else {
      setBlocks([...blocks, { id: Math.random().toString(), type, content: content || getDefaultContent(type) }]);
    }
  };

  const getDefaultContent = (type: string) => {
    switch(type) {
      case 'title': return 'Nuovo titolo';
      case 'text': return 'Nuovo blocco di testo';
      case 'image': return 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?auto=format&fit=crop&q=80&w=400';
      case 'button': return 'Scopri di più';
      default: return '';
    }
  };

  const updateBlock = (id: string, content: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };


  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const { source, destination } = result;
    
    if (source.droppableId === 'blocks-sidebar' && destination.droppableId === 'canvas') {
      const type = result.draggableId;
      const newBlock = { id: Math.random().toString(), type, content: getDefaultContent(type) };
      const newBlocks = Array.from(blocks);
      newBlocks.splice(destination.index, 0, newBlock);
      setBlocks(newBlocks);
    } else if (source.droppableId === 'canvas' && destination.droppableId === 'canvas') {
      const newBlocks = Array.from(blocks);
      const [reorderedItem] = newBlocks.splice(source.index, 1);
      newBlocks.splice(destination.index, 0, reorderedItem);
      setBlocks(newBlocks);
    }
  };

  const handleSaveAndExit = async () => {
    toast.success('Modello salvato con successo nei tuoi modelli.');
    let finalHtml = '';
    if (editorType === 'simple') finalHtml = simpleHtml;
    else if (editorType === 'html') finalHtml = customHtml;
    else finalHtml = 'dnd-template'; // mock

    await updateCampaign(campaignId, { designHtml: finalHtml });
    router.push(`/marketing/campaigns/${campaignId}`);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] text-white font-sans overflow-hidden">
      
      {/* Top Bar */}
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 shrink-0 bg-[#0A0A0A]">
        <div className="flex items-center gap-4">
          <Link href={`/marketing/campaigns/${campaignId}`} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <span className="font-medium text-[15px]">Modifica design email</span>
          <div className="w-px h-5 bg-white/10 mx-2" />
          <span className="text-xs text-[#0D6EFD] font-medium ml-4">Tutte le modifiche sono salvate</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSaveAndExit}
            className="px-4 py-2 text-sm font-medium bg-[#0D6EFD] text-white rounded-xl hover:bg-[#0D6EFD]/90 transition-colors flex items-center gap-2"
          >
            Salva e esci
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {editorType === 'dnd' && (
           <DragDropContext onDragEnd={handleDragEnd}>
            <div className="w-20 border-r border-white/10 bg-[#0A0A0A] flex flex-col items-center py-4 gap-2">
              <button 
                onClick={() => setActiveMainTab('content')}
                className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl gap-1 transition-colors ${activeMainTab === 'content' ? 'bg-[#0D6EFD]/10 text-[#0D6EFD]' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
              >
                <LayoutTemplate size={20} />
                <span className="text-[10px] font-medium">Contenuto</span>
              </button>
            </div>

            <div className="w-80 border-r border-white/10 bg-[#0A0A0A] flex flex-col shrink-0">
              {activeMainTab === 'content' && (
                <>
                  <div className="flex border-b border-white/10 p-2">
                    <button 
                      onClick={() => setActiveSubTab('blocks')}
                      className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'blocks' ? 'border-[#0D6EFD] text-white' : 'border-transparent text-[#858585] hover:text-white'}`}
                    >
                      Blocchi
                    </button>
                    <button 
                      onClick={() => setActiveSubTab('sections')}
                      className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'sections' ? 'border-[#0D6EFD] text-white' : 'border-transparent text-[#858585] hover:text-white'}`}
                    >
                      Sezioni
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    {activeSubTab === 'blocks' && (
                      <Droppable droppableId="blocks-sidebar" isDropDisabled={true}>
                        {(provided) => (
                          <div 
                            className="grid grid-cols-2 gap-3"
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                          >
                            {BLOCKS.map((block, index) => (
                              <Draggable key={block.id} draggableId={block.id} index={index}>
                                {(provided, snapshot) => (
                                  <React.Fragment>
                                    <div 
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="aspect-square bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-grab hover:bg-[#1A1A1A] transition-all group"
                                      style={{...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.5 : 1}}
                                    >
                                      <div className="text-[#858585] group-hover:text-[#0D6EFD] transition-colors">
                                        <block.icon size={28} strokeWidth={1.5} />
                                      </div>
                                      <span className="text-[11px] font-medium text-[#858585] group-hover:text-white">{block.label}</span>
                                    </div>
                                    {snapshot.isDragging && (
                                      <div className="aspect-square bg-[#141414] border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3 opacity-50">
                                        <div className="text-[#858585]">
                                          <block.icon size={28} strokeWidth={1.5} />
                                        </div>
                                        <span className="text-[11px] font-medium text-[#858585]">{block.label}</span>
                                      </div>
                                    )}
                                  </React.Fragment>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    )}
                    {activeSubTab === 'sections' && (
                      <div className="flex flex-col gap-3">
                        {SECTIONS.map(section => (
                          <div 
                            key={section.id}
                            onClick={() => addBlock(section.type, section.content)}
                            className="p-4 bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-xl cursor-pointer hover:bg-[#1A1A1A] transition-all"
                          >
                            <span className="text-sm font-medium text-white">{section.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 bg-[#050505] overflow-y-auto relative py-12 px-4 flex justify-center items-start" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
              <Droppable droppableId="canvas">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`w-full max-w-[600px] bg-white min-h-[800px] h-fit shadow-2xl rounded-sm p-8 flex flex-col gap-4 ${snapshot.isDraggingOver ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}`}
                  >
                    {blocks.map((block, index) => (
                      <Draggable key={block.id} draggableId={block.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`relative group border-2 border-transparent hover:border-blue-300 rounded p-2 transition-colors bg-white ${snapshot.isDragging ? 'shadow-xl scale-105 z-50' : ''}`}
                          >
                            <button onClick={() => removeBlock(block.id)} className="absolute -right-2 -top-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <Trash2 size={12} />
                            </button>
                            {block.type === 'title' && (
                              <input 
                                value={block.content} 
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-full text-[#1A1A1A] text-3xl font-bold text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2"
                              />
                            )}
                            {block.type === 'text' && (
                              <textarea 
                                value={block.content} 
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-full text-gray-600 text-sm text-center bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2 min-h-[100px] resize-none"
                              />
                            )}
                            {block.type === 'image' && (
                              <div className="flex flex-col items-center gap-2">
                                <img src={block.content} className="max-w-full rounded-lg shadow-sm" alt="Blocco immagine" />
                                <input 
                                  value={block.content} 
                                  onChange={(e) => updateBlock(block.id, e.target.value)}
                                  placeholder="URL Immagine"
                                  className="w-full text-xs p-2 border border-gray-200 rounded text-black opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2 left-0 bg-white/90 backdrop-blur"
                                />
                              </div>
                            )}
                            {block.type === 'button' && (
                              <div className="flex justify-center">
                                <input 
                                  value={block.content} 
                                  onChange={(e) => updateBlock(block.id, e.target.value)}
                                  className="bg-[#1A1A1A] text-white px-8 py-3 rounded-lg font-medium text-center border-none outline-none focus:ring-2 focus:ring-blue-500 pointer-events-none"
                                />
                              </div>
                            )}
                            {block.type === 'divider' && (
                              <hr className="border-t border-gray-200 my-4 w-full" />
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </DragDropContext>
        )}

        {editorType === 'simple' && (
          <div className="flex-1 flex flex-col p-8 bg-[#0B0B0B]">
            <h2 className="text-xl font-medium mb-4">Editor semplice (RTF)</h2>
            <textarea 
              value={simpleHtml}
              onChange={(e) => setSimpleHtml(e.target.value)}
              className="flex-1 w-full max-w-4xl mx-auto bg-white text-black p-6 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006AFF]"
            />
          </div>
        )}

        {editorType === 'html' && (
          <div className="flex-1 flex p-4 gap-4 bg-[#0B0B0B]">
            <div className="flex-1 flex flex-col gap-2">
              <h2 className="text-sm font-medium text-[#858585]">Codice HTML</h2>
              <textarea 
                value={customHtml}
                onChange={(e) => setCustomHtml(e.target.value)}
                className="flex-1 bg-[#141414] border border-[#1A1A1A] rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-[#006AFF]"
              />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <h2 className="text-sm font-medium text-[#858585]">Anteprima dal vivo</h2>
              <div 
                className="flex-1 bg-white rounded-xl overflow-hidden shadow-inner p-4 text-black"
                dangerouslySetInnerHTML={{ __html: customHtml }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
