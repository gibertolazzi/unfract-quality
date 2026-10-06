import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgInviteEmailHtml } from '@/lib/emailTemplates';
import { requireUser } from '@/lib/server/auth';
import { tooManyRequests } from '@/lib/server/rateLimit';
import { createOrgInvite, isOrgMember } from '@/lib/server/orgInvites';

export const runtime = 'nodejs';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Invito via email a un'organizzazione.
 *
 * Mittente, nome dell'organizzazione, nome di chi invita e link li decide il
 * server: il client manda solo l'organizzazione e l'indirizzo. Prima arrivava
 * tutto dal client, senza login, e la route spediva qualsiasi testo e link
 * con il mittente di Unfract.
 *
 * Il link contiene un codice casuale legato all'indirizzo invitato, valido
 * 48 ore e usabile una volta (`lib/server/orgInvites.ts`). Prima era
 * `/invite/{orgId}` e valeva per chiunque, per sempre.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { user } = auth;

  if (tooManyRequests(`invite:${user.uid}`, 20)) {
    return NextResponse.json({ error: 'Troppi inviti in poco tempo. Riprova fra un minuto.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const orgId = typeof body?.orgId === 'string' ? body.orgId : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (!orgId || orgId.includes('/') || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: 'Organizzazione o indirizzo email non validi.' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error('Invite email not configured: missing RESEND_API_KEY');
    return NextResponse.json({ error: 'Invio email non configurato sul server.' }, { status: 500 });
  }

  try {
    const orgSnapshot = await adminDb.collection('organizations').doc(orgId).get();
    const org = orgSnapshot.data();
    if (!org || !isOrgMember(org, user.uid)) {
      return NextResponse.json({ error: 'Non fai parte di questa organizzazione.' }, { status: 403 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const { token } = await createOrgInvite({ orgId, invitedBy: user.uid, kind: 'email', email });
    const resend = new Resend(resendKey);
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Unfract <hello@unfract.com>',
      to: email,
      subject: `Invito a partecipare all'organizzazione ${org.name || ''}`.trim(),
      html: getOrgInviteEmailHtml({
        inviterName: user.name,
        orgName: org.name || 'Unfract',
        inviteLink: `${baseUrl}/invite/${token}`,
      }),
    });

    if (result.error) {
      console.error('Resend rejected invite email:', result.error);
      return NextResponse.json({ error: 'Il provider ha rifiutato l’invio.' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invite email error:', error);
    return NextResponse.json({ error: 'Invio dell’invito non riuscito.' }, { status: 500 });
  }
}
