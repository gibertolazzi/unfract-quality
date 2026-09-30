'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCampaign, updateCampaign } from '@/lib/services/marketingService';
import { EmailCampaign } from '@/types/marketing';
import { CheckCircle2, Circle, ChevronRight, Loader2, ArrowLeft, X, Plus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCrm } from '@/contexts/CrmContext';

export function CampaignSetupView({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { contacts, customers, customLists, loading: crmLoading } = useCrm();
  
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [editingSender, setEditingSender] = useState(false);
  const [editingRecipients, setEditingRecipients] = useState(false);
  const [editingSubject, setEditingSubject] = useState(false);
  const [editingAdvanced, setEditingAdvanced] = useState(false);

  // Form states
  const [senderForm, setSenderForm] = useState({ name: '', email: '' });
  const [subjectForm, setSubjectForm] = useState('');
  const [recipientsForm, setRecipientsForm] = useState<string[]>([]);
  const [advancedForm, setAdvancedForm] = useState<any>({});
  const [recipientTab, setRecipientTab] = useState<'liste' | 'segmenti' | 'contatti'>('liste');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchCampaign = async () => {
      const data = await getCampaign(campaignId);
      if (data) {
        if (!data.sender && user) {
          const defaultSender = { name: user.displayName || 'MeYou Srl', email: user.email || '' };
          await updateCampaign(campaignId, { sender: defaultSender });
          data.sender = defaultSender;
        }
        setCampaign(data);
        setSenderForm(data.sender || { name: '', email: '' });
        setSubjectForm(data.subject || '');
        setRecipientsForm(data.recipients || []);
      }
      setLoading(false);
    };
    fetchCampaign();
  }, [campaignId, user]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-[#858585]" /></div>;
  }

  if (!campaign) {
    return <div className="p-8 text-[#858585]">Campagna non trovata.</div>;
  }

  const isSenderComplete = !!campaign.sender?.email;
  const isRecipientsComplete = !!campaign.recipients && campaign.recipients.length > 0;
  const isSubjectComplete = !!campaign.subject;
  const isDesignComplete = !!campaign.designHtml;

  const handleSaveSender = async () => {
    if (!senderForm.name || !senderForm.email) {
      toast.error('Compila tutti i campi del mittente.');
      return;
    }
    await updateCampaign(campaign.id, { sender: senderForm });
    setCampaign({ ...campaign, sender: senderForm });
    setEditingSender(false);
    toast.success('Mittente aggiornato');
  };

  const handleSaveSubject = async () => {
    if (!subjectForm) {
      toast.error("L'oggetto è obbligatorio.");
      return;
    }
    await updateCampaign(campaign.id, { subject: subjectForm });
    setCampaign({ ...campaign, subject: subjectForm });
    setEditingSubject(false);
    toast.success('Oggetto aggiornato');
  };

  const handleSaveAdvanced = async () => {
    await updateCampaign(campaign.id, { advancedSettings: advancedForm });
    setCampaign({ ...campaign, advancedSettings: advancedForm });
    setEditingAdvanced(false);
    toast.success('Impostazioni aggiornate');
  };

  const handleSaveRecipients = async () => {
    if (recipientsForm.length === 0) {
      toast.error('Seleziona almeno un gruppo di destinatari.');
      return;
    }
    await updateCampaign(campaign.id, { recipients: recipientsForm });
    setCampaign({ ...campaign, recipients: recipientsForm });
    setEditingRecipients(false);
    toast.success('Destinatari aggiornati');
  };

  return (
    <div className="flex flex-col h-full w-full max-w-[900px] mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          <Link href="/marketing" className="p-2 bg-black border border-[#1A1A1A] hover:border-[#2A2A2A] rounded-xl text-[#858585] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-[13px] text-[#858585] mb-1 font-medium tracking-wide">
              <Link href="/marketing" className="hover:text-white transition-colors">CAMPAGNE</Link>
              <ChevronRight size={14} />
              <span className="text-[#00A6FF]">CREAZIONE</span>
            </div>
            <h1 className="text-[28px] font-semibold text-white tracking-tight">{campaign.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-5 py-2.5 bg-black border border-[#1A1A1A] hover:border-[#2A2A2A] rounded-xl text-[13px] text-white font-medium transition-colors shadow-sm">
            Aggiungi lingue
          </button>
          <button 
            disabled={!(isSenderComplete && isRecipientsComplete && isSubjectComplete && isDesignComplete)}
            className="px-6 py-2.5 bg-[#006AFF] text-white text-[13px] font-medium rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Programma o Invia
          </button>
        </div>
      </div>

      {/* Steps Container */}
      <div className="bg-[#0B0B0B] border border-[#1A1A1A] rounded-[24px] flex flex-col shadow-sm">
        
        {/* Step 1: Mittente */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-7 border-b border-[#1A1A1A] gap-4">
          <div className="flex items-start gap-4">
            {isSenderComplete ? <CheckCircle2 size={24} className="text-[#00FF38] shrink-0 mt-0.5" /> : <Circle size={24} className="text-[#333] shrink-0 mt-0.5" />}
            <div>
              <h3 className="text-[17px] font-medium text-white mb-1">Mittente</h3>
              {isSenderComplete ? (
                <p className="text-[14px] text-[#858585]">{campaign.sender?.name} <span className="mx-1">•</span> {campaign.sender?.email}</p>
              ) : (
                <p className="text-[14px] text-[#858585]">Da chi verrà inviata la campagna?</p>
              )}
            </div>
          </div>
          <button 
            onClick={() => {
              setSenderForm(campaign.sender || { name: '', email: '' });
              setEditingSender(true);
            }}
            className="px-5 py-2.5 bg-black border border-[#1A1A1A] hover:border-[#2A2A2A] rounded-xl text-[13px] text-white font-medium transition-colors shrink-0 shadow-sm"
          >
            Gestisci mittente
          </button>
        </div>

        {/* Step 2: Destinatari */}
        <div className={`flex flex-col p-7 border-b border-[#1A1A1A] transition-all duration-300 ${editingRecipients ? 'bg-[#111111] shadow-2xl rounded-[20px] mx-[-4px] my-[-4px] z-10 border border-[#2A2A2A]' : ''}`}>
          {!editingRecipients ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                {isRecipientsComplete ? <CheckCircle2 size={24} className="text-[#00FF38] shrink-0 mt-0.5" /> : <Circle size={24} className="text-[#333] shrink-0 mt-0.5" />}
                <div>
                  <h3 className="text-[17px] font-medium text-white mb-1">Destinatari</h3>
                  {isRecipientsComplete ? (
                    <p className="text-[14px] text-[#858585]">{campaign.recipients?.length} gruppi selezionati</p>
                  ) : (
                    <p className="text-[14px] text-[#858585]">Le persone che ricevono la tua campagna</p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => {
                  setRecipientsForm(campaign.recipients || []);
                  setEditingRecipients(true);
                }}
                className="px-5 py-2.5 bg-black border border-[#1A1A1A] hover:border-[#2A2A2A] rounded-xl text-[13px] text-white font-medium transition-colors shrink-0 shadow-sm"
              >
                Aggiungi destinatari
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <Circle size={24} className="text-[#333] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-[17px] font-medium text-white mb-1">Destinatari</h3>
                    <p className="text-[14px] text-[#858585]">Le persone che ricevono la tua campagna</p>
                  </div>
                </div>
                <button onClick={() => { setEditingRecipients(false); setRecipientDropdownOpen(false); }} className="p-1.5 rounded-lg text-[#858585] hover:bg-white/5 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="pl-[40px] flex flex-col gap-4">
                <div className="flex flex-col gap-2 relative">
                  <label className="text-[13px] font-medium text-white">Invia a</label>
                  
                  {/* Select Trigger */}
                  <button 
                    onClick={() => setRecipientDropdownOpen(!recipientDropdownOpen)}
                    className={`w-full flex items-center justify-between border rounded-xl px-4 py-3 text-sm text-left transition-colors focus:outline-none ${recipientDropdownOpen ? 'bg-[#0B0B0B] border-[#006AFF] text-white' : 'bg-black border-[#1A1A1A] text-[#A3A3A3] hover:bg-[#0F0F0F] hover:border-[#2A2A2A]'}`}
                  >
                    <span>{recipientsForm.length > 0 ? `${recipientsForm.length} selezionati` : 'Seleziona lista(e), segmento(i) o contatti individuali'}</span>
                    <ChevronRight size={16} className={`transition-transform duration-200 ${recipientDropdownOpen ? 'rotate-90 text-[#006AFF]' : ''}`} />
                  </button>

                  {/* Dropdown Popover */}
                  {recipientDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#0B0B0B] border border-[#1A1A1A] rounded-xl shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                      
                      {/* Search */}
                      <div className="p-3 border-b border-[#1A1A1A]">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                          </span>
                          <input 
                            type="text" 
                            placeholder="Cerca"
                            value={recipientSearch}
                            onChange={(e) => setRecipientSearch(e.target.value)}
                            className="w-full bg-[#111111] border border-[#1A1A1A] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#006AFF] transition-colors"
                          />
                        </div>
                      </div>
                      
                      {/* Tabs */}
                      <div className="flex items-center px-2 pt-1 border-b border-[#1A1A1A]">
                        <button onClick={() => setRecipientTab('liste')} className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] transition-colors ${recipientTab === 'liste' ? 'border-[#006AFF] text-white' : 'border-transparent text-[#858585] hover:text-[#A3A3A3]'}`}>
                          Liste
                        </button>
                        <button onClick={() => setRecipientTab('segmenti')} className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] transition-colors ${recipientTab === 'segmenti' ? 'border-[#006AFF] text-white' : 'border-transparent text-[#858585] hover:text-[#A3A3A3]'}`}>
                          Segmenti
                        </button>
                        <button onClick={() => setRecipientTab('contatti')} className={`px-4 py-2.5 text-[13px] font-medium border-b-[2px] transition-colors ${recipientTab === 'contatti' ? 'border-[#006AFF] text-white' : 'border-transparent text-[#858585] hover:text-[#A3A3A3]'}`}>
                          Contatti individuali
                        </button>
                      </div>
                      
                      {/* Content Area */}
                      <div className="max-h-[260px] overflow-y-auto p-2">
                        {recipientTab === 'liste' && (
                          <div className="flex flex-col">
                            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                              <input type="checkbox" checked={recipientsForm.includes('all')} onChange={(e) => { if (e.target.checked) setRecipientsForm([...recipientsForm, 'all']); else setRecipientsForm(recipientsForm.filter(r => r !== 'all')); }} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                              <span className="text-[13px] text-[#E5E5E5] flex items-center gap-2 group-hover:text-white transition-colors">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#858585] group-hover:text-[#A3A3A3]"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                Tutti i contatti CRM
                              </span>
                            </label>
                            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                              <input type="checkbox" checked={recipientsForm.includes('customers')} onChange={(e) => { if (e.target.checked) setRecipientsForm([...recipientsForm, 'customers']); else setRecipientsForm(recipientsForm.filter(r => r !== 'customers')); }} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                              <span className="text-[13px] text-[#E5E5E5] flex items-center gap-2 group-hover:text-white transition-colors">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#858585] group-hover:text-[#A3A3A3]"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                Solo Clienti
                              </span>
                            </label>
                            {customLists?.map(list => (
                              <label key={list.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                                <input type="checkbox" checked={recipientsForm.includes(list.id)} onChange={(e) => { if (e.target.checked) setRecipientsForm([...recipientsForm, list.id]); else setRecipientsForm(recipientsForm.filter(r => r !== list.id)); }} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                                <span className="text-[13px] text-[#E5E5E5] flex items-center gap-2 group-hover:text-white transition-colors">
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#858585] group-hover:text-[#A3A3A3]"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                  {list.name}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                        {recipientTab === 'segmenti' && (
                          <div className="flex flex-col">
                            <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                              <input type="checkbox" checked={recipientsForm.includes('segment_active')} onChange={(e) => { if (e.target.checked) setRecipientsForm([...recipientsForm, 'segment_active']); else setRecipientsForm(recipientsForm.filter(r => r !== 'segment_active')); }} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                              <span className="text-[13px] text-[#E5E5E5] flex items-center gap-2 group-hover:text-white transition-colors">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#858585] group-hover:text-[#A3A3A3]"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                Segmento: Attivi
                              </span>
                            </label>
                          </div>
                        )}
                        {recipientTab === 'contatti' && (
                          <div className="flex flex-col">
                            <button className="flex items-center gap-2 p-3 text-[13px] text-[#00A6FF] hover:bg-blue-500/10 hover:text-blue-400 rounded-lg transition-colors text-left font-medium mb-1">
                              <Plus size={15} />
                              Aggiungi nuovo contatto al CRM
                            </button>
                            {[...contacts, ...customers]
                              .filter((c: any) => (c.name || '').toLowerCase().includes(recipientSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(recipientSearch.toLowerCase()))
                              .map((c: any) => {
                                const formId = `contact_${c.id}`;
                                return (
                                  <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
                                    <input type="checkbox" checked={recipientsForm.includes(formId)} onChange={(e) => { if (e.target.checked) setRecipientsForm([...recipientsForm, formId]); else setRecipientsForm(recipientsForm.filter((r: any) => r !== formId)); }} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                                    <span className="text-[13px] text-[#E5E5E5] flex items-center gap-2 group-hover:text-white transition-colors truncate">
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#858585] group-hover:text-[#A3A3A3] shrink-0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                      {c.name} {c.email ? <span className="text-[#858585]">({c.email})</span> : ''}
                                    </span>
                                  </label>
                                );
                            })}
                            {[...contacts, ...customers].length === 0 && !crmLoading && (
                               <p className="text-[13px] text-[#858585] p-3 text-center">Nessun contatto trovato nel CRM.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-4">
                  <button onClick={() => { setEditingRecipients(false); setRecipientDropdownOpen(false); }} className="px-5 py-2.5 text-[13px] font-medium text-[#A3A3A3] hover:text-white transition-colors">
                    Annulla
                  </button>
                  <button onClick={handleSaveRecipients} className="px-6 py-2.5 bg-[#006AFF] hover:bg-blue-600 rounded-xl text-[13px] font-medium text-white transition-colors">
                    Salva
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>


        {/* Step 3: Oggetto */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-7 border-b border-[#1A1A1A] gap-4">
          <div className="flex items-start gap-4">
            {isSubjectComplete ? <CheckCircle2 size={24} className="text-[#00FF38] shrink-0 mt-0.5" /> : <Circle size={24} className="text-[#333] shrink-0 mt-0.5" />}
            <div>
              <h3 className="text-[17px] font-medium text-white mb-1">Oggetto</h3>
              {isSubjectComplete ? (
                <p className="text-[14px] text-[#858585]">{campaign.subject}</p>
              ) : (
                <p className="text-[14px] text-[#858585]">Aggiungi un oggetto a questa campagna.</p>
              )}
            </div>
          </div>
          <button 
            onClick={() => {
              setSubjectForm(campaign.subject || '');
              setEditingSubject(true);
            }}
            className="px-5 py-2.5 bg-black border border-[#1A1A1A] hover:border-[#2A2A2A] rounded-xl text-[13px] text-white font-medium transition-colors shrink-0 shadow-sm"
          >
            Aggiungi oggetto
          </button>
        </div>

        {/* Step 4: Ideazione */}
        <div className="flex flex-col p-7 gap-6 border-b border-[#1A1A1A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {isDesignComplete ? <CheckCircle2 size={24} className="text-[#00FF38] shrink-0 mt-0.5" /> : <Circle size={24} className="text-[#333] shrink-0 mt-0.5" />}
              <div>
                <h3 className="text-[17px] font-medium text-white mb-1">Ideazione</h3>
                {!isDesignComplete && (
                  <p className="text-[14px] text-[#858585]">Crea contenuto email</p>
                )}
              </div>
            </div>
            <button 
              onClick={() => router.push(`/marketing/templates/${campaign.id}`)}
              className="px-5 py-2.5 bg-black border border-[#1A1A1A] hover:border-[#2A2A2A] rounded-xl text-[13px] text-white font-medium transition-colors shrink-0 shadow-sm"
            >
              {isDesignComplete ? 'Modifica design' : 'Inizia a progettare'}
            </button>
          </div>
          
          {/* Design Preview Placeholder */}
          {isDesignComplete && (
            <div className="ml-[40px] bg-[#141414] rounded-2xl border border-[#1A1A1A] h-[260px] flex flex-col items-center justify-center overflow-hidden relative group">
              <div className="w-[300px] h-full bg-white shadow-2xl p-4 opacity-70 group-hover:opacity-100 transition-opacity mt-8 rounded-t-lg">
                <div className="w-full h-8 bg-black flex items-center justify-center text-white font-bold text-[10px] mb-4">MEYOU</div>
                <div className="w-3/4 h-2 bg-gray-200 rounded mx-auto mb-4" />
                <div className="w-24 h-24 bg-gray-200 rounded mx-auto mb-4" />
                <div className="w-full h-1.5 bg-gray-100 rounded mb-2" />
                <div className="w-full h-1.5 bg-gray-100 rounded mb-2" />
                <div className="w-20 h-5 bg-[#006AFF] rounded mx-auto mt-4" />
              </div>
            </div>
          )}
        </div>

        {/* Step 5: Impostazioni aggiuntive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-7 gap-4 bg-[#0A0A0A] rounded-b-[24px]">
          <div className="flex items-start gap-4">
            {campaign.advancedSettings && Object.values(campaign.advancedSettings).some(Boolean) ? <CheckCircle2 size={24} className="text-[#00FF38] shrink-0 mt-0.5" /> : <Circle size={24} className="text-[#858585] shrink-0 mt-0.5 opacity-0" />}
            <div>
              <h3 className="text-[17px] font-medium text-white mb-1">Impostazioni aggiuntive</h3>
              {campaign.advancedSettings && Object.values(campaign.advancedSettings).some(Boolean) && (
                <p className="text-[14px] text-[#858585]">{Object.values(campaign.advancedSettings).filter(Boolean).length} impostazioni attive</p>
              )}
            </div>
          </div>
          <button onClick={() => { setAdvancedForm(campaign.advancedSettings || {}); setEditingAdvanced(true); }} className="px-5 py-2.5 bg-black border border-[#1A1A1A] hover:border-[#2A2A2A] rounded-xl text-[13px] text-white font-medium transition-colors shrink-0 shadow-sm">
            Modifica impostazioni
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Modal Mittente */}
      {editingSender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[440px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-5">
              <h2 className="text-[17px] font-medium text-white">Gestisci mittente</h2>
              <button onClick={() => setEditingSender(false)} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </header>
            <div className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-white">Nome mittente</label>
                <input
                  type="text"
                  value={senderForm.name}
                  onChange={e => setSenderForm({ ...senderForm, name: e.target.value })}
                  placeholder="es. MEYOU Srl"
                  className="w-full bg-black border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#2A2A2A]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-white">Email mittente</label>
                <input
                  type="email"
                  value={senderForm.email}
                  onChange={e => setSenderForm({ ...senderForm, email: e.target.value })}
                  placeholder="es. info@meyou.it"
                  className="w-full bg-black border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#2A2A2A]"
                />
              </div>
            </div>
            <footer className="flex items-center justify-end gap-3 border-t border-[#1A1A1A] p-4 bg-transparent">
              <button onClick={() => setEditingSender(false)} className="h-10 px-5 text-[14px] font-medium text-[#A3A3A3] hover:text-white transition-colors">
                Annulla
              </button>
              <button onClick={handleSaveSender} className="h-10 px-6 bg-[#006AFF] hover:bg-blue-600 rounded-xl text-[14px] font-medium text-white transition-colors">
                Salva
              </button>
            </footer>
          </div>
        </div>
      )}


      {/* Modal Oggetto */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[500px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200">
            <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-5">
              <h2 className="text-[17px] font-medium text-white">Aggiungi oggetto</h2>
              <button onClick={() => setEditingSubject(false)} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </header>
            <div className="flex flex-col gap-6 p-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-white">Oggetto della campagna</label>
                  <span className="text-[11px] text-[#5A5A5A]">{subjectForm.length}/150</span>
                </div>
                <input
                  type="text"
                  maxLength={150}
                  value={subjectForm}
                  onChange={e => setSubjectForm(e.target.value)}
                  placeholder="Inserisci l'oggetto dell'email"
                  className="w-full bg-black border border-[#1A1A1A] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#2A2A2A]"
                />
                <p className="text-[12px] text-[#858585] mt-1">Scegli un oggetto accattivante che spinga all'apertura.</p>
              </div>
            </div>
            <footer className="flex items-center justify-end gap-3 border-t border-[#1A1A1A] p-4 bg-transparent">
              <button onClick={() => setEditingSubject(false)} className="h-10 px-5 text-[14px] font-medium text-[#A3A3A3] hover:text-white transition-colors">
                Annulla
              </button>
              <button onClick={handleSaveSubject} className="h-10 px-6 bg-[#006AFF] hover:bg-blue-600 rounded-xl text-[14px] font-medium text-white transition-colors">
                Salva
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Impostazioni Aggiuntive */}
      {editingAdvanced && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative flex w-full max-w-[600px] flex-col overflow-hidden rounded-[24px] border border-[#1A1A1A] bg-[#111111] animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
            <header className="flex items-center justify-between border-b border-[#1A1A1A] px-6 py-5 shrink-0">
              <h2 className="text-[17px] font-medium text-white">Impostazioni aggiuntive</h2>
              <button onClick={() => setEditingAdvanced(false)} className="rounded-lg p-1.5 text-[#858585] hover:bg-white/5 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </header>
            <div className="flex flex-col gap-6 p-6 overflow-y-auto">
              
              {/* Personalizzazione */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Personalizzazione</h3>
                <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                  <input type="checkbox" checked={advancedForm?.customToField} onChange={(e) => setAdvancedForm({...advancedForm, customToField: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                  <span className="text-[13px] text-[#E5E5E5]">Personalizza il campo "Invia a"</span>
                </label>
              </div>

              {/* Invio e tracciamento */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Invio e tracciamento</h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.replyTo} onChange={(e) => setAdvancedForm({...advancedForm, replyTo: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Usa un indirizzo di risposta diverso</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.utmTracking} onChange={(e) => setAdvancedForm({...advancedForm, utmTracking: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Attiva il tracciamento UTM</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.ignoreListSettings} onChange={(e) => setAdvancedForm({...advancedForm, ignoreListSettings: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Ignora le impostazioni personalizzate della lista</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.hasAttachment} onChange={(e) => setAdvancedForm({...advancedForm, hasAttachment: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Aggiungi allegato</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.tag} onChange={(e) => setAdvancedForm({...advancedForm, tag: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Aggiungi un tag</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.expirationDate} onChange={(e) => setAdvancedForm({...advancedForm, expirationDate: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Imposta una data di scadenza</span>
                  </label>
                </div>
              </div>

              {/* Iscrizione */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Iscrizione</h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.customUnsubscribePage} onChange={(e) => setAdvancedForm({...advancedForm, customUnsubscribePage: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Utilizza una pagina di disiscrizione personalizzata</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.updateProfileForm} onChange={(e) => setAdvancedForm({...advancedForm, updateProfileForm: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Utilizza un modulo di aggiornamento del profilo</span>
                  </label>
                </div>
              </div>

              {/* Design */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Design</h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.customHeader} onChange={(e) => setAdvancedForm({...advancedForm, customHeader: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Modifica intestazione predefinita</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.customFooter} onChange={(e) => setAdvancedForm({...advancedForm, customFooter: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Modifica piè di pagina predefinito</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border border-[#1A1A1A] bg-[#0A0A0A] cursor-pointer">
                    <input type="checkbox" checked={advancedForm?.viewInBrowserLink} onChange={(e) => setAdvancedForm({...advancedForm, viewInBrowserLink: e.target.checked})} className="appearance-none h-4 w-4 rounded-[4px] border border-[#2A2A2A] bg-[#0B0B0B] checked:bg-[#1A1A1A] checked:border-[#3F3F3F] cursor-pointer transition-all bg-no-repeat bg-center checked:bg-[url('data:image/svg+xml,%3Csvg%20viewBox=%220%200%2014%2014%22%20fill=%22none%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath%20d=%22M3%207.5L6%2010.5L11%204%22%20stroke=%22white%22%20stroke-width=%221.5%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22/%3E%3C/svg%3E')]" />
                    <span className="text-[13px] text-[#E5E5E5]">Abilita link "Visualizza nel browser"</span>
                  </label>
                </div>
              </div>
            </div>
            <footer className="flex items-center justify-end gap-3 border-t border-[#1A1A1A] p-4 bg-transparent shrink-0">
              <button onClick={() => setEditingAdvanced(false)} className="h-10 px-5 text-[14px] font-medium text-[#A3A3A3] hover:text-white transition-colors">
                Annulla
              </button>
              <button onClick={handleSaveAdvanced} className="h-10 px-6 bg-[#006AFF] hover:bg-blue-600 rounded-xl text-[14px] font-medium text-white transition-colors">
                Salva
              </button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
