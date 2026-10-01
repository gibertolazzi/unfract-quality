import re

with open('components/marketing/TemplateSelectionView.tsx', 'r') as f:
    content = f.read()

# Add state for preview template
state_search = "const [showCreateModal, setShowCreateModal] = useState(false);"
state_replace = """const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);"""
content = content.replace(state_search, state_replace)

# Add Eye icon import
import_search = "import { ArrowLeft, X, Mail, LayoutTemplate, Box } from 'lucide-react';"
import_replace = "import { ArrowLeft, X, Mail, LayoutTemplate, Box, Eye } from 'lucide-react';"
content = content.replace(import_search, import_replace)

# Modify the hover overlay in the template card
old_overlay = """                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <button 
                        onClick={() => handleSelectTemplate(template.id)}
                        className="px-6 py-2 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 transition-colors"
                      >
                        Usa modello
                      </button>
                    </div>"""

new_overlay = """                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                      <button 
                        onClick={() => handleSelectTemplate(template.id)}
                        className="px-6 py-2 w-36 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 transition-colors"
                      >
                        Usa modello
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template); }}
                        className="px-6 py-2 w-36 bg-[#1A1A1A] text-white rounded-full font-medium text-sm hover:bg-[#2A2A2A] flex items-center justify-center gap-2 transition-colors border border-white/10"
                      >
                        <Eye size={16} /> Anteprima
                      </button>
                    </div>"""
content = content.replace(old_overlay, new_overlay)

# Add preview modal at the end of the file
old_end = """      )}

    </div>
  );
}"""

