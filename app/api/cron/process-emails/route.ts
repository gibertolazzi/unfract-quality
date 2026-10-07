import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase-admin';
import { getRecapEmailHtml, getNotificationEmailHtml, QueuedNotification } from '@/lib/emailTemplates';

export const runtime = 'nodejs';

type EmailType = 'assignment' | 'requester' | 'changes' | 'mention' | 'message';
type QueueItem = QueuedNotification & {
  docId: string;
  recipientId: string;
  type: EmailType;
  createdAt: number;
};

function preferenceEnabled(type: EmailType, settings: Record<string, any>): boolean {
  switch (type) {
    case 'assignment': return settings.emailAssignee !== false;
    case 'requester': return settings.emailRequester === true;
    case 'changes': return settings.emailChanges === true;
    case 'mention': return settings.emailMentioned !== false;
    case 'message': return settings.emailMessages === true;
  }
}

function intervalMs(frequency: string): number {
  return frequency === '5min' ? 5 * 60_000 : 3 * 60_000;
}

async function claim(docId: string, now: number): Promise<boolean> {
  const ref = adminDb.collection('notifications_queue').doc(docId);
  return adminDb.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('processed') === true) return false;
    const leaseUntil = snapshot.get('processingUntil') as Timestamp | undefined;
    if (leaseUntil && leaseUntil.toMillis() > now) return false;
    transaction.update(ref, {
      processingUntil: Timestamp.fromMillis(now + 5 * 60_000),
      attempts: FieldValue.increment(1),
    });
    return true;
  });
}

function titleFor(item: QueueItem): string {
  switch (item.type) {
    case 'assignment': return `${item.authorName} ti ha assegnato una task`;
    case 'requester': return `Aggiornamento sulla task: ${item.taskTitle || 'Task'}`;
    case 'changes': return 'Conferma modifica task';
    case 'mention': return `${item.authorName} ti ha menzionato`;
    case 'message': return `Nuovo messaggio da ${item.authorName}`;
  }
}

function subjectFor(item: QueueItem): string {
  switch (item.type) {
    case 'assignment': return 'Nuova task assegnata';
    case 'requester': return 'Aggiornamento della tua richiesta';
    case 'changes': return 'Conferma modifica task';
    case 'mention': return 'Sei stato menzionato';
    case 'message': return 'Hai ricevuto un messaggio';
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not configured');
    return new NextResponse('Cron non configurato', { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY non configurata' }, { status: 503 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const snapshot = await adminDb.collection('notifications_queue').where('processed', '==', false).get();
    if (snapshot.empty) return NextResponse.json({ message: 'Nessuna notifica in coda', processedCount: 0 });

    const grouped = new Map<string, QueueItem[]>();
    for (const queueDoc of snapshot.docs) {
      const data = queueDoc.data();
      if (!data.recipientId || !data.type) continue;
      const item: QueueItem = {
        id: queueDoc.id,
        docId: queueDoc.id,
        recipientId: data.recipientId,
        type: data.type as EmailType,
        projectName: data.projectName || 'Unfract',
        taskTitle: data.taskTitle || '',
        authorName: data.authorName || 'Unfract',
        authorAvatarUrl: data.authorAvatarUrl,
        messageHtml: data.messageHtml || '',
        actionUrl: data.actionUrl || '/',
        createdAt: data.createdAt?.toMillis?.() || Date.now(),
      };
      grouped.set(item.recipientId, [...(grouped.get(item.recipientId) || []), item]);
    }

    let sentCount = 0;
    let processedCount = 0;
    const errors: string[] = [];

    const recipientEntries = Array.from(grouped.entries());
    for (let recipientIndex = 0; recipientIndex < recipientEntries.length; recipientIndex += 1) {
      const recipientId = recipientEntries[recipientIndex][0];
      const items = recipientEntries[recipientIndex][1];
      const userSnapshot = await adminDb.collection('users').doc(recipientId).get();
      const userData = userSnapshot.data();
      const settings = userData?.settings || {};
      const enabled: QueueItem[] = [];

      for (const item of items) {
        if (preferenceEnabled(item.type, settings)) {
          enabled.push(item);
        } else {
          await adminDb.collection('notifications_queue').doc(item.docId).update({
            processed: true,
            processedAt: FieldValue.serverTimestamp(),
            processingUntil: FieldValue.delete(),
          });
          processedCount += 1;
        }
      }

      if (!userData?.email) {
        for (const item of enabled) {
          await adminDb.collection('notifications_queue').doc(item.docId).update({
            processed: true,
            processedAt: FieldValue.serverTimestamp(),
            processingUntil: FieldValue.delete(),
            lastError: 'Recipient email is missing',
          });
          processedCount += 1;
        }
        continue;
      }

      const waitMs = intervalMs(settings.groupFrequency || '3min');
      const due = enabled.filter(item => Date.now() - item.createdAt >= waitMs);
      const claimed: QueueItem[] = [];
      for (const item of due) {
        if (await claim(item.docId, Date.now())) claimed.push(item);
      }
      if (!claimed.length) continue;

      try {
        const displayName = userData.displayName || 'Utente';
        const result = claimed.length === 1
          ? await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'Unfract <notifications@unfract.com>',
              to: [userData.email],
              subject: subjectFor(claimed[0]),
              html: getNotificationEmailHtml({
                recipientName: displayName,
                actionTitle: titleFor(claimed[0]),
                projectName: claimed[0].projectName,
                taskTitle: claimed[0].taskTitle || '',
                authorName: claimed[0].authorName,
                messageHtml: claimed[0].messageHtml,
                actionUrl: claimed[0].actionUrl,
                actionButtonText: 'Visualizza',
              }),
            })
          : await resend.emails.send({
              from: process.env.RESEND_FROM_EMAIL || 'Unfract <notifications@unfract.com>',
              to: [userData.email],
              subject: `Hai ${claimed.length} nuove notifiche in Unfract`,
              html: getRecapEmailHtml({ recipientName: displayName, notifications: claimed }),
            });

        if (result.error) throw new Error(result.error.message);
        for (const item of claimed) {
          await adminDb.collection('notifications_queue').doc(item.docId).update({
            processed: true,
            processedAt: FieldValue.serverTimestamp(),
            processingUntil: FieldValue.delete(),
            resendId: result.data?.id || null,
          });
          processedCount += 1;
        }
        sentCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // L'utente per ID, non per indirizzo email: i log non devono contenere dati personali.
        errors.push(`${userSnapshot.id}: ${message}`);
        console.error(`Errore invio email all'utente ${userSnapshot.id}:`, message);
        for (const item of claimed) {
          await adminDb.collection('notifications_queue').doc(item.docId).update({
            processingUntil: FieldValue.delete(),
            lastError: message.slice(0, 1000),
          });
        }
      }
    }

    return NextResponse.json({ message: 'Elaborazione completata', sentCount, processedCount, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Cron Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
