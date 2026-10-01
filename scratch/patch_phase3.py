import re

with open('components/marketing/EmailEditorView.tsx', 'r') as f:
    content = f.read()

# 1. Replace the old SECTIONS array
old_sections = """const SECTIONS = [
  { id: 'header', label: 'Intestazione (Logo)', type: 'image', content: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&h=50&fit=crop' },
  { id: 'text_image', label: 'Testo + Immagine', type: 'text_image' },
  { id: 'signature', label: 'Firma', type: 'text', content: 'Cordiali saluti,\\nIl team di Meyou' }
];"""

new_sections = """const SECTIONS = [
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
      { type: 'text', content: 'Inserisci qui una breve descrizione dell\\'articolo per invogliare i tuoi lettori a cliccare e leggere di più.', style: { padding: '10px 0px', textAlign: 'left', color: '#666666' } },
      { type: 'button', content: 'Leggi di più', style: { padding: '10px 0px 30px', textAlign: 'left' } }
    ]
  }
];"""

content = content.replace(old_sections, new_sections)

# 2. Update addBlock function to handle section insertions or create addSection
add_section_func = """
  const addSection = (sectionBlocks: any[]) => {
    const newBlocks = sectionBlocks.map(b => ({
      ...b,
      id: Math.random().toString()
    }));
    setBlocks([...blocks, ...newBlocks]);
  };
"""

# Insert addSection after addBlock
content = content.replace(
    "  const updateBlockStyle = (id: string, styleUpdates: any) => {",
    add_section_func + "\n  const updateBlockStyle = (id: string, styleUpdates: any) => {"
)

# Also clean up the old 'text_image' hack in addBlock since we don't need it
old_add_block = """  const addBlock = (type: string, content?: string) => {
    if (type === 'text_image') {
      setBlocks([...blocks, 
        { id: Math.random().toString(), type: 'text', content: 'Testo della sezione...' },
        { id: Math.random().toString(), type: 'image', content: 'https://images.unsplash.com/photo-1455390582262-044cdead27d8?auto=format&fit=crop&q=80&w=400' }
      ]);
    } else {
      setBlocks([...blocks, { id: Math.random().toString(), type, content: content || getDefaultContent(type) }]);
    }
  };"""

new_add_block = """  const addBlock = (type: string, content?: string) => {
    setBlocks([...blocks, { id: Math.random().toString(), type, content: content || getDefaultContent(type), style: {} }]);
  };"""

content = content.replace(old_add_block, new_add_block)


# 3. Update the UI for Sections tab
old_sections_ui = """                    {activeSubTab === 'sections' && (
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
                    )}"""

new_sections_ui = """                    {activeSubTab === 'sections' && (
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
                    )}"""

content = content.replace(old_sections_ui, new_sections_ui)

with open('components/marketing/EmailEditorView.tsx', 'w') as f:
    f.write(content)

print("Phase 3 Patched")
