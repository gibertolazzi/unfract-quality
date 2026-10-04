import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { format } from 'date-fns';
import { getCalendarEventEmailHtml } from '@/lib/emailTemplates';

const resend = new Resend(process.env.RESEND_API_KEY);

function generateIcs(event: any, method: 'REQUEST' | 'CANCEL' = 'REQUEST') {
  const formatDateForIcs = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const now = new Date();
  
  const [startH, startM] = event.startTime.split(':');
  const [endH, endM] = event.endTime.split(':');
  
  const startDate = new Date(event.date);
  startDate.setHours(parseInt(startH), parseInt(startM), 0);
  
  const endDate = new Date(event.date);
  endDate.setHours(parseInt(endH), parseInt(endM), 0);

  const icsString = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unfract//Calendar//IT',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${event.id}@unfract.com`,
    `DTSTAMP:${formatDateForIcs(now)}`,
    `DTSTART:${formatDateForIcs(startDate)}`,
    `DTEND:${formatDateForIcs(endDate)}`,
    `SUMMARY:${event.title || 'Evento Unfract'}`,
    `DESCRIPTION:${event.description || ''}`,
    'STATUS:' + (method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'),
    'SEQUENCE:' + (method === 'CANCEL' ? '1' : '0'),
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  return icsString;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, action, guestEmail, userEmail, userName } = body;

    if (!guestEmail) {
      return NextResponse.json({ error: 'Nessuna email ospite fornita' }, { status: 400 });
    }

    const method = action === 'cancel' ? 'CANCEL' : 'REQUEST';
    const icsContent = generateIcs(event, method);

    let subject = `Invito: ${event.title}`;
    if (action === 'update') subject = `Aggiornamento Orario: ${event.title}`;
    else if (action === 'cancel') subject = `Cancellazione: ${event.title}`;

    const htmlContent = getCalendarEventEmailHtml({
      eventName: event.title || 'Evento',
      action,
      date: format(new Date(event.date), 'dd/MM/yyyy'),
      time: `${event.startTime} - ${event.endTime}`,
      inviterName: userName || userEmail,
    });

    const { data, error } = await resend.emails.send({
      from: 'Unfract Calendar <calendar@unfract.com>',
      to: [guestEmail],
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: 'invite.ics',
          content: Buffer.from(icsContent).toString('base64'),
        }
      ]
    });

    if (error) {
      console.error("Resend API Error:", error);
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
