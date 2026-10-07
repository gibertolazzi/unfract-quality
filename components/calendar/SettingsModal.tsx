import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { authedFetch } from '@/lib/authedFetch';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useTranslation } from '@/contexts/TranslationContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TimeInterval = { start: string, end: string };
type DayAvailability = { enabled: boolean; intervals: TimeInterval[] };
type WeeklyAvailability = { [key: string]: DayAvailability };

const defaultAvailability: WeeklyAvailability = {
  '0': { enabled: false, intervals: [] }, // Sun
  '1': { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] }, // Mon
  '2': { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  '3': { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  '4': { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  '5': { enabled: true, intervals: [{ start: '09:00', end: '18:00' }] },
  '6': { enabled: false, intervals: [] }, // Sat
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'disponibilita' | 'integrazioni'>('disponibilita');

  // Integrations state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [microsoftConnected, setMicrosoftConnected] = useState(false);
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  // Availability state
  const [bookingDuration, setBookingDuration] = useState<number>(30);
  const [availability, setAvailability] = useState<WeeklyAvailability>(defaultAvailability);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!user || !isOpen) return;

    getDoc(doc(db, 'users', user.uid)).then(d => {
      if (d.exists()) {
        const data = d.data();
        if (data.bookingDuration) setBookingDuration(data.bookingDuration);
        if (data.availability) setAvailability(data.availability);
      }
    });
    
    // I documenti `integrations` contengono i token e li legge solo il server.
    let cancelled = false;
    setLoadingIntegrations(true);
    authedFetch('/api/calendar/integrations')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(data => {
        if (cancelled) return;
        setGoogleConnected(!!data.google);
        setMicrosoftConnected(!!data.microsoft);
      })
      .catch(error => console.error('Stato dei calendari non disponibile:', error))
      .finally(() => {
        if (!cancelled) setLoadingIntegrations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, isOpen]);

  if (!isOpen) return null;

  // Il server crea uno state casuale legato all'utente e restituisce l'URL del provider.
  const startOAuth = async (provider: 'google' | 'microsoft') => {
    if (!user) return;
    try {
      const res = await authedFetch(`/api/auth/${provider}`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || 'Collegamento non disponibile.');
      window.location.href = data.url;
    } catch (e) {
      console.error(`Errore avvio collegamento ${provider}:`, e);
    }
  };

  const handleConnectGoogle = () => startOAuth('google');

  const handleConnectMicrosoft = () => startOAuth('microsoft');

  const savePreferences = async () => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        bookingDuration,
        availability
      }, { merge: true });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleToggleDay = (dayIndex: string) => {
    setAvailability(prev => {
      const day = prev[dayIndex];
      const newEnabled = !day.enabled;
      return {
        ...prev,
        [dayIndex]: {
          ...day,
          enabled: newEnabled,
          intervals: newEnabled && day.intervals.length === 0 ? [{ start: '09:00', end: '18:00' }] : day.intervals
        }
      };
    });
  };

  const handleAddInterval = (dayIndex: string) => {
    setAvailability(prev => ({
      ...prev,
      [dayIndex]: {
        ...prev[dayIndex],
        intervals: [...prev[dayIndex].intervals, { start: '09:00', end: '18:00' }]
      }
    }));
  };

  const handleRemoveInterval = (dayIndex: string, intervalIndex: number) => {
    setAvailability(prev => {
      const newIntervals = prev[dayIndex].intervals.filter((_, i) => i !== intervalIndex);
      return {
        ...prev,
        [dayIndex]: {
          ...prev[dayIndex],
          intervals: newIntervals,
          enabled: newIntervals.length > 0
        }
      };
    });
  };

  const handleUpdateInterval = (dayIndex: string, intervalIndex: number, field: 'start'|'end', value: string) => {
    setAvailability(prev => {
      const newIntervals = [...prev[dayIndex].intervals];
      newIntervals[intervalIndex] = { ...newIntervals[intervalIndex], [field]: value };
      return {
        ...prev,
        [dayIndex]: { ...prev[dayIndex], intervals: newIntervals }
      };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
          <h2 className="text-xl font-bold text-white">{t.calendar.calendarSettings}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-[#858585] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-white/5 shrink-0 gap-6">
          <button 
            onClick={() => setActiveTab('disponibilita')}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'disponibilita' ? 'border-[#006AFF] text-white' : 'border-transparent text-[#858585] hover:text-white'}`}
          >
            {t.calendar.availabilityTab}
          </button>
          <button 
            onClick={() => setActiveTab('integrazioni')}
            className={`py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'integrazioni' ? 'border-[#006AFF] text-white' : 'border-transparent text-[#858585] hover:text-white'}`}
          >
            {t.calendar.integrationsTab}
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          
          {activeTab === 'disponibilita' && (
            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-sm font-bold text-white mb-2">{t.calendar.slotDuration}</label>
                <select 
                  value={bookingDuration} 
                  onChange={e => setBookingDuration(Number(e.target.value))}
                  className="w-full max-w-[200px] bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-[#006AFF]"
                >
                  <option value={15}>{t.calendar['15min']}</option>
                  <option value={30}>{t.calendar['30min']}</option>
                  <option value={45}>{t.calendar['45min']}</option>
                  <option value={60}>{t.calendar['1h']}</option>
                  <option value={90}>{t.calendar['1.5h']}</option>
                  <option value={120}>{t.calendar['2h']}</option>
                </select>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white mb-4">{t.calendar.weeklyHours}</h3>
                <div className="flex flex-col gap-4">
                  {Object.keys(availability).map((dayIndex) => {
                    const day = availability[dayIndex];
                    return (
                      <div key={dayIndex} className="flex flex-col sm:flex-row sm:items-start gap-4 pb-4 border-b border-white/5 last:border-0">
                        {/* Day Toggle */}
                        <div className="w-32 flex items-center gap-3 mt-2">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={day.enabled} onChange={() => handleToggleDay(dayIndex)} />
                            <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#006AFF]"></div>
                          </label>
                          <span className={`text-sm font-medium ${day.enabled ? 'text-white' : 'text-[#858585]'}`}>
                            {t.calendar.days[parseInt(dayIndex)]}
                          </span>
                        </div>

                        {/* Intervals */}
                        <div className="flex-1 flex flex-col gap-2">
                          {!day.enabled || day.intervals.length === 0 ? (
                            <div className="text-sm text-[#858585] py-2">{t.calendar.notAvailable}</div>
                          ) : (
                            day.intervals.map((interval, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input 
                                  type="time" 
                                  value={interval.start}
                                  onChange={e => handleUpdateInterval(dayIndex, i, 'start', e.target.value)}
                                  className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-[#006AFF]"
                                />
                                <span className="text-[#858585]">-</span>
                                <input 
                                  type="time" 
                                  value={interval.end}
                                  onChange={e => handleUpdateInterval(dayIndex, i, 'end', e.target.value)}
                                  className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-[#006AFF]"
                                />
                                <button onClick={() => handleRemoveInterval(dayIndex, i)} className="p-2 text-[#858585] hover:text-red-400 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                                {i === day.intervals.length - 1 && (
                                  <button onClick={() => handleAddInterval(dayIndex)} className="p-2 text-[#858585] hover:text-white transition-colors">
                                    <Plus size={16} />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-white/5">
                <button 
                  onClick={savePreferences}
                  disabled={savingPrefs}
                  className="px-6 py-2 bg-[#006AFF] hover:bg-[#0055CC] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingPrefs ? t.calendar.saving : t.calendar.savePreferences}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'integrazioni' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[#A0A0A0] mb-2">
                {t.calendar.connectAccountsDesc}
              </p>

              <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-2">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" className="w-full h-full" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{t.calendar.googleCalendar}</div>
                    <div className="text-xs text-[#858585]">{t.calendar.googleDesc}</div>
                  </div>
                </div>
                {loadingIntegrations ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-[#006AFF] animate-spin" />
                ) : googleConnected ? (
                  <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                    <Check size={16} /> {t.calendar.connected}
                  </div>
                ) : (
                  <button onClick={handleConnectGoogle} className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium hover:bg-gray-200 transition-colors">
                    {t.calendar.connect}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-2">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="Microsoft" className="w-full h-full" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{t.calendar.outlookCalendar}</div>
                    <div className="text-xs text-[#858585]">{t.calendar.outlookDesc}</div>
                  </div>
                </div>
                {loadingIntegrations ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-[#006AFF] animate-spin" />
                ) : microsoftConnected ? (
                  <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                    <Check size={16} /> {t.calendar.connected}
                  </div>
                ) : (
                  <button onClick={handleConnectMicrosoft} className="px-4 py-2 rounded-full bg-[#006AFF] text-white text-sm font-medium hover:bg-[#0055CC] transition-colors">
                    {t.calendar.connect}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
