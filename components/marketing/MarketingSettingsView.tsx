'use client';

import React, { useState } from 'react';
import { Globe, Plus, AlertCircle, CheckCircle2, ChevronDown, Copy, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/contexts/TranslationContext';

// Mocking standard Resend DNS records structure
interface DnsRecord {
  type: string;
  host: string;
  value: string;
  priority?: string;
  status: 'pending' | 'verified' | 'unverified';
}

interface Domain {
  id: string;
  name: string;
  status: 'pending' | 'verified' | 'failed';
  records: DnsRecord[];
}

export function MarketingSettingsView({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const handleAddDomain = async () => {
    if (!newDomain.includes('.')) {
      toast.error(t.marketing.validDomainError);
      return;
    }
    setIsAdding(true);
    // Fake API call to Resend
    setTimeout(() => {
      const mockDomain: Domain = {
        id: Math.random().toString(36).substring(7),
        name: newDomain.toLowerCase(),
        status: 'pending',
        records: [
          { type: 'TXT', host: `resend._domainkey.${newDomain}`, value: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...', status: 'pending' },
          { type: 'MX', host: `bounce.${newDomain}`, value: 'feedback-smtp.eu-west-1.amazonses.com', priority: '10', status: 'pending' },
          { type: 'TXT', host: `bounce.${newDomain}`, value: 'v=spf1 include:amazonses.com ~all', status: 'pending' }
        ]
      };
      setDomains([...domains, mockDomain]);
      setNewDomain('');
      setIsAdding(false);
      setExpandedDomain(mockDomain.id);
      toast.success(t.marketing.domainAddedSuccess);
    }, 1000);
  };

  const handleVerify = (domainId: string) => {
    // Fake verification
    setDomains(prev => prev.map(d => {
      if (d.id === domainId) {
        return {
          ...d,
          status: 'verified',
          records: d.records.map(r => ({ ...r, status: 'verified' }))
        };
      }
      return d;
    }));
    toast.success(t.marketing.domainVerifiedSuccess);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info(t.common.copiedToClipboard);
  };

  return (
    <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 text-white">
          <Globe size={20} />
        </div>
        <div>
          <h2 className="text-xl font-medium text-white">{t.marketing.senderDomains}</h2>
          <p className="text-sm text-[#858585]">{t.marketing.senderDomainsDesc}</p>
        </div>
      </div>

      <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-2xl p-6 flex flex-col gap-6">
        
        {/* Add Domain form */}
        <div className="flex gap-3">
          <input 
            type="text" 
            placeholder={t.marketing.domainPlaceholder}
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            className="flex-1 bg-black border border-[#1A1A1A] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#2A2A2A]"
          />
          <button 
            onClick={handleAddDomain}
            disabled={!newDomain || isAdding}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#006AFF] hover:bg-blue-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {t.marketing.addDomain}
          </button>
        </div>

        {/* Domains List */}
        {domains.length > 0 ? (
          <div className="flex flex-col gap-4 mt-4">
            {domains.map(domain => (
              <div key={domain.id} className="border border-[#1A1A1A] rounded-xl overflow-hidden bg-black/40">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedDomain(expandedDomain === domain.id ? null : domain.id)}
                >
                  <div className="flex items-center gap-3">
                    {domain.status === 'verified' ? (
                      <CheckCircle2 size={18} className="text-[#00FF38]" />
                    ) : (
                      <AlertCircle size={18} className="text-[#F5A623]" />
                    )}
                    <span className="font-medium text-white">{domain.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      domain.status === 'verified' ? 'bg-[#00FF38]/10 border-[#00FF38]/20 text-[#00FF38]' : 'bg-[#F5A623]/10 border-[#F5A623]/20 text-[#F5A623]'
                    }`}>
                      {domain.status === 'verified' ? t.marketing.verified : t.marketing.pendingVerification}
                    </span>
                  </div>
                  <ChevronDown size={18} className={`text-[#858585] transition-transform ${expandedDomain === domain.id ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded Details */}
                {expandedDomain === domain.id && (
                  <div className="border-t border-[#1A1A1A] p-5 bg-[#050505]">
                    {domain.status !== 'verified' && (
                      <p className="text-sm text-[#858585] mb-5">
                        {t.marketing.dnsInstructions}
                      </p>
                    )}
                    
                    <div className="flex flex-col gap-3 mb-6">
                      {domain.records.map((record, idx) => (
                        <div key={idx} className="flex flex-col gap-2 p-3 border border-[#1A1A1A] rounded-lg bg-black">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider w-12">{t.marketing.type}</span>
                            <span className="text-xs text-white bg-[#1A1A1A] px-2 py-0.5 rounded">{record.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider w-12">{t.marketing.host}</span>
                            <div className="flex items-center gap-2 flex-1 group">
                              <span className="text-xs text-[#C4C4C4] font-mono">{record.host}</span>
                              <button onClick={() => copyToClipboard(record.host)} className="opacity-0 group-hover:opacity-100 text-[#5A5A5A] hover:text-white transition-opacity"><Copy size={12} /></button>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider w-12">{t.marketing.value}</span>
                            <div className="flex items-center gap-2 flex-1 group bg-[#111111] border border-[#1A1A1A] px-2 py-1 rounded text-xs text-[#C4C4C4] font-mono break-all relative">
                              <span className="pr-6">{record.value}</span>
                              <button onClick={() => copyToClipboard(record.value)} className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[#5A5A5A] hover:text-white transition-opacity"><Copy size={12} /></button>
                            </div>
                          </div>
                          {record.priority && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-[#5A5A5A] uppercase tracking-wider w-12">{t.marketing.priority}</span>
                              <span className="text-xs text-white">{record.priority}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {domain.status !== 'verified' && (
                      <div className="flex justify-end">
                        <button 
                          onClick={() => handleVerify(domain.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          {t.marketing.verifyConfig} <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-[#1A1A1A] rounded-xl bg-black/20">
            <Globe size={32} className="text-[#333] mb-3" />
            <p className="text-sm text-[#858585]">{t.marketing.noDomainsConfigured}</p>
          </div>
        )}

      </div>
    </div>
  );
}
