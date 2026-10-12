'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LayoutTemplate, Box, Mail, X, Eye } from 'lucide-react';
import Link from 'next/link';
import { updateCampaign } from '@/lib/services/marketingService';
import { useTranslation } from '@/contexts/TranslationContext';

const TABS = [
  { id: 'tuoi', label: 'I tuoi modelli', icon: LayoutTemplate },
  { id: 'base', label: 'Modelli di base', icon: Box },
  { id: 'pronto', label: 'Pronto all\'uso', icon: Mail },
];

const BASE_TEMPLATES = [
  { id: 'default', title: 'Modello predefinito', desc: 'Questo è il tuo titolo.', image: 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?auto=format&fit=crop&q=80&w=200' },
  { id: 'sell', title: 'Vendi un prodotto', desc: 'Attrezzatura essenziale per ogni avventura', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200' },
  { id: 'story', title: 'Racconta una storia', desc: 'Rendilo solo tuo', image: 'https://images.unsplash.com/photo-1455390582262-044cdead27d8?auto=format&fit=crop&q=80&w=200' },
  { id: 'event', title: 'Iscriviti a un evento', desc: 'Registrati per imparare dagli esperti', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=200' },
  { id: 'simple', title: 'Semplice', desc: 'Gentile cliente...', image: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?auto=format&fit=crop&q=80&w=200' },
];

export function TemplateSelectionView({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { t } = useTranslation();

  const tabs = [
    { id: 'tuoi', label: t.marketing.yourTemplates, icon: LayoutTemplate },
    { id: 'base', label: t.marketing.baseTemplates, icon: Box },
    { id: 'pronto', label: t.marketing.readyToUse, icon: Mail },
  ];
  const [activeTab, setActiveTab] = useState('base');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const handleSelectTemplate = async (templateId: string) => {
    // Save chosen template to campaign
    await updateCampaign(campaignId, { designHtml: `template_${templateId}` });
    
    // Navigate to editor
    const type = templateId === 'simple' ? 'simple' : 'dnd';
    router.push(`/marketing/editor/${campaignId}?type=${type}&template=${templateId}`);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-4">
          <Link href={`/marketing/campaigns/${campaignId}`} className="p-2 bg-white/5 rounded-full text-[#858585] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-medium">{t.marketing.createAnEmail}</h1>
        </div>
        <button 
          onClick={() => router.push(`/marketing/campaigns/${campaignId}`)}
          className="p-2 text-[#858585] hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 border-r border-[#1A1A1A] p-6 flex flex-col gap-6">
          <button onClick={() => setShowCreateModal(true)} className="w-full bg-[#1A1A1A] text-white py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#2A2A2A] transition-colors">
            {t.marketing.createFromScratch}
          </button>
          
          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-[#5A5A5A] mb-3">{t.marketing.yourEmail}</h3>
            <div className="flex items-center gap-2 text-sm text-[#C4C4C4] p-2">
              <Mail size={16} />
              <span>{t.marketing.campaignEmail}</span>
            </div>
          </div>

          <div>
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-[#5A5A5A] mb-3">{t.marketing.templates}</h3>
            <nav className="flex flex-col gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === tab.id ? 'bg-[#006AFF]/10 text-[#00A6FF]' : 'text-[#858585] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Templates Grid */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#0B0B0B]">
          {activeTab === 'base' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {BASE_TEMPLATES.map(template => (
                <div key={template.id} className="group relative flex flex-col bg-[#141414] border border-[#1A1A1A] rounded-2xl overflow-hidden hover:border-[#333] transition-colors">
                  <div className="aspect-square bg-white relative flex flex-col overflow-hidden">
                    
                    {/* Dynamic Thumbnail Content */}
                    <div className="w-full h-full transform scale-[0.75] origin-top flex flex-col gap-2 p-2 pointer-events-none">
                      
                      {template.id === 'default' && (
                        <div className="flex flex-col items-center gap-2 mt-4">
                          <div className="w-2/3 h-4 bg-gray-800 rounded"></div>
                          <div className="w-full h-24 bg-gray-200 rounded-lg overflow-hidden">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="w-1/2 h-3 bg-gray-800 rounded mt-2"></div>
                          <div className="w-full h-2 bg-gray-300 rounded"></div>
                          <div className="w-5/6 h-2 bg-gray-300 rounded"></div>
                          <div className="w-1/3 h-6 bg-blue-600 rounded-lg mt-2"></div>
                        </div>
                      )}

                      {template.id === 'sell' && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-full h-20 bg-gray-200 rounded-t-lg overflow-hidden -mx-2 -mt-2 w-[calc(100%+16px)]">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="w-3/4 h-4 bg-gray-800 rounded mt-2"></div>
                          <div className="w-full h-2 bg-gray-300 rounded"></div>
                          <div className="grid grid-cols-3 gap-2 w-full mt-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-full aspect-square bg-gray-100 rounded"></div>
                                <div className="w-3/4 h-1.5 bg-gray-800 rounded"></div>
                                <div className="w-full h-1 bg-gray-300 rounded"></div>
                                <div className="w-full h-3 bg-black rounded mt-1"></div>
                              </div>
                            ))}
                          </div>
                          <div className="w-full h-12 bg-gray-100 rounded-lg mt-2 flex flex-col items-center justify-center gap-1">
                            <div className="w-1/3 h-3 bg-gray-800 rounded"></div>
                            <div className="w-1/2 h-1.5 bg-gray-400 rounded"></div>
                          </div>
                        </div>
                      )}

                      {template.id === 'story' && (
                        <div className="flex flex-col gap-2">
                          <div className="w-full h-16 bg-gray-200 rounded-t-lg overflow-hidden -mx-2 -mt-2 w-[calc(100%+16px)]">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-1/2 h-16 bg-gray-200 rounded"></div>
                            <div className="w-1/2 flex flex-col gap-1.5">
                              <div className="w-full h-3 bg-gray-800 rounded"></div>
                              <div className="w-full h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-3/4 h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-1/3 h-1.5 bg-black rounded mt-1"></div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-row-reverse mt-2">
                            <div className="w-1/2 h-16 bg-gray-200 rounded"></div>
                            <div className="w-1/2 flex flex-col gap-1.5">
                              <div className="w-full h-3 bg-gray-800 rounded"></div>
                              <div className="w-full h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-5/6 h-1.5 bg-gray-300 rounded"></div>
                              <div className="w-1/3 h-1.5 bg-black rounded mt-1"></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {template.id === 'event' && (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-full h-16 bg-gray-200 rounded-t-lg overflow-hidden -mx-2 -mt-2 w-[calc(100%+16px)]">
                            <img src={template.image} className="w-full h-full object-cover" />
                          </div>
                          <div className="w-2/3 h-6 bg-black rounded-lg mt-2"></div>
                          <div className="w-full h-px bg-gray-200 my-1"></div>
                          <div className="w-1/2 h-3 bg-gray-800 rounded mt-1"></div>
                          <div className="grid grid-cols-3 gap-2 w-full mt-1">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                                <div className="w-3/4 h-1.5 bg-gray-800 rounded"></div>
                                <div className="w-1/2 h-1 bg-gray-400 rounded"></div>
                              </div>
                            ))}
                          </div>
                          <div className="w-1/2 h-4 bg-gray-800 rounded mt-2"></div>
                        </div>
                      )}

                      {template.id === 'simple' && (
                        <div className="flex flex-col gap-2 p-2 mt-4">
                          <div className="w-1/3 h-2 bg-gray-800 rounded mb-2"></div>
                          <div className="w-full h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-full h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-5/6 h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-full h-1.5 bg-gray-400 rounded mt-2"></div>
                          <div className="w-3/4 h-1.5 bg-gray-400 rounded"></div>
                          <div className="w-1/4 h-2 bg-gray-800 rounded mt-4"></div>
                          <div className="w-1/3 h-1.5 bg-blue-600 rounded mt-4"></div>
                        </div>
                      )}

                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
                      <button 
                        onClick={() => handleSelectTemplate(template.id)}
                        className="px-6 py-2 w-36 bg-white text-black rounded-full font-medium text-sm hover:bg-gray-200 transition-colors"
                      >
                        {t.marketing.useTemplate}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setPreviewTemplate(template); }}
                        className="px-6 py-2 w-36 bg-[#1A1A1A] text-white rounded-full font-medium text-sm hover:bg-[#2A2A2A] flex items-center justify-center gap-2 transition-colors border border-white/10"
                      >
                        <Eye size={16} /> {t.marketing.preview}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-[#141414] border-t border-[#1A1A1A]">
                    <h4 className="text-sm font-medium text-white mb-1">{template.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#858585]">
              <LayoutTemplate size={48} className="mb-4 opacity-20" />
              <p>{t.marketing.noTemplatesInCategory}</p>
            </div>
          )}
        </main>

      </div>
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[600px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-5">
              <h2 className="text-[17px] font-medium text-white">{t.marketing.createFromScratch}</h2>
              <button onClick={() => setShowCreateModal(false)} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </header>
            <div className="flex flex-col gap-4 p-6">
              <p className="text-[14px] text-[#A3A3A3] mb-2">{t.marketing.chooseHowToCreate}</p>
              
              <button 
                onClick={() => router.push(`/marketing/editor/${campaignId}?type=dnd`)}
                className="flex items-start gap-4 p-4 rounded-xl border border-[#1A1A1A] bg-[#141414] hover:border-[#0D6EFD]/50 hover:bg-[#0D6EFD]/5 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-[#1A1A1A] text-white group-hover:bg-[#0D6EFD]/20 group-hover:text-[#0D6EFD] transition-colors mt-0.5">
                  <LayoutTemplate size={20} />
                </div>
                <div>
                  <h3 className="text-[15px] font-medium text-white mb-1">{t.marketing.dragAndDropEditor}</h3>
                  <p className="text-[13px] text-[#858585]">{t.marketing.dragAndDropDesc}</p>
                </div>
              </button>

              <button 
                onClick={() => router.push(`/marketing/editor/${campaignId}?type=simple`)}
                className="flex items-start gap-4 p-4 rounded-xl border border-[#1A1A1A] bg-[#141414] hover:border-[#0D6EFD]/50 hover:bg-[#0D6EFD]/5 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-[#1A1A1A] text-white group-hover:bg-[#0D6EFD]/20 group-hover:text-[#0D6EFD] transition-colors mt-0.5">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-[15px] font-medium text-white mb-1">{t.marketing.simpleEditor}</h3>
                  <p className="text-[13px] text-[#858585]">{t.marketing.simpleEditorDesc}</p>
                </div>
              </button>

              <button 
                onClick={() => router.push(`/marketing/editor/${campaignId}?type=html`)}
                className="flex items-start gap-4 p-4 rounded-xl border border-[#1A1A1A] bg-[#141414] hover:border-[#0D6EFD]/50 hover:bg-[#0D6EFD]/5 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-[#1A1A1A] text-white group-hover:bg-[#0D6EFD]/20 group-hover:text-[#0D6EFD] transition-colors mt-0.5">
                  <Box size={20} />
                </div>
                <div>
                  <h3 className="text-[15px] font-medium text-white mb-1">{t.marketing.customHtmlCode}</h3>
                  <p className="text-[13px] text-[#858585]">{t.marketing.customHtmlDesc}</p>
                </div>
              </button>

            </div>
          </div>
        </div>
      )}

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
                {t.common.back}
              </button>
              <button 
                onClick={() => {
                  handleSelectTemplate(previewTemplate.id);
                  setPreviewTemplate(null);
                }}
                className="px-6 py-2 bg-[#1A1A1A] text-white rounded-full font-medium text-sm hover:bg-black transition-colors"
              >
                {t.marketing.useTemplate}
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
