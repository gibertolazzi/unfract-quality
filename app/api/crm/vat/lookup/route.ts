import { NextResponse } from 'next/server';
import { viesProvider } from '@/lib/crm/prospect/providers/vies';
import { partitaIvaValida } from '@/lib/crm/prospect/recognize';
import { normalizeVat } from '@/lib/crm/prospect/base';
import { guardRequest } from '@/lib/crm/prospect/serverAuth';
import { readJsonObject } from '@/lib/server/requestBody';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const CACHE_COLLECTION = 'crm_vat_cache';
const CACHE_TTL_DAYS = 30;

export async function POST(request: Request) {
  const guardia = await guardRequest(request, { operation: 'vat-lookup', limit: 30 });
  if (!guardia.ok) {
    return NextResponse.json({ error: guardia.error }, { status: guardia.status });
  }

  const payload = await readJsonObject(request);
  if (!payload) {
    return NextResponse.json({ error: 'Richiesta non leggibile.' }, { status: 400 });
  }

  const rawVat = String(payload.vatNumber || '').trim();
  const country = String(payload.country || 'IT').toUpperCase().trim();

  if (!rawVat) {
    return NextResponse.json({ error: 'Partita IVA mancante.' }, { status: 400 });
  }

  const cleanVat = normalizeVat(rawVat);

  if (country === 'IT') {
    if (!partitaIvaValida(cleanVat)) {
      return NextResponse.json(
        {
          error: 'Non è una partita IVA italiana valida: la cifra di controllo non torna.',
          code: 'INVALID_CHECKSUM',
        },
        { status: 400 }
      );
    }
  }

  const cacheKey = `${country}_${cleanVat}`;

  // 1. Controllo cache (con fallback sicuro se Firestore Admin non è configurato localmente)
  try {
    const cacheDoc = await adminDb.collection(CACHE_COLLECTION).doc(cacheKey).get();
    if (cacheDoc.exists) {
      const cached = cacheDoc.data();
      if (cached && cached.cachedAt) {
        const ageMs = Date.now() - new Date(cached.cachedAt).getTime();
        const maxAgeMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
        if (ageMs < maxAgeMs) {
          return NextResponse.json({ result: cached.result, fromCache: true });
        }
      }
    }
  } catch (err) {
    // Continua senza bloccare la ricerca VIES
    console.warn('Avviso: impossibile leggere cache P.IVA da Firestore Admin:', err);
  }

  // 2. Chiamata a VIES
  const esito = await viesProvider.lookup(cleanVat);

  if (!esito.ok) {
    return NextResponse.json(
      {
        error: esito.failure.message,
        code: esito.failure.code,
        retryable: esito.failure.retryable,
      },
      { status: esito.failure.retryable ? 503 : 400 }
    );
  }

  const viesData = esito.result;
  const result = {
    vatNumber: cleanVat,
    country,
    legalName: viesData.legalName || '',
    displayName: viesData.legalName || '',
    address: viesData.street || viesData.address || '',
    street: viesData.street || '',
    city: viesData.city || '',
    postalCode: viesData.postalCode || '',
    province: viesData.province || '',
    countryCode: viesData.country || country,
    warnings: viesData.warnings || [],
    verifiedAt: new Date().toISOString(),
    source: 'vies' as const,
  };

  // 3. Salvataggio in cache
  try {
    await adminDb.collection(CACHE_COLLECTION).doc(cacheKey).set({
      cachedAt: new Date().toISOString(),
      result,
    });
  } catch (err) {
    console.warn('Avviso: impossibile scrivere cache P.IVA in Firestore Admin:', err);
  }

  return NextResponse.json({ result, fromCache: false });
}
