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
import { generateEmailHtml } from '@/lib/utils/emailCompiler';

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
  {
    id: 'header_logo',
    label: 'Intestazione Semplice',
    blocks: [
      { type: 'image', content: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=50&fit=crop', style: { padding: '20px 0px', textAlign: 'center', backgroundColor: '#ffffff' } },
      { type: 'divider', content: '', style: {} }
    ]
  },
  {
    id: 'promo_banner',
    label: 'Banner Promozionale',
    blocks: [
      { type: 'title', content: 'SCONTO DEL 20%', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '40px 20px', textAlign: 'center', borderRadius: '8px' } },
      { type: 'text', content: 'Usa il codice PROMO20 al checkout.', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '0px 20px 40px', textAlign: 'center' } }
    ]
  },
  {
    id: 'article_preview',
    label: 'Articolo in evidenza',
    blocks: [
      { type: 'image', content: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=600', style: { padding: '0px 0px', borderRadius: '12px' } },
      { type: 'title', content: 'Titolo Articolo', style: { padding: '20px 0px 0px', textAlign: 'left' } },
      { type: 'text', content: 'Inserisci qui una breve descrizione dell\'articolo per invogliare i tuoi lettori a cliccare e leggere di più.', style: { padding: '10px 0px', textAlign: 'left', color: '#666666' } },
      { type: 'button', content: 'Leggi di più', style: { padding: '10px 0px 30px', textAlign: 'left' } }
    ]
  }
];

