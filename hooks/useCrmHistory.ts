'use client';

import { useEffect, useState } from 'react';
import { CrmInteraction, CrmCommunication, CrmDocument } from '@/components/crm/types';
import { subscribeToInteractions } from '@/lib/crm/interactions';
import { subscribeToCommunications } from '@/lib/crm/communications';
import { subscribeToDocuments } from '@/lib/crm/documents';

/**
 * Interazioni, comunicazioni e documenti del progetto, in ascolto SOLO finché
 * la pagina CRM è aperta.
 *
 * Non stanno in CrmContext di proposito: quel provider è dentro
 * ClientProviders e vive su tutta l'applicazione. Tre `onSnapshot` in più
 * sempre accesi si pagherebbero anche su calendario, chat e documentazione, che
 * di questi dati non sanno che farsene.
 */
export function useCrmHistory(projectId: string | null | undefined) {
  const [interactions, setInteractions] = useState<CrmInteraction[]>([]);
  const [communications, setCommunications] = useState<CrmCommunication[]>([]);
  const [documents, setDocuments] = useState<CrmDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setInteractions([]);
      setCommunications([]);
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribers = [
      subscribeToInteractions(projectId, setInteractions),
      subscribeToCommunications(projectId, setCommunications),
      subscribeToDocuments(projectId, setDocuments),
    ];
    setLoading(false);

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [projectId]);

  return { interactions, communications, documents, loading };
}
