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
  attempts: number;
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

/** Notifiche lette per giro: il cron gira ogni minuto, il resto passa al giro dopo. */
const QUEUE_BATCH = 300;
/** Dopo tanti invii falliti la notifica si abbandona, invece di riprovare per sempre. */
const MAX_ATTEMPTS = 5;

const queueRef = (docId: string) => adminDb.collection('notifications_queue').doc(docId);

/** Prende in carico le notifiche di un destinatario in una sola transazione. */
async function claim(docIds: string[], now: number): Promise<Set<string>> {
  return adminDb.runTransaction(async transaction => {
    const snapshots = await transaction.getAll(...docIds.map(queueRef));
    const claimed = new Set<string>();
    for (const snapshot of snapshots) {
      if (!snapshot.exists || snapshot.get('processed') === true) continue;
      const leaseUntil = snapshot.get('processingUntil') as Timestamp | undefined;
      if (leaseUntil && leaseUntil.toMillis() > now) continue;
      transaction.update(snapshot.ref, {
        processingUntil: Timestamp.fromMillis(now + 5 * 60_000),
        attempts: FieldValue.increment(1),
      });
      claimed.add(snapshot.id);
    }
    return claimed;
  });
}

/** Stessa modifica su più notifiche, a blocchi di 500 (il massimo di un batch). */
async function updateAll(docIds: string[], data: Record<string, unknown>) {
  for (let i = 0; i < docIds.length; i += 500) {
    const batch = adminDb.batch();
    for (const docId of docIds.slice(i, i + 500)) batch.update(queueRef(docId), data);
    await batch.commit();
  }
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
    const snapshot = await adminDb.collection('notifications_queue').where('processed', '==', false).limit(QUEUE_BATCH).get();
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
        attempts: Number(data.attempts) || 0,
      };
      grouped.set(item.recipientId, [...(grouped.get(item.recipientId) || []), item]);
    }

    let sentCount = 0;
    let processedCount = 0;
    const errors: string[] = [];

    // I destinatari in una sola lettura, invece di una per destinatario.
    const recipientEntries = Array.from(grouped.entries());
    const userSnapshots = await adminDb.getAll(...recipientEntries.map(([recipientId]) => adminDb.collection('users').doc(recipientId)));
    const done = { processed: true, processedAt: FieldValue.serverTimestamp(), processingUntil: FieldValue.delete() };

    for (let recipientIndex = 0; recipientIndex < recipientEntries.length; recipientIndex += 1) {
      const items = recipientEntries[recipientIndex][1];
      const userSnapshot = userSnapshots[recipientIndex];
      const userData = userSnapshot.data();
      const settings = userData?.settings || {};

      const skipped = items.filter(item => !preferenceEnabled(item.type, settings));
      const exhausted = items.filter(item => preferenceEnabled(item.type, settings) && item.attempts >= MAX_ATTEMPTS);
      const enabled = items.filter(item => preferenceEnabled(item.type, settings) && item.attempts < MAX_ATTEMPTS);
      await updateAll(skipped.map(item => item.docId), done);
      await updateAll(exhausted.map(item => item.docId), { ...done, lastError: `Abandoned after ${MAX_ATTEMPTS} attempts` });
      processedCount += skipped.length + exhausted.length;

      if (!userData?.email) {
        await updateAll(enabled.map(item => item.docId), { ...done, lastError: 'Recipient email is missing' });
        processedCount += enabled.length;
        continue;
      }

      const waitMs = intervalMs(settings.groupFrequency || '3min');
      const due = enabled.filter(item => Date.now() - item.createdAt >= waitMs);
      if (!due.length) continue;
      const claimedIds = await claim(due.map(item => item.docId), Date.now());
      const claimed = due.filter(item => claimedIds.has(item.docId));
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
        await updateAll(claimed.map(item => item.docId), { ...done, resendId: result.data?.id || null });
        processedCount += claimed.length;
        sentCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // L'utente per ID, non per indirizzo email: i log non devono contenere dati personali.
        errors.push(`${userSnapshot.id}: ${message}`);
        console.error(`Errore invio email all'utente ${userSnapshot.id}:`, message);
        await updateAll(claimed.map(item => item.docId), {
          processingUntil: FieldValue.delete(),
          lastError: message.slice(0, 1000),
        });
      }
    }

    return NextResponse.json({ message: 'Elaborazione completata', sentCount, processedCount, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Cron Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
