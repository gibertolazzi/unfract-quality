import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, writeBatch, doc } from 'firebase/firestore';
import { Resend } from 'resend';
import { getRecapEmailHtml, getNotificationEmailHtml, QueuedNotification } from '@/lib/emailTemplates';


export async function GET(request: Request) {
  // Verifichiamo un secret per evitare abusi pubblici
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'unfract-cron-secret-123'}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Recupera tutte le notifiche non elaborate
    const queueRef = collection(db, 'notifications_queue');
    const q = query(queueRef, where('processed', '==', false));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({ message: 'Nessuna notifica in coda', processedCount: 0 });
    }

    const notificationsByRecipient: Record<string, (QueuedNotification & { docId: string })[]> = {};

    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const notif = {
        id: docSnap.id,
        docId: docSnap.id,
        type: data.type,
        projectName: data.projectName,
        taskTitle: data.taskTitle,
        authorName: data.authorName,
        authorAvatarUrl: data.authorAvatarUrl,
        messageHtml: data.messageHtml,
        actionUrl: data.actionUrl,
        createdAt: data.createdAt?.toMillis() || Date.now()
      };
      
      const recipientId = data.recipientId;
      if (!notificationsByRecipient[recipientId]) {
        notificationsByRecipient[recipientId] = [];
      }
      notificationsByRecipient[recipientId].push(notif);
    });

    const batch = writeBatch(db);
    let processedCount = 0;

    // Per ogni utente, verifichiamo le impostazioni (se possibile) e inviamo
    for (const [recipientId, notifications] of Object.entries(notificationsByRecipient)) {
      // Idealmente qui faremmo una getDoc su users/${recipientId} per prendere 
      // le preferenze e l'email dell'utente
      const userRef = doc(db, 'users', recipientId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      if (!userData || !userData.email) {
        // Se non troviamo l'email, segniamo come processate per evitare blocchi
        notifications.forEach(n => {
          batch.update(doc(db, 'notifications_queue', n.docId), { processed: true });
        });
        continue;
      }

      const settings = userData.settings || {};
      const groupFreqStr = settings.groupFrequency || '3min';
      let waitTimeMs = 3 * 60 * 1000;
      if (groupFreqStr === '5min') waitTimeMs = 5 * 60 * 1000;
      if (groupFreqStr === '10min') waitTimeMs = 10 * 60 * 1000;

      // Trova la notifica più vecchia
      const oldestTime = Math.min(...notifications.map(n => n.createdAt));
      const now = Date.now();

      // Se non è passato abbastanza tempo dalla prima notifica, saltiamo e lasciamo in coda
      if (now - oldestTime < waitTimeMs) {
        continue;
      }

      // Filtriamo in base alle preferenze? 
      // Se la notifica è in coda significa che doveva essere inviata, ma possiamo ricontrollare i flag:
      const validNotifications = notifications.filter(n => {
        if (n.type === 'mention' && settings.emailMentioned === false) return false;
        if (n.type === 'assignment' && settings.emailAssignee === false) return false;
        // ... altri controlli
        return true;
      });

      if (validNotifications.length > 0) {
        try {
          if (validNotifications.length === 1) {
            // Invia email singola
            const n = validNotifications[0];
            const html = getNotificationEmailHtml({
              recipientName: userData.displayName || 'Utente',
              actionTitle: n.type === 'mention' ? `${n.authorName} ti ha menzionato` : 'Nuova notifica in Unfract',
              projectName: n.projectName,
              taskTitle: n.taskTitle || '',
              authorName: n.authorName,
              authorAvatarUrl: n.authorAvatarUrl,
              messageHtml: n.messageHtml,
              actionUrl: n.actionUrl,
              actionButtonText: 'Visualizza'
            });

            await resend.emails.send({
              from: 'Unfract <notifications@unfract.com>',
              to: [userData.email],
              subject: n.type === 'mention' ? 'Sei stato menzionato' : 'Nuova notifica in Unfract',
              html: html
            });
          } else {
            // Invia email recap
            const html = getRecapEmailHtml({
              recipientName: userData.displayName || 'Utente',
              notifications: validNotifications
            });

            await resend.emails.send({
              from: 'Unfract <notifications@unfract.com>',
              to: [userData.email],
              subject: `Hai ${validNotifications.length} nuove notifiche in Unfract`,
              html: html
            });
          }
        } catch (emailErr) {
          console.error(`Errore invio email a ${userData.email}:`, emailErr);
        }
      }

      // Segna tutte come processate
      notifications.forEach(n => {
        batch.update(doc(db, 'notifications_queue', n.docId), { processed: true });
        processedCount++;
      });
    }

    if (processedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ message: 'Elaborazione completata', processedCount });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
