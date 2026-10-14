import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { normalizeEmail, normalizePhone, extractDomain } from './base';

/**
 * Rilevamento duplicati richiesto dalla specifica: email normalizzata, dominio
 * aziendale e telefono. Segnala e basta — «senza creare fusioni automatiche».
 * La fusione è un'azione manuale e preserva provenienza e cronologia.
 *
 * Il confronto avviene dentro il progetto, non fra progetti: è una conseguenza
 * della deroga 1 (partizione per progetto). Vedi docs/DEROGHE.md.
 */

export interface DuplicateMatch {
  id: string;
  collection: string;
  label: string;
  /** Su che cosa ha corrisposto: serve a spiegare all'utente il perché. */
  matchedOn: ('email' | 'phone' | 'domain' | 'vat')[];
}

export interface DuplicateQuery {
  email?: string;
  phone?: string;
  /** Dominio o sito aziendale; se assente si ricava dall'email. */
  domain?: string;
  /** Partita IVA normalizzata o grezza. */
  vatNumber?: string;
}

interface SearchTarget {
  collectionName: string;
  emailField: string;
  phoneField: string;
  domainField: string;
  vatField?: string;
  labelOf: (data: any) => string;
}

const TARGETS: SearchTarget[] = [
  {
    collectionName: 'crm_leads',
    emailField: 'emailNormalized',
    phoneField: 'phoneNormalized',
    domainField: 'companyDomain',
    vatField: 'vatNumber',
    labelOf: d => d.fullName || d.companyName || d.email || 'Lead',
  },
  {
    collectionName: 'crm_contacts',
    emailField: 'emailNormalized',
    phoneField: 'phoneNormalized',
    domainField: '',
    vatField: '',
    labelOf: d => d.fullName || d.email || 'Contatto',
  },
  {
    collectionName: 'crm_accounts',
    emailField: '',
    phoneField: '',
    domainField: 'domain',
    vatField: 'vatNumber',
    labelOf: d => d.displayName || d.legalName || d.domain || 'Azienda',
  },
];

async function matchField(
  collectionName: string,
  projectId: string,
  field: string,
  value: string
): Promise<Map<string, any>> {
  const found = new Map<string, any>();
  if (!field || !value) return found;
  try {
    const q = query(
      collection(db, collectionName),
      where('projectId', '==', projectId),
      where(field, '==', value)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(d => {
      if (d.data().archived !== true) found.set(d.id, d.data());
    });
  } catch (error) {
    console.error(`Error matching ${field} on ${collectionName}:`, error);
  }
  return found;
}

/**
 * Cerca possibili duplicati. `excludeId` serve quando si modifica un record
 * esistente, per non segnalarlo contro se stesso.
 */
export async function findDuplicates(
  projectId: string,
  input: DuplicateQuery,
  excludeId?: string
): Promise<DuplicateMatch[]> {
  if (!projectId) return [];

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const domain = extractDomain(input.domain || input.email);
  const vatNumber = input.vatNumber
    ? input.vatNumber.trim().toUpperCase().replace(/[\s.\-\/]/g, '').replace(/^IT/, '').replace(/[^0-9]/g, '')
    : '';

  if (!email && !phone && !domain && !vatNumber) return [];

  const results = new Map<string, DuplicateMatch>();

  for (const target of TARGETS) {
    const [byEmail, byPhone, byDomain, byVat] = await Promise.all([
      matchField(target.collectionName, projectId, target.emailField, email),
      matchField(target.collectionName, projectId, target.phoneField, phone),
      matchField(target.collectionName, projectId, target.domainField, domain),
      matchField(target.collectionName, projectId, target.vatField || '', vatNumber),
    ]);

    const merge = (hits: Map<string, any>, reason: 'email' | 'phone' | 'domain' | 'vat') => {
      hits.forEach((data, id) => {
        if (id === excludeId) return;
        const key = `${target.collectionName}:${id}`;
        const existing = results.get(key);
        if (existing) {
          if (!existing.matchedOn.includes(reason)) existing.matchedOn.push(reason);
        } else {
          results.set(key, {
            id,
            collection: target.collectionName,
            label: target.labelOf(data),
            matchedOn: [reason],
          });
        }
      });
    };

    merge(byEmail, 'email');
    merge(byPhone, 'phone');
    merge(byDomain, 'domain');
    merge(byVat, 'vat');
  }

  // Le corrispondenze su più chiavi sono più affidabili: prima quelle.
  return Array.from(results.values()).sort((a, b) => b.matchedOn.length - a.matchedOn.length);
}