export function EmailEditorView({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editorType = searchParams.get('type') || 'dnd';
  const toast = useToast();

  const [activeMainTab, setActiveMainTab] = useState<'content' | 'style'>('content');
  const [activeSubTab, setActiveSubTab] = useState<'blocks' | 'sections' | 'saved'>('blocks');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Simple blocks state

  const templateId = searchParams.get('template');
  
  const initialBlocks = React.useMemo(() => {
    switch(templateId) {
      case 'sell':
        return [
          { id: '1', type: 'image', content: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '2', type: 'title', content: 'Nuova Collezione Invernale', style: { textAlign: 'center', padding: '20px 0 10px' } },
          { id: '3', type: 'text', content: 'Scopri i nostri ultimi arrivi...', style: { textAlign: 'center', padding: '0 0 20px', color: '#666666' } },
          { id: '4', type: 'button', content: 'Acquista la collezione', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '12px 24px', borderRadius: '8px' } },
          { id: 'div1', type: 'divider', content: '', style: {} },
          { id: 'p1_img', type: 'image', content: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400', style: { borderRadius: '8px' } },
          { id: 'p1_btn', type: 'button', content: 'Acquista Ora', style: { backgroundColor: '#1A1A1A', color: '#ffffff', padding: '10px 20px', borderRadius: '8px' } },
          { id: 'div2', type: 'divider', content: '', style: {} },
          { id: 'promo_title', type: 'title', content: 'PROMO20', style: { textAlign: 'center', padding: '20px', backgroundColor: '#F3F4F6', color: '#1A1A1A', borderRadius: '8px' } },
          { id: 'footer', type: 'text', content: 'Offerta valida fino al 31 Dicembre. Non cumulabile.', style: { textAlign: 'center', padding: '20px 0', color: '#999999' } }
        ];
      case 'story':
        return [
          { id: '1', type: 'image', content: 'https://images.unsplash.com/photo-1455390582262-044cdead27d8?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=400', style: { borderRadius: '8px' } },
          { id: '3', type: 'text', content: 'Tutto è iniziato con una semplice idea nel nostro piccolo ufficio...', style: { textAlign: 'left', padding: '20px 0', color: '#333333' } },
          { id: '4', type: 'title', content: 'Il nostro viaggio', style: { textAlign: 'left', padding: '10px 0' } },
          { id: '5', type: 'text', content: 'Negli anni abbiamo costruito una community fantastica...', style: { textAlign: 'left', padding: '0 0 20px', color: '#666666' } },
          { id: '6', type: 'image', content: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '7', type: 'title', content: 'Guardando al futuro', style: { textAlign: 'left', padding: '20px 0 10px' } },
          { id: '8', type: 'text', content: 'Siamo entusiasti di condividere con voi i prossimi passi.', style: { textAlign: 'left', padding: '0 0 20px', color: '#666666' } },
          { id: 'footer', type: 'text', content: 'Grazie per essere parte della nostra storia.', style: { textAlign: 'center', padding: '40px 0 20px', color: '#999999' } }
        ];
      case 'event':
        return [
          { id: '1', type: 'image', content: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '2', type: 'title', content: 'Tech Conference 2026', style: { textAlign: 'center', padding: '20px 0 10px' } },
          { id: '3', type: 'image', content: 'https://images.unsplash.com/photo-1551818255-e6e10975bc17?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '4', type: 'text', content: 'Unisciti a noi per 3 giorni di innovazione e networking a Milano.', style: { textAlign: 'center', padding: '20px 0', color: '#333333' } },
          { id: '5', type: 'button', content: 'Prenota un posto', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '12px 30px', borderRadius: '8px' } },
          { id: 'div1', type: 'divider', content: '', style: {} },
          { id: '6', type: 'title', content: 'Incontra i nostri relatori', style: { textAlign: 'center', padding: '20px 0' } },
          { id: 's1_img', type: 'image', content: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150', style: { borderRadius: '100px' } },
          { id: 's1_txt', type: 'text', content: '<b>Marco Rossi</b><br>CEO, TechCorp', style: { textAlign: 'center', padding: '10px 0 20px' } },
          { id: 's2_img', type: 'image', content: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150', style: { borderRadius: '100px' } },
          { id: 's2_txt', type: 'text', content: '<b>Giulia Bianchi</b><br>Senior Manager', style: { textAlign: 'center', padding: '10px 0 20px' } },
          { id: 's3_img', type: 'image', content: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150', style: { borderRadius: '100px' } },
          { id: 's3_txt', type: 'text', content: '<b>Luca Verdi</b><br>Lead Designer', style: { textAlign: 'center', padding: '10px 0 20px' } },
          { id: 'btn2', type: 'button', content: 'Vedi tutti i relatori', style: { backgroundColor: '#1A1A1A', color: '#ffffff', padding: '10px 20px', borderRadius: '8px' } },
          { id: 'footer', type: 'text', content: 'I posti sono limitati.', style: { textAlign: 'center', padding: '40px 0 20px', color: '#999999' } }
        ];
      case 'default':
      default:
        return [
          { id: '1', type: 'title', content: 'Il tuo titolo qui', style: { textAlign: 'center', padding: '20px 0' } },
          { id: '2', type: 'image', content: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&q=80&w=600', style: { borderRadius: '12px' } },
          { id: '3', type: 'title', content: 'Sottotitolo della sezione', style: { textAlign: 'center', padding: '20px 0 10px', fontSize: '20px' } },
          { id: '4', type: 'text', content: 'Inizia a scrivere qui il tuo testo principale...', style: { textAlign: 'center', padding: '0 0 20px', color: '#666666' } },
          { id: '5', type: 'button', content: 'Scopri di più', style: { backgroundColor: '#0D6EFD', color: '#ffffff', padding: '12px 24px', borderRadius: '8px' } }
        ];
    }
  }, [templateId]);

  const initialSimple = templateId === 'simple' ? 
    "Gentile cliente,\n\nQuesta email avrà l'aspetto di un'email personale da inviare al tuo pubblico. Non sono presenti immagini o elementi grafici e non contiene formattazione. In questo modo, i lettori potranno concentrarsi sul messaggio email senza distrazioni.\n\nCordiali saluti,\n<b>La tua azienda</b>\n\n<a href='#'>Annulla l'iscrizione</a>" : 
    '<p>Caro cliente,</p><p>Questo è un messaggio semplice.</p>';

  const [blocks, setBlocks] = useState<any[]>(initialBlocks);
  const [simpleHtml, setSimpleHtml] = useState(initialSimple);
  const [customHtml, setCustomHtml] = useState('<html>\n  <body>\n    <h1>Hello World</h1>\n  </body>\n</html>');

  const addBlock = (type: string, content?: string) => {
    setBlocks([...blocks, { id: Math.random().toString(), type, content: content || getDefaultContent(type), style: {} }]);
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

  

  const addSection = (sectionBlocks: any[]) => {
    const newBlocks = sectionBlocks.map(b => ({
      ...b,
      id: Math.random().toString()
    }));
    setBlocks([...blocks, ...newBlocks]);
  };

  const updateBlockStyle = (id: string, styleUpdates: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, style: { ...(b.style || {}), ...styleUpdates } } : b));
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
    let finalHtml = '';
    if (editorType === 'simple') {
      // Basic wrapper for simple RTF
      finalHtml = `<!DOCTYPE html><html><body>${simpleHtml.replace(/\n/g, '<br>')}</body></html>`;
    } else if (editorType === 'html') {
      finalHtml = customHtml;
    } else {
      // Compile D&D blocks into responsive email tables
      finalHtml = generateEmailHtml(blocks);
    }

    await updateCampaign(campaignId, { designHtml: finalHtml });
    toast.success('Modello email salvato correttamente.');
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
          <React.Fragment>
            <div className="w-20 border-r border-white/10 bg-[#0A0A0A] flex flex-col items-center py-4 gap-2">
              <button 
                onClick={() => setActiveMainTab('content')}
                className={`flex flex-col items-center justify-center w-14 h-14 rounded-xl gap-1 transition-colors ${activeMainTab === 'content' ? 'bg-[#0D6EFD]/10 text-[#0D6EFD]' : 'text-[#858585] hover:text-white hover:bg-white/5'}`}
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
                                      className="aspect-[3/2] bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-grab hover:bg-[#1A1A1A] transition-all group"
                                      style={{...provided.draggableProps.style, opacity: snapshot.isDragging ? 0.5 : 1}}
                                    >
                                      <div className="text-[#858585] group-hover:text-[#0D6EFD] transition-colors">
                                        <block.icon size={24} strokeWidth={1.5} />
                                      </div>
                                      <span className="text-[11px] font-medium text-[#858585] group-hover:text-white">{block.label}</span>
                                    </div>
                                    {snapshot.isDragging && (
                                      <div className="aspect-[3/2] bg-[#141414] border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-50">
                                        <div className="text-[#858585]">
                                          <block.icon size={24} strokeWidth={1.5} />
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
                      <div className="flex flex-col gap-4">
                        {SECTIONS.map(section => (
                          <div 
                            key={section.id}
                            onClick={() => addSection(section.blocks)}
                            className="bg-[#141414] border border-white/5 hover:border-[#0D6EFD]/50 rounded-xl overflow-hidden cursor-pointer hover:bg-[#1A1A1A] transition-all group"
                          >
                            {/* Visual Preview generation based on the blocks */}
                            <div className="bg-[#1A1A1A] p-4 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                              <div className="bg-white rounded overflow-hidden flex flex-col gap-1 p-2 scale-90 origin-top">
                                {section.blocks.map((b, i) => (
                                  <div key={i} className="w-full flex justify-center">
                                    {b.type === 'image' && <div className="w-full h-12 bg-gray-200 rounded flex items-center justify-center text-[8px] text-gray-400">IMG</div>}
                                    {b.type === 'title' && <div className="w-3/4 h-3 bg-gray-800 rounded"></div>}
                                    {b.type === 'text' && <div className="w-full h-8 bg-gray-300 rounded"></div>}
                                    {b.type === 'button' && <div className="w-16 h-4 bg-blue-500 rounded-full mt-1"></div>}
                                    {b.type === 'divider' && <div className="w-full h-px bg-gray-200 my-1"></div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="p-3 border-t border-white/5">
                              <span className="text-[13px] font-medium text-white">{section.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

              {activeMainTab === 'style' && (
                <div className="flex-1 flex flex-col bg-[#0A0A0A] overflow-y-auto">
                  {!selectedBlockId ? (
                    <div className="p-6 text-center text-[#858585] text-sm mt-10">
                      <Palette size={32} className="mx-auto mb-4 opacity-50" />
                      Seleziona un blocco nell'anteprima per modificarne lo stile.
                    </div>
                  ) : (
                    <div className="p-5 flex flex-col gap-6">
                      <h3 className="text-sm font-medium text-white border-b border-white/10 pb-3">Proprietà Blocco</h3>
                      
                      {(() => {
                        const block = blocks.find(b => b.id === selectedBlockId);
                        if (!block) return null;
                        const style = block.style || {};

                        return (
                          <>
                            {/* Background */}
                            <div className="flex flex-col gap-2">
                              <label className="text-xs text-[#858585]">Colore Sfondo</label>
                              <div className="flex items-center gap-3">
                                <input 
                                  type="color" 
                                  value={style.backgroundColor || '#ffffff'} 
                                  onChange={(e) => updateBlockStyle(selectedBlockId, { backgroundColor: e.target.value })}
                                  className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                                />
                                <span className="text-sm">{style.backgroundColor || '#ffffff'}</span>
                              </div>
                            </div>

                            {/* Text Color */}
                            <div className="flex flex-col gap-2">
                              <label className="text-xs text-[#858585]">Colore Testo</label>
                              <div className="flex items-center gap-3">
                                <input 
                                  type="color" 
                                  value={style.color || '#000000'} 
                                  onChange={(e) => updateBlockStyle(selectedBlockId, { color: e.target.value })}
                                  className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                                />
                                <span className="text-sm">{style.color || '#000000'}</span>
                              </div>
                            </div>

                            {/* Alignment */}
                            <div className="flex flex-col gap-2">
                              <label className="text-xs text-[#858585]">Allineamento Testo</label>
                              <div className="flex bg-[#141414] rounded-lg p-1 border border-white/10">
                                {['left', 'center', 'right', 'justify'].map(align => (
                                  <button 
                                    key={align}
                                    onClick={() => updateBlockStyle(selectedBlockId, { textAlign: align })}
                                    className={`flex-1 py-1.5 text-xs rounded transition-colors ${style.textAlign === align ? 'bg-[#2A2A2A] text-white shadow-sm' : 'text-[#858585] hover:text-white'}`}
                                  >
                                    {align.charAt(0).toUpperCase() + align.slice(1)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Padding */}
                            <div className="flex flex-col gap-2">
                              <label className="text-xs text-[#858585]">Spaziatura Interna (Padding)</label>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center bg-[#141414] border border-white/10 rounded-lg px-3 py-2">
                                  <span className="text-[10px] text-[#858585] w-6">T/B</span>
                                  <input 
                                    type="number" 
                                    placeholder="0"
                                    value={parseInt(style.padding?.split(' ')?.[0] || '0')}
                                    onChange={(e) => {
                                      const v = e.target.value || '0';
                                      const currentLR = style.padding?.split(' ')?.[1] || '0px';
                                      updateBlockStyle(selectedBlockId, { padding: `${v}px ${currentLR}` });
                                    }}
                                    className="bg-transparent w-full text-sm text-white outline-none"
                                  />
                                </div>
                                <div className="flex items-center bg-[#141414] border border-white/10 rounded-lg px-3 py-2">
                                  <span className="text-[10px] text-[#858585] w-6">L/R</span>
                                  <input 
                                    type="number" 
                                    placeholder="0"
                                    value={parseInt(style.padding?.split(' ')?.[1] || '0')}
                                    onChange={(e) => {
                                      const v = e.target.value || '0';
                                      const currentTB = style.padding?.split(' ')?.[0] || '0px';
                                      updateBlockStyle(selectedBlockId, { padding: `${currentTB} ${v}px` });
                                    }}
                                    className="bg-transparent w-full text-sm text-white outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                            
                            {/* Border Radius */}
                            <div className="flex flex-col gap-2">
                              <label className="text-xs text-[#858585]">Angoli Arrotondati (Radius)</label>
                              <div className="flex items-center bg-[#141414] border border-white/10 rounded-lg px-3 py-2">
                                <input 
                                  type="number" 
                                  placeholder="0"
                                  value={parseInt(style.borderRadius || '0')}
                                  onChange={(e) => updateBlockStyle(selectedBlockId, { borderRadius: `${e.target.value || 0}px` })}
                                  className="bg-transparent w-full text-sm text-white outline-none"
                                />
                                <span className="text-[10px] text-[#858585]">px</span>
                              </div>
                            </div>
                            
                          </>
                        );
                      })()}

                    </div>
                  )}
                </div>
              )}

            <div className="flex-1 bg-[#050505] overflow-y-auto relative py-12 px-4 flex justify-center items-start" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
              <Droppable droppableId="canvas">
                {(provided, snapshot) => (
                  <div 
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    onClick={() => { setSelectedBlockId(null); setActiveMainTab('content'); }}
                    className={`w-full max-w-[600px] bg-white min-h-[800px] h-fit shadow-2xl rounded-sm p-8 flex flex-col gap-4 ${snapshot.isDraggingOver ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}`}
                  >
                    {blocks.map((block, index) => (
                      <Draggable key={block.id} draggableId={block.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); setActiveMainTab('style'); }}
                            style={block.style || {}}
                            className={`relative group border-2 ${selectedBlockId === block.id ? 'border-blue-500' : 'border-transparent'} hover:border-blue-300 rounded transition-colors bg-white ${snapshot.isDragging ? 'shadow-xl scale-105 z-50' : ''}`}
                          >
                            <button onClick={() => removeBlock(block.id)} className="absolute -right-2 -top-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <Trash2 size={12} />
                            </button>
                            {block.type === 'title' && (
                              <input 
                                value={block.content} 
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-full text-3xl font-bold bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2" style={{ color: "inherit", textAlign: "inherit" }}
                              />
                            )}
                            {block.type === 'text' && (
                              <textarea 
                                value={block.content} 
                                onChange={(e) => updateBlock(block.id, e.target.value)}
                                className="w-full text-sm bg-transparent border-none outline-none focus:bg-gray-50 rounded p-2 min-h-[100px] resize-none" style={{ color: "inherit", textAlign: "inherit" }}
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
                                  className="bg-[#1A1A1A] text-white px-8 py-3 rounded-lg font-medium border-none outline-none focus:ring-2 focus:ring-blue-500 pointer-events-none" style={{ color: "inherit" }}
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
                    </React.Fragment>
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
              {/* sandbox vuoto: niente script, origine separata dall'app */}
              <iframe
                title="Anteprima email"
                sandbox=""
                srcDoc={customHtml}
                className="flex-1 bg-white rounded-xl overflow-hidden shadow-inner w-full border-0"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
