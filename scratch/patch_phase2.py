import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# 1. Add selectedBlockId state
if 'const [selectedBlockId' not in content:
    content = content.replace(
        "const [activeSubTab, setActiveSubTab] = useState<'blocks' | 'sections' | 'saved'>('blocks');",
        "const [activeSubTab, setActiveSubTab] = useState<'blocks' | 'sections' | 'saved'>('blocks');\n  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);"
    )

# 2. Add updateBlockStyle function
if 'const updateBlockStyle' not in content:
    update_func = """
  const updateBlockStyle = (id: string, styleUpdates: any) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, style: { ...(b.style || {}), ...styleUpdates } } : b));
  };
"""
    content = content.replace(
        "const updateBlock = (id: string, content: string) => {",
        update_func + "\n  const updateBlock = (id: string, content: string) => {"
    )

# 3. Canvas click and styling
content = content.replace(
    "className={`relative group border-2 border-transparent hover:border-blue-300 rounded p-2 transition-colors bg-white ${snapshot.isDragging ? 'shadow-xl scale-105 z-50' : ''}`}",
    "onClick={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); setActiveMainTab('style'); }}\n                            style={block.style || {}}\n                            className={`relative group border-2 ${selectedBlockId === block.id ? 'border-blue-500' : 'border-transparent'} hover:border-blue-300 rounded transition-colors bg-white ${snapshot.isDragging ? 'shadow-xl scale-105 z-50' : ''}`}"
)

# 4. Canvas background click to deselect
# We need to add onClick={() => setSelectedBlockId(null)} to the canvas background
content = content.replace(
    "className={`w-full max-w-[600px] bg-white min-h-[800px] h-fit shadow-2xl rounded-sm p-8 flex flex-col gap-4 ${snapshot.isDraggingOver ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}`}",
    "onClick={() => { setSelectedBlockId(null); setActiveMainTab('content'); }}\n                    className={`w-full max-w-[600px] bg-white min-h-[800px] h-fit shadow-2xl rounded-sm p-8 flex flex-col gap-4 ${snapshot.isDraggingOver ? 'ring-2 ring-blue-500 bg-blue-50/10' : ''}`}"
)

# 5. Properties panel
old_style_tab = """          {activeMainTab === 'style' && (
            <div className="p-6 text-center text-[#858585]">
              Impostazioni stile globali (Colori, Font, Sfondo)
            </div>
          )}"""

new_style_tab = """          {activeMainTab === 'style' && (
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
          )}"""

content = content.replace(old_style_tab, new_style_tab)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)

print("Phase 2 Patched")
