'use client';

import { useEffect, useState } from 'react';
import { CrmCompanyProfile, CrmProspectSearch, CrmProspectReport, CrmProspectExclusion } from '@/components/crm/ricerca/types';
import { subscribeToProfiles } from '@/lib/crm/prospect/profiles';
import { subscribeToSearches } from '@/lib/crm/prospect/searches';
import { subscribeToReports } from '@/lib/crm/prospect/reports';
import { subscribeToExclusions } from '@/lib/crm/prospect/exclusions';

/**
 * I dati della sezione, in ascolto solo mentre la sezione è aperta.
 *
 * Non stanno in `CrmContext` di proposito. Quel provider apre sei ascolti su
 * Firestore per chiunque entri nel CRM, e ha senso: sono gli elenchi che
 * servono sempre. Le schede aziendali no — servono a chi sta cercando, e chi
 * non cerca non deve pagarne il traffico né la banda.
 *
 * Il prezzo è che aprendo la sezione i dati arrivano con un attimo di ritardo.
 * È il verso giusto in cui sbagliare.
 */
export interface ProspectData {
  profiles: CrmCompanyProfile[];
  searches: CrmProspectSearch[];
  reports: CrmProspectReport[];
  /** Comprese le revocate: servono a mostrare cosa era in vigore e quando. */
  exclusions: CrmProspectExclusion[];
  loading: boolean;
}

export function useProspect(projectId: string | undefined, enabled: boolean): ProspectData {
  const [profiles, setProfiles] = useState<CrmCompanyProfile[]>([]);
  const [searches, setSearches] = useState<CrmProspectSearch[]>([]);
  const [reports, setReports] = useState<CrmProspectReport[]>([]);
  const [exclusions, setExclusions] = useState<CrmProspectExclusion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const disdette = [
      subscribeToProfiles(projectId, schede => { setProfiles(schede); setLoading(false); }),
      subscribeToSearches(projectId, setSearches),
      subscribeToReports(projectId, setReports),
      subscribeToExclusions(projectId, setExclusions),
    ];

    return () => disdette.forEach(disdetta => disdetta());
  }, [projectId, enabled]);

  return { profiles, searches, reports, exclusions, loading };
}
