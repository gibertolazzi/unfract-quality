import { NextResponse } from 'next/server';
import { Resend } from 'resend';


export async function POST(req: any) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = await resend.emails.send({
      from: 'Unfract Notifications <notifications@unfract.com>',
      to,
      subject,
      html,
      text: text || '',
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
