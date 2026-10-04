'use client';

import { useTranslation } from '@/contexts/TranslationContext';
import { Clock } from 'lucide-react';
import { CrmProspectSearch } from './types';
import { SEARCH_KIND_LABELS, SEARCH_STATE_LABELS, SearchState } from './constants';
import { formatDate } from '../shared/TableUtils';

/**
 * La cronologia delle ricerche.
 *
 * Non è un registro tecnico: è quello che permette di rispondere a «questa
 * azienda chi l'ha cercata, e quando», che è una domanda che arriva sia da un
 * collega sia da chi chiede conto di un trattamento di dati.
 *
 * Gli stati si mostrano per esteso, compreso `PARTIAL`, che qui capita spesso:
 * una ricerca per nome resta sempre completata in parte finché non c'è un
 * motore, e nasconderlo farebbe credere che quell'azienda non esista.
 */

const COLORI: Record<SearchState, string> = {
  PENDING: 'text-[#585858]',
  RUNNING: 'text-[#3B82F6]',
  DONE:    'text-[#10B981]',
  PARTIAL: 'text-[#F59E0B]',
  FAILED:  'text-[#EF4444]',
};

interface SearchHistoryProps {
  searches: CrmProspectSearch[];
  onOpenProfile: (profileId: string) => void;
  ownerName: (uid: string) => string;
}

export function SearchHistory({ searches, onOpenProfile, ownerName }: SearchHistoryProps) {
  const { t } = useTranslation();
  if (searches.length === 0) {
    return (
      <p className="rounded-lg border border-[#1A1A1A] bg-[#0F0F0F] p-4 text-[11px] text-[#585858]">
        Nessuna ricerca ancora. Quelle fatte restano qui, con chi le ha fatte e com’è andata.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#1A1A1A]">
      <table className="w-full">
        <thead className="border-b border-[#1A1A1A] bg-[#0F0F0F]">
          <tr className="text-left text-[10px] uppercase tracking-wide text-[#585858]">
            <th className="px-4 py-2 font-medium">Cercato</th>
            <th className="px-4 py-2 font-medium">{t.crm.type}</th>
            <th className="px-4 py-2 font-medium">Esito</th>
            <th className="px-4 py-2 font-medium">Chi</th>
            <th className="px-4 py-2 font-medium">Quando</th>
          </tr>
        </thead>
        <tbody>
          {searches.map(ricerca => (
            <tr
              key={ricerca.id}
              onClick={() => ricerca.profileId && onOpenProfile(ricerca.profileId)}
              className={`border-b border-[#131313] last:border-b-0 ${
                ricerca.profileId ? 'cursor-pointer hover:bg-white/5' : ''
              }`}
            >
              <td className="px-4 py-2 text-[11px] text-white">{ricerca.input}</td>
              <td className="px-4 py-2 text-[11px] text-[#858585]">{SEARCH_KIND_LABELS[ricerca.kind]}</td>
              <td className="px-4 py-2">
                <span className={`text-[11px] ${COLORI[ricerca.state]}`}>
                  {SEARCH_STATE_LABELS[ricerca.state]}
                </span>
                {ricerca.outcome && (
                  <p className="mt-0.5 max-w-md text-[10px] text-[#585858]">{ricerca.outcome}</p>
                )}
              </td>
              <td className="px-4 py-2 text-[11px] text-[#858585]">{ownerName(ricerca.createdBy)}</td>
              <td className="px-4 py-2 text-[11px] text-[#585858]">{formatDate(ricerca.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
