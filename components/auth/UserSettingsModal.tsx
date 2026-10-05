import React, { useState, useEffect } from 'react';
import { X, Globe, Clock, Mail, BellRing } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { useRouter } from 'next/navigation';

export function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useAuth();
  const { t, locale, setLocale } = useTranslation();
  const router = useRouter();
  
  const [timezone, setTimezone] = useState(settings?.timezone || 'Europe/Rome');
  const [language, setLanguage] = useState(locale);
  
  // Email preferences
  const [emailAssignee, setEmailAssignee] = useState(settings?.emailAssignee ?? true);
  const [emailRequester, setEmailRequester] = useState(settings?.emailRequester ?? false);
  const [emailChanges, setEmailChanges] = useState(settings?.emailChanges ?? false);
  const [emailMentioned, setEmailMentioned] = useState(settings?.emailMentioned ?? true);
  const [emailMessages, setEmailMessages] = useState(settings?.emailMessages ?? false);
  
  const [groupFrequency, setGroupFrequency] = useState(settings?.groupFrequency === '5min' ? '5min' : '3min');
  const [defaultMeetingLink, setDefaultMeetingLink] = useState(settings?.defaultMeetingLink || '');

  // Handle Language change with cookie
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as 'it' | 'en';
    setLanguage(newLang);
    setLocale(newLang);
    router.refresh();
  };

  useEffect(() => {
    setLanguage(locale);
  }, [locale]);

  // Debounce settings updates
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updateSettings({
        timezone,
        language,
        emailAssignee,
        emailRequester,
        emailChanges,
        emailMentioned,
        emailMessages,
        groupFrequency,
        defaultMeetingLink
      });
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [timezone, language, emailAssignee, emailRequester, emailChanges, emailMentioned, emailMessages, groupFrequency, defaultMeetingLink, updateSettings]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="relative w-full max-w-2xl bg-[#0A0A0A] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/5">
          <h2 className="text-lg font-semibold text-white/90">{t.settings.profileSettings}</h2>
          <button onClick={onClose} className="text-[#858585] hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
          
          {/* General Settings */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-medium text-[#858585] uppercase tracking-wider">{t.settings.general}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white/70 flex items-center gap-2">
                  <Clock size={14} className="text-[#006AFF]" /> {t.settings.timezone}
                </label>
                <select 
                  value={timezone} 
                  onChange={e => setTimezone(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#006AFF] transition-colors appearance-none"
                >
                  <option value="Europe/Rome" className="bg-[#1A1A1A]">Europe/Rome</option>
                  <option value="Europe/London" className="bg-[#1A1A1A]">Europe/London</option>
                  <option value="America/New_York" className="bg-[#1A1A1A]">America/New_York</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-white/70 flex items-center gap-2">
                  <Globe size={14} className="text-[#006AFF]" /> {t.settings.language}
                </label>
                <select 
                  value={language} 
                  onChange={handleLanguageChange}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#006AFF] transition-colors appearance-none"
                >
                  <option value="it" className="bg-[#1A1A1A]">italiano (Italia)</option>
                  <option value="en" className="bg-[#1A1A1A]">English</option>
                </select>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* Meeting Settings */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-medium text-[#858585] uppercase tracking-wider flex items-center gap-2">
               {t.settings.videoConferencing}
            </h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm text-white/70">{t.settings.defaultMeetingLink}</label>
              <input 
                type="url"
                value={defaultMeetingLink}
                onChange={e => setDefaultMeetingLink(e.target.value)}
                placeholder={t.settings.defaultMeetingLinkPlaceholder}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#006AFF] transition-colors"
              />
              <p className="text-xs text-[#858585] mt-1">
                {t.settings.defaultMeetingLinkDesc}
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-white/5" />

          {/* Email Preferences */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium text-[#858585] uppercase tracking-wider flex items-center gap-2">
                <Mail size={14} /> {t.settings.emailPreferences}
              </h3>
              <p className="text-[13px] text-[#858585] leading-relaxed">
                {t.settings.emailPreferencesDesc}
              </p>
            </div>

            <div className="flex flex-col gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <h4 className="text-sm font-medium text-white/80 mb-2">{t.settings.receiveEmailsWhen}</h4>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" checked={emailAssignee} onChange={e => setEmailAssignee(e.target.checked)} />
                  <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-[#006AFF] peer-checked:border-[#006AFF] transition-colors" />
                  <div className="absolute opacity-0 peer-checked:opacity-100 text-white pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{t.settings.emailAssignee}</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" checked={emailRequester} onChange={e => setEmailRequester(e.target.checked)} />
                  <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-[#006AFF] peer-checked:border-[#006AFF] transition-colors" />
                  <div className="absolute opacity-0 peer-checked:opacity-100 text-white pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{t.settings.emailRequester}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" checked={emailChanges} onChange={e => setEmailChanges(e.target.checked)} />
                  <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-[#006AFF] peer-checked:border-[#006AFF] transition-colors" />
                  <div className="absolute opacity-0 peer-checked:opacity-100 text-white pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{t.settings.emailChanges}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" checked={emailMentioned} onChange={e => setEmailMentioned(e.target.checked)} />
                  <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-[#006AFF] peer-checked:border-[#006AFF] transition-colors" />
                  <div className="absolute opacity-0 peer-checked:opacity-100 text-white pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{t.settings.emailMentioned}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" checked={emailMessages} onChange={e => setEmailMessages(e.target.checked)} />
                  <div className="w-5 h-5 border border-white/20 rounded bg-white/5 peer-checked:bg-[#006AFF] peer-checked:border-[#006AFF] transition-colors" />
                  <div className="absolute opacity-0 peer-checked:opacity-100 text-white pointer-events-none">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <span className="text-sm text-white/70 group-hover:text-white transition-colors">{t.settings.emailMessages}</span>
              </label>
            </div>

            <div className="flex flex-col gap-3 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
              <h4 className="text-sm font-medium text-white/80 flex items-center gap-2"><BellRing size={14}/> {t.settings.groupEmails}</h4>
              <p className="text-[13px] text-[#858585] leading-relaxed mb-1">
                {t.settings.groupEmailsDesc}
              </p>
              <select 
                value={groupFrequency} 
                onChange={e => setGroupFrequency(e.target.value)}
                className="w-full sm:w-1/2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#006AFF] transition-colors appearance-none"
              >
                <option value="3min" className="bg-[#1A1A1A]">{t.settings.every3Min}</option>
                <option value="5min" className="bg-[#1A1A1A]">{t.settings.every5Min}</option>
              </select>
            </div>
          </div>
          
        </div>

        <div className="p-5 border-t border-white/5 bg-black/40 flex justify-end gap-3 mt-auto">
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-full font-medium transition-colors">
            {t.settings.cancel}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-[#006AFF] hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors">
            {t.settings.saveChanges}
          </button>
        </div>
      </div>
    </div>
  );
}
