import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { normalizeVat } from '@/lib/crm/prospect/base';
import { partitaIvaValida } from '@/lib/crm/prospect/recognize';
import { CrmAccount } from '@/types/crm';
import { mapAccount } from '@/lib/crm/accountService';

export interface VatLookupResult {
  vatNumber: string;
  country: string;
  legalName: string;
  displayName: string;
  address: string;
  street: string;
  city: string;
  postalCode: string;
  province: string;
  countryCode: string;
  warnings: string[];
  verifiedAt: string;
  source: 'vies' | 'provider' | 'manual';
}

export interface VatLookupResponse {
  ok: boolean;
  result?: VatLookupResult;
  fromCache?: boolean;
  error?: string;
  code?: string;
  retryable?: boolean;
}

const LOOKUP_ENDPOINT = '/api/crm/vat/lookup';

/**
 * Valida il checksum della partita IVA italiana senza effettuare chiamate di rete.
 */
export function validateItalianVatChecksum(raw: string): boolean {
  return partitaIvaValida(raw);
}

/**
 * Interroga la route server per la ricerca della Partita IVA su VIES (con cache Firestore).
 */
export async function lookupVat(rawVat: string, country = 'IT'): Promise<VatLookupResponse> {
  const cleanVat = normalizeVat(rawVat);
  if (!cleanVat) {
    return { ok: false, error: 'Inserisci una partita IVA valida.' };
  }

  if (country === 'IT' && !partitaIvaValida(cleanVat)) {
    return {
      ok: false,
      error: 'Non è una partita IVA italiana valida: la cifra di controllo non torna.',
      code: 'INVALID_CHECKSUM',
    };
  }

  let token = '';
  try {
    token = (await auth.currentUser?.getIdToken()) || '';
  } catch (err) {
    console.error('Impossibile ottenere il token di autenticazione:', err);
  }

  if (!token) {
    return { ok: false, error: 'Sessione scaduta o non valida: rientra e riprova.', code: 'NO_TOKEN' };
  }

  try {
    const res = await fetch(LOOKUP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ vatNumber: cleanVat, country }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error: data?.error || 'Errore durante la verifica della partita IVA.',
        code: data?.code || 'HTTP_ERROR',
        retryable: data?.retryable,
      };
    }

    return {
      ok: true,
      result: data.result as VatLookupResult,
      fromCache: data.fromCache,
    };
  } catch (err) {
    console.error('Errore di rete durante la verifica della partita IVA:', err);
    return {
      ok: false,
      error: 'Impossibile contattare il server per la verifica.',
      code: 'NETWORK_ERROR',
      retryable: true,
    };
  }
}

/**
 * Verifica rapida nel progetto per capire se un'Azienda è già presente con questa P.IVA.
 */
export async function findExistingAccountByVat(
  projectId: string,
  rawVat: string,
  excludeId?: string
): Promise<CrmAccount | null> {
  if (!projectId || !rawVat) return null;
  const cleanVat = normalizeVat(rawVat);
  if (!cleanVat) return null;

  try {
    const q = query(
      collection(db, 'crm_accounts'),
      where('projectId', '==', projectId),
      where('vatNumber', '==', cleanVat)
    );
    const snap = await getDocs(q);
    for (const doc of snap.docs) {
      if (doc.id === excludeId) continue;
      const data = doc.data();
      if (data.archived !== true) {
        return mapAccount(doc.id, data);
      }
    }
  } catch (err) {
    console.error('Errore durante la ricerca azienda per P.IVA:', err);
  }

  return null;
}
