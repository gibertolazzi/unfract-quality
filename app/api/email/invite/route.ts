import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getOrgInviteEmailHtml } from '@/lib/emailTemplates';

// Inizializza Resend con la chiave API (deve essere configurata nelle variabili d'ambiente)
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, inviterName, orgName, inviteLink } = body;

    if (!email || !inviterName || !orgName || !inviteLink) {
      return NextResponse.json({ error: 'Campi mancanti' }, { status: 400 });
    }

    const htmlContent = getOrgInviteEmailHtml({
      inviterName,
      orgName,
      inviteLink
    });

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Unfract <hello@unfract.com>';

    const data = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Invito a partecipare all'organizzazione ${orgName}`,
      html: htmlContent,
    });

    if (data.error) {
      console.error('Errore da Resend:', data.error);
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Errore invio email invito (Eccezione):', error);
    return NextResponse.json({ error: error.message || "Errore sconosciuto" }, { status: 500 });
  }
}