new_end = """      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[800px] h-[85vh] flex-col overflow-hidden rounded-2xl bg-[#f6f6f6] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 shrink-0">
              <h2 className="text-xl font-semibold text-gray-800">{previewTemplate.title}</h2>
              <button onClick={() => setPreviewTemplate(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </header>
            
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-[#f6f6f6]">
              {/* Fake Email Body Container */}
              <div className="w-full max-w-[600px] bg-white rounded shadow-sm border border-gray-100 overflow-hidden text-black h-fit min-h-full">
                
                {previewTemplate.id === 'simple' && (
                  <div className="p-12 text-[15px] text-gray-700 leading-relaxed font-sans">
                    <p className="mb-6">Gentile cliente,</p>
                    <p className="mb-6">Questa email avrà l'aspetto di un'email personale da inviare al tuo pubblico. Non sono presenti immagini o elementi grafici e non contiene formattazione. In questo modo, i lettori potranno concentrarsi sul messaggio email senza distrazioni.</p>
                    <p className="mb-8">Cordiali saluti,<br/><b>La tua azienda</b></p>
                    <a href="#" className="text-blue-600 underline">Fai clic qui per annullare l'iscrizione</a>
                  </div>
                )}

                {previewTemplate.id === 'sell' && (
                  <div className="flex flex-col text-center font-sans">
                    <div className="h-[250px] bg-gray-100 w-full object-cover">
                      <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-8">
                      <h2 className="text-3xl font-bold mb-4 text-gray-900">Nuova Collezione Invernale</h2>
                      <p className="text-gray-500 mb-8 leading-relaxed">Scopri i nostri ultimi arrivi, pensati per accompagnarti in ogni momento della giornata unendo comfort e stile.</p>
                      
                      <div className="grid grid-cols-3 gap-6 mb-10">
                        {[1,2,3].map(i => (
                          <div key={i} className="flex flex-col items-center">
                            <div className="w-full aspect-square bg-gray-50 rounded-lg mb-4 flex items-center justify-center p-4">
                              <img src="https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=200" className="mix-blend-multiply opacity-80" />
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg mb-2">Il tuo prodotto</h3>
                            <p className="text-xs text-gray-500 mb-4 line-clamp-3">Descrivi i vantaggi del tuo prodotto in una breve frase.</p>
                            <button className="w-full bg-[#1A1A1A] text-white py-2.5 rounded font-medium text-sm">Acquista ora</button>
                          </div>
                        ))}
                      </div>

                      <div className="bg-gray-50 p-6 rounded-xl">
                        <h2 className="text-2xl font-black tracking-widest mb-2">PROMO20</h2>
                        <p className="text-sm text-gray-500">Usa il codice al checkout. Valido fino al 31 Dicembre.</p>
                      </div>
                    </div>
                  </div>
                )}

                {previewTemplate.id === 'event' && (
                  <div className="flex flex-col text-center font-sans">
                    <div className="h-[200px] bg-gray-100 w-full object-cover">
                      <img src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=600" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-10">
                      <button className="bg-black text-white px-8 py-3 rounded text-sm font-bold tracking-wide uppercase mb-10">Prenota un posto</button>
                      
                      <hr className="border-gray-200 mb-8" />
                      
                      <h2 className="text-2xl font-bold text-gray-900 mb-8">Incontra i nostri relatori</h2>
                      <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="flex flex-col items-center">
                          <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=150" className="w-24 h-24 rounded-full object-cover mb-3" />
                          <div className="font-bold text-gray-900">Marco Rossi</div>
                          <div className="text-sm text-gray-500">Cofondatore</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150" className="w-24 h-24 rounded-full object-cover mb-3" />
                          <div className="font-bold text-gray-900">Giulia Bianchi</div>
                          <div className="text-sm text-gray-500">Senior Manager</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <img src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=150" className="w-24 h-24 rounded-full object-cover mb-3" />
                          <div className="font-bold text-gray-900">Luca Verdi</div>
                          <div className="text-sm text-gray-500">Design Lead</div>
                        </div>
                      </div>
                      
                      <button className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded font-medium text-sm">Vedi tutti i relatori</button>
                    </div>
                  </div>
                )}

                {previewTemplate.id === 'story' && (
                  <div className="flex flex-col font-sans">
                    <div className="h-[250px] bg-gray-100 w-full object-cover">
                      <img src="https://images.unsplash.com/photo-1455390582262-044cdead27d8?auto=format&fit=crop&q=80&w=600" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-10 flex flex-col gap-10">
                      
                      <div className="flex items-center gap-8">
                        <div className="w-1/2">
                          <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=400" className="w-full rounded-lg shadow-sm" />
                        </div>
                        <div className="w-1/2">
                          <h2 className="text-2xl font-bold mb-3 text-gray-900">Rendilo solo tuo</h2>
                          <p className="text-sm text-gray-600 leading-relaxed mb-4">Ogni giorno, le persone trovano nuovi modi per ottenere di più dal nostro prodotto. Perché non dedichi qualche istante a perfezionare la configurazione?</p>
                          <a href="#" className="font-bold underline text-black">Inizia</a>
                        </div>
                      </div>

                      <div className="flex items-center gap-8 flex-row-reverse">
                        <div className="w-1/2">
                          <img src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=400" className="w-full rounded-lg shadow-sm" />
                        </div>
                        <div className="w-1/2">
                          <h2 className="text-2xl font-bold mb-3 text-gray-900">Cresci con noi</h2>
                          <p className="text-sm text-gray-600 leading-relaxed mb-4">Abbiamo costruito una community globale fantastica. Entra a farne parte e scopri tutti i vantaggi esclusivi.</p>
                          <a href="#" className="font-bold underline text-black">Scopri di più</a>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {previewTemplate.id === 'default' && (
                  <div className="flex flex-col text-center font-sans p-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">Modello predefinito</h1>
                    <img src="https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&q=80&w=600" className="w-full rounded-lg mb-8 shadow-sm" />
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Il tuo sottotitolo qui</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed max-w-md mx-auto">Scrivi un testo accattivante per descrivere il tuo prodotto o servizio in modo chiaro e diretto.</p>
                    <button className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium mx-auto">Scopri di più</button>
                  </div>
                )}

              </div>
            </div>

            <footer className="border-t border-gray-200 bg-white px-6 py-4 flex justify-end gap-3 shrink-0 rounded-b-2xl">
              <button 
                onClick={() => setPreviewTemplate(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-full font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                Indietro
              </button>
              <button 
                onClick={() => {
                  handleSelectTemplate(previewTemplate.id);
                  setPreviewTemplate(null);
                }}
                className="px-6 py-2 bg-[#1A1A1A] text-white rounded-full font-medium text-sm hover:bg-black transition-colors"
              >
                Usa modello
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}"""

content = content.replace(old_end, new_end)

with open('components/marketing/TemplateSelectionView.tsx', 'w') as f:
    f.write(content)

print("Preview patched")
